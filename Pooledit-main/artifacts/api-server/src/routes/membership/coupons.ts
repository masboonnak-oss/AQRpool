import { Router } from "express";
import { db, couponsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../../middlewares/auth.js";
import { evaluateCoupon } from "../../lib/coupon.js";

// Discount coupons. Admin CRUD + a member-facing validate (preview) endpoint. The
// actual redemption happens inside the package purchase flow.
const router = Router();

function serialize(c: typeof couponsTable.$inferSelect) {
  return {
    ...c,
    discountValue: Number(c.discountValue),
    maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : null,
    minPurchase: Number(c.minPurchase),
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

const num = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// POST /coupons/validate — member: preview the discount for a code + subtotal.
router.post("/validate", authenticate, async (req, res) => {
  try {
    const subtotal = Number(req.body?.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) return res.status(400).json({ valid: false, error: "ยอดไม่ถูกต้อง" });
    const result = await evaluateCoupon(String(req.body?.code || ""), req.user!.userId, subtotal);
    if (!result.ok) return res.status(200).json({ valid: false, error: result.error });
    return res.json({ valid: true, discount: result.discount, finalPrice: subtotal - result.discount, code: result.coupon.code });
  } catch {
    return res.status(500).json({ valid: false, error: "ตรวจสอบโค้ดไม่สำเร็จ" });
  }
});

// GET /coupons/all — admin: list every coupon.
router.get("/all", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
    return res.json(rows.map(serialize));
  } catch {
    return res.status(500).json({ error: "Failed to list coupons" });
  }
});

// POST /coupons — admin: create.
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "กรุณาระบุโค้ด" });
    const discountValue = num(req.body?.discountValue);
    if (discountValue == null || discountValue <= 0) return res.status(400).json({ error: "กรุณาระบุมูลค่าส่วนลด" });
    const discountType = req.body?.discountType === "fixed" ? "fixed" : "percent";

    const [existing] = await db.select({ id: couponsTable.id }).from(couponsTable).where(eq(couponsTable.code, code)).limit(1);
    if (existing) return res.status(409).json({ error: "มีโค้ดนี้อยู่แล้ว" });

    const [row] = await db.insert(couponsTable).values({
      code,
      description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
      discountType,
      discountValue: String(discountValue),
      maxDiscount: num(req.body?.maxDiscount) != null ? String(num(req.body?.maxDiscount)) : null,
      minPurchase: String(num(req.body?.minPurchase) ?? 0),
      usageLimit: num(req.body?.usageLimit) != null ? Math.trunc(num(req.body?.usageLimit)!) : null,
      perUserLimit: Math.max(1, Math.trunc(num(req.body?.perUserLimit) ?? 1)),
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch {
    return res.status(500).json({ error: "Failed to create coupon" });
  }
});

// PATCH /coupons/:id — admin: update.
router.patch("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const u: Partial<typeof couponsTable.$inferInsert> = {};
    if (req.body?.code !== undefined) {
      const code = String(req.body.code).trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "กรุณาระบุโค้ด" });
      u.code = code;
    }
    if (req.body?.description !== undefined) u.description = String(req.body.description).trim() || null;
    if (req.body?.discountType !== undefined) u.discountType = req.body.discountType === "fixed" ? "fixed" : "percent";
    if (req.body?.discountValue !== undefined) { const v = num(req.body.discountValue); if (v != null) u.discountValue = String(v); }
    if (req.body?.maxDiscount !== undefined) { const v = num(req.body.maxDiscount); u.maxDiscount = v != null ? String(v) : null; }
    if (req.body?.minPurchase !== undefined) u.minPurchase = String(num(req.body.minPurchase) ?? 0);
    if (req.body?.usageLimit !== undefined) { const v = num(req.body.usageLimit); u.usageLimit = v != null ? Math.trunc(v) : null; }
    if (req.body?.perUserLimit !== undefined) u.perUserLimit = Math.max(1, Math.trunc(num(req.body.perUserLimit) ?? 1));
    if (req.body?.isActive !== undefined) u.isActive = Boolean(req.body.isActive);
    if (req.body?.expiresAt !== undefined) u.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (Object.keys(u).length === 0) return res.status(400).json({ error: "nothing to update" });

    const [row] = await db.update(couponsTable).set(u).where(eq(couponsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Coupon not found" });
    return res.json(serialize(row));
  } catch {
    return res.status(500).json({ error: "Failed to update coupon" });
  }
});

// DELETE /coupons/:id — admin: delete (redemptions cascade).
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(couponsTable).where(eq(couponsTable.id, parseInt(req.params.id)));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete coupon" });
  }
});

export default router;
