import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../../middlewares/auth.js";
import { attachBranch, branchEq } from "../../middlewares/branch.js";
import { getActiveUsages, pickUsable, consumeUse, NoQuotaError } from "../../lib/packageUsage.js";
import { logUsage } from "../../lib/usageLog.js";
import { displayMemberCode } from "../../lib/memberCode.js";
import { appendMemberLog } from "../../lib/memberLog.js";
import { normalizePhone } from "../../lib/phone.js";

const router = Router();

function publicUserCard(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    houseNumber: u.houseNumber,
    profileImageUrl: u.profileImageUrl,
  };
}

function memberIdFromCode(input: string) {
  const m = /^ART0*(\d+)$/i.exec(input.trim());
  return m ? Number(m[1]) : null;
}

async function findMemberForCheckin(input: string, req: any) {
  const value = input.trim();
  const branch = branchEq(req, usersTable.branchId);

  // 1) Legacy ART internal code → user id.
  const byCode = memberIdFromCode(value);
  if (byCode) {
    const [u] = await db.select().from(usersTable).where(and(eq(usersTable.id, byCode), branch)).limit(1);
    if (u) return u;
  }

  // 2) Phone or QR token. Match the verified E.164, the raw phone field (covers members
  //    who registered without phone verification), and the QR check-in token.
  const phoneE164 = normalizePhone(value);
  const digits = value.replace(/\D/g, "");
  const conds = [eq(usersTable.checkinToken, value)];
  if (phoneE164) conds.push(eq(usersTable.phoneE164, phoneE164));
  if (digits.length >= 8) conds.push(sql`regexp_replace(coalesce(${usersTable.phone}, ''), '\D', '', 'g') = ${digits}`);

  const [u] = await db.select().from(usersTable).where(and(or(...conds), branch)).limit(1);
  return u ?? null;
}

// Find member by id (used after the admin picks a candidate from the name search).
async function findMemberById(id: number, req: any) {
  const [u] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), branchEq(req, usersTable.branchId))).limit(1);
  return u ?? null;
}

// GET /checkin/my-code - member: get or lazily generate the personal token for their QR.
router.get("/my-code", authenticate, async (req, res) => {
  try {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!u) return res.status(404).json({ error: "User not found" });
    let token = u.checkinToken;
    if (!token) {
      token = randomUUID().replace(/-/g, "");
      await db.update(usersTable).set({ checkinToken: token }).where(eq(usersTable.id, u.id));
    }
    return res.json({ token });
  } catch {
    return res.status(500).json({ error: "Failed to get code" });
  }
});

// GET /checkin/search?q= - admin: find members by real name / phone / member code.
// Returns a candidate list so staff pick the right person (never auto-deduct on a name).
router.get("/search", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (q.length < 2) return res.json({ members: [] });
    const branch = branchEq(req, usersTable.branchId);
    const like = `%${q}%`;
    const digits = q.replace(/\D/g, "");

    const conds = [
      ilike(usersTable.firstName, like),
      ilike(usersTable.lastName, like),
      sql`(${usersTable.firstName} || ' ' || ${usersTable.lastName}) ilike ${like}`,
    ];
    if (digits.length >= 3) conds.push(sql`regexp_replace(coalesce(${usersTable.phone}, ''), '\D', '', 'g') like ${"%" + digits + "%"}`);
    const byCode = memberIdFromCode(q);
    if (byCode) conds.push(eq(usersTable.id, byCode));

    const rows = await db
      .select()
      .from(usersTable)
      .where(and(or(...conds), branch))
      .orderBy(usersTable.firstName)
      .limit(12);

    return res.json({
      members: rows.map((u) => ({
        id: u.id,
        code: displayMemberCode(u),
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        houseNumber: u.houseNumber,
        profileImageUrl: u.profileImageUrl,
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to search" });
  }
});

// GET /checkin/lookup?token= | ?memberId= - admin: preview member and package choices before deducting.
router.get("/lookup", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const token = ((req.query.token as string) || "").trim();
    const memberIdRaw = req.query.memberId !== undefined ? Number(req.query.memberId) : null;
    let u;
    if (memberIdRaw != null && Number.isInteger(memberIdRaw) && memberIdRaw > 0) {
      u = await findMemberById(memberIdRaw, req);
    } else {
      if (!token) return res.status(400).json({ error: "token required" });
      u = await findMemberForCheckin(token, req);
    }
    if (!u) return res.status(404).json({ error: "ไม่พบสมาชิกจากรหัสสมาชิก เบอร์โทร หรือ QR นี้" });

    const usages = await getActiveUsages(db, u.id);
    const usable = pickUsable(usages);
    const hasUnlimited = usages.some((x) => x.remaining === null);

    return res.json({
      user: publicUserCard(u),
      hasQuota: !!usable,
      totalRemaining: hasUnlimited ? null : usages.reduce((s, x) => s + (x.remaining ?? 0), 0),
      packageName: usable?.package.name ?? null,
      packages: usages.map((x) => ({
        memberPackageId: x.memberPackage.id,
        packageId: x.package.id,
        name: x.package.name,
        endDate: x.memberPackage.endDate.toISOString(),
        quota: x.quota,
        used: x.used,
        remaining: x.remaining,
        canUse: x.remaining === null || x.remaining > 0,
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to lookup" });
  }
});

// POST /checkin - admin: scan a member QR token and deduct one use from a selected course.
router.post("/", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const token = ((req.body.token as string) || "").trim();
    const memberPackageId = req.body.memberPackageId === undefined || req.body.memberPackageId === null
      ? null
      : Number(req.body.memberPackageId);

    if (!token) return res.status(400).json({ error: "token required" });
    if (req.body.memberPackageId !== undefined && (memberPackageId == null || !Number.isInteger(memberPackageId) || memberPackageId <= 0)) {
      return res.status(400).json({ error: "memberPackageId invalid" });
    }

    const u = await findMemberForCheckin(token, req);
    if (!u) return res.status(404).json({ error: "ไม่พบสมาชิกจากรหัสสมาชิก เบอร์โทร หรือ QR นี้" });

    let consumed;
    try {
      consumed = await db.transaction((tx) => consumeUse(tx, u.id, {
        source: "checkin",
        note: "เช็คอินหน้างาน (สแกน QR)",
        memberPackageId,
      }));
    } catch (err) {
      if (err instanceof NoQuotaError) {
        return res.status(400).json({
          error: "สมาชิกไม่มีจำนวนครั้งคงเหลือ",
          needPackage: true,
          user: publicUserCard(u),
        });
      }
      throw err;
    }

    await logUsage({
      userId: u.id,
      memberCode: displayMemberCode(u),
      name: `${u.firstName} ${u.lastName}`,
      source: "checkin",
      packageName: consumed.package.name,
      detail: "สแกน QR เช็คอินหน้างาน",
    });

    await appendMemberLog({ userId: u.id }, "checkins", {
      event: "checkin",
      method: "qr_scan",
      name: `${u.firstName} ${u.lastName}`,
      packageName: consumed.package.name,
      remainingAfter: consumed.remainingAfter,
    });

    return res.json({
      message: "เช็คอินสำเร็จ",
      user: publicUserCard(u),
      packageName: consumed.package.name,
      remainingAfter: consumed.remainingAfter,
    });
  } catch {
    return res.status(500).json({ error: "Failed to check in" });
  }
});

export default router;
