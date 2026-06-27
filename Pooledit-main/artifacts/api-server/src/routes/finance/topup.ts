import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { db, topupRequestsTable, walletsTable, transactionsTable, usersTable, settingsTable } from "@workspace/db";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { authenticate, requireAdmin } from "../../middlewares/auth.js";
import { attachBranch, branchEq, newRowBranch } from "../../middlewares/branch.js";
import { getOrCreateWallet } from "./wallet.js";
import { dataDirs } from "../../lib/dataPaths.js";
import { appendMemberLog } from "../../lib/memberLog.js";
import { writeEncryptedFile } from "../../lib/cryptoVault.js";
import { extractSlip } from "../../lib/slipVerify.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// Credit a top-up's amount to the member's wallet and mark it approved. Used by both
// the admin Approve action and the automatic "verdict = match" path. Guards on the
// current status so a top-up is never credited twice.
async function creditAndApprove(requestId: number, reviewerId: number | null, reviewNote: string) {
  const [request] = await db.select().from(topupRequestsTable).where(eq(topupRequestsTable.id, requestId)).limit(1);
  if (!request || request.status !== "pending") return null;

  const wallet = await getOrCreateWallet(request.userId);
  const newBalance = Number(wallet.balance) + Number(request.amount);
  await db.update(walletsTable).set({ balance: String(newBalance), updatedAt: new Date() }).where(eq(walletsTable.userId, request.userId));

  await db.insert(transactionsTable).values({
    userId: request.userId,
    amount: String(request.amount),
    type: "topup",
    description: `เติมเงินผ่าน ${request.method} (${reviewerId ? "อนุมัติโดยแอดมิน" : "อนุมัติอัตโนมัติ: สลิปตรง"})`,
    status: "completed",
    referenceId: request.id,
    branchId: request.branchId,
  });

  const [updated] = await db.update(topupRequestsTable)
    .set({ status: "approved", reviewedBy: reviewerId, reviewNote, reviewedAt: new Date() })
    .where(and(eq(topupRequestsTable.id, requestId), eq(topupRequestsTable.status, "pending")))
    .returning();
  return updated ?? null;
}

// Read the slip image, then auto-fill the verification columns so the admin sees a
// verdict (ตรง / ตรวจสอบ / ซ้ำ / อ่านไม่ออก) without opening the slip. If the shop turned on
// auto-approve and the verdict is "match", the top-up is credited automatically.
// Best-effort and runs in the background — never blocks the member's submission.
async function verifySlipInBackground(requestId: number, branchId: number, dataUrl: unknown, requestedAmount: number): Promise<void> {
  try {
    if (typeof dataUrl !== "string") return;
    const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s.exec(dataUrl);
    if (!m) return;
    const buffer = Buffer.from(m[1], "base64");

    // Merchant account + auto-approve toggle come from the branch's settings.
    const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.branchId, branchId)).limit(1);
    const ex = await extractSlip(buffer, { name: settings?.bankAccountName, number: settings?.bankAccountNumber });

    // Duplicate: the same slip reference already used by another non-rejected request.
    let duplicate = false;
    if (ex.slipRef) {
      const [dup] = await db
        .select({ id: topupRequestsTable.id })
        .from(topupRequestsTable)
        .where(and(eq(topupRequestsTable.slipRef, ex.slipRef), ne(topupRequestsTable.id, requestId), ne(topupRequestsTable.status, "rejected")))
        .limit(1);
      duplicate = !!dup;
    }

    const amountMatch = ex.amountThb != null && Math.abs(ex.amountThb - requestedAmount) < 0.01;
    const recipientOk = ex.recipientMatched !== false; // null (not configured) counts as ok
    const unreadable = !ex.slipRef && !ex.ocrText;

    const verdict = duplicate ? "duplicate" : unreadable ? "unread" : (amountMatch && recipientOk) ? "match" : "review";

    await db.update(topupRequestsTable).set({
      slipRef: ex.slipRef,
      slipAmount: ex.amountThb != null ? String(ex.amountThb) : null,
      slipBank: ex.bank,
      slipRecipientMatch: ex.recipientMatched,
      slipVerdict: verdict,
      slipWarnings: JSON.stringify(duplicate ? [...ex.warnings, "duplicate_slip"] : ex.warnings),
      slipCheckedAt: new Date(),
    }).where(eq(topupRequestsTable.id, requestId));

    // Opt-in automatic approval for confident, non-duplicate matches.
    if (verdict === "match" && settings?.topupAutoApprove) {
      await creditAndApprove(requestId, null, "อนุมัติอัตโนมัติ: สลิปตรงกับยอดและบัญชีร้าน");
    }
  } catch (err) {
    logger.warn({ err, requestId }, "slip verification failed");
  }
}

// Persist a base64 data-URL slip into data/slips/ for record-keeping. Best-effort.
async function saveSlipFile(dataUrl: unknown, topupId: number, userId: number): Promise<void> {
  if (typeof dataUrl !== "string") return;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return;
  try {
    const ext = m[1].split("/")[1].replace("jpeg", "jpg");
    const buf = Buffer.from(m[2], "base64");
    await fs.mkdir(dataDirs.slips, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeEncryptedFile(path.join(dataDirs.slips, `topup-${topupId}-user-${userId}-${stamp}.${ext}`), buf.toString("base64"));
  } catch {
    /* best-effort: never block a top-up because a file write failed */
  }
}

// POST /topup — member submits top-up request
router.post("/", authenticate, attachBranch, async (req, res) => {
  try {
    const { amount, method, slipImageUrl, note } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const [request] = await db
      .insert(topupRequestsTable)
      .values({
        userId: req.user!.userId,
        branchId: newRowBranch(req),
        amount: String(amount),
        method: method || "bank_transfer",
        slipImageUrl,
        note,
      })
      .returning();

    // Archive the uploaded slip image into the organized data/slips/ folder.
    await saveSlipFile(slipImageUrl, request.id, req.user!.userId);

    // Auto-read the slip in the background (QR + OCR) to assist admin review.
    void verifySlipInBackground(request.id, request.branchId ?? 1, slipImageUrl, Number(request.amount));

    await appendMemberLog({ userId: req.user!.userId }, "activity", {
      action: "topup_request", amount: Number(request.amount), method,
    });

    return res.status(201).json({ ...request, amount: Number(request.amount), createdAt: request.createdAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Failed to submit top-up request" });
  }
});

// GET /topup/my — member: my requests
router.get("/my", authenticate, async (req, res) => {
  try {
    const requests = await db
      .select()
      .from(topupRequestsTable)
      .where(eq(topupRequestsTable.userId, req.user!.userId))
      .orderBy(desc(topupRequestsTable.createdAt))
      .limit(50);
    return res.json(requests.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() || null })));
  } catch {
    return res.status(500).json({ error: "Failed to get requests" });
  }
});

// GET /topup/admin — admin: all requests
router.get("/admin", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const where = and(
      branchEq(req, topupRequestsTable.branchId),
      status ? eq(topupRequestsTable.status, status as any) : undefined,
    );
    const query = db
      .select({
        request: topupRequestsTable,
        user: { id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, username: usersTable.username },
      })
      .from(topupRequestsTable)
      .innerJoin(usersTable, eq(topupRequestsTable.userId, usersTable.id))
      .where(where);

    const rows = await query.orderBy(desc(topupRequestsTable.createdAt)).limit(100);
    return res.json(rows.map((r: any) => ({
      ...r.request,
      amount: Number(r.request.amount),
      slipAmount: r.request.slipAmount != null ? Number(r.request.slipAmount) : null,
      slipWarnings: r.request.slipWarnings ? JSON.parse(r.request.slipWarnings) : [],
      slipCheckedAt: r.request.slipCheckedAt?.toISOString() || null,
      createdAt: r.request.createdAt.toISOString(),
      reviewedAt: r.request.reviewedAt?.toISOString() || null,
      user: r.user,
    })));
  } catch {
    return res.status(500).json({ error: "Failed to list requests" });
  }
});

// POST /topup/:id/approve — admin: approve
router.post("/:id/approve", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reviewNote } = req.body;

    const [request] = await db.select().from(topupRequestsTable).where(eq(topupRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Already processed" });
    // A branch admin may only approve top-ups from their own branch.
    if (req.branchId != null && request.branchId !== req.branchId) {
      return res.status(403).json({ error: "ไม่สามารถอนุมัติคำขอต่างสาขาได้" });
    }

    const updated = await creditAndApprove(id, req.user!.userId, reviewNote);
    if (!updated) return res.status(400).json({ error: "Already processed" });

    return res.json({ ...updated, amount: Number(updated.amount), createdAt: updated.createdAt.toISOString(), reviewedAt: updated.reviewedAt?.toISOString() || null });
  } catch {
    return res.status(500).json({ error: "Failed to approve" });
  }
});

// POST /topup/:id/reject — admin: reject
router.post("/:id/reject", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reviewNote } = req.body;

    const [request] = await db.select().from(topupRequestsTable).where(eq(topupRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Already processed" });
    if (req.branchId != null && request.branchId !== req.branchId) {
      return res.status(403).json({ error: "ไม่สามารถปฏิเสธคำขอต่างสาขาได้" });
    }

    const [updated] = await db
      .update(topupRequestsTable)
      .set({ status: "rejected", reviewedBy: req.user!.userId, reviewNote, reviewedAt: new Date() })
      .where(eq(topupRequestsTable.id, id))
      .returning();

    return res.json({ ...updated, amount: Number(updated.amount), createdAt: updated.createdAt.toISOString(), reviewedAt: updated.reviewedAt?.toISOString() || null });
  } catch {
    return res.status(500).json({ error: "Failed to reject" });
  }
});

export default router;
