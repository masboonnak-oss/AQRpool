import { db, couponsTable, couponRedemptionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// Shared coupon evaluation — used by POST /coupons/validate (preview) and the package
// purchase endpoint so the rules stay identical. `subtotal` is the price AFTER the
// loyalty-tier discount (coupon stacks on top). Returns an integer THB discount.
export type CouponResult =
  | { ok: true; coupon: typeof couponsTable.$inferSelect; discount: number }
  | { ok: false; error: string };

export async function evaluateCoupon(code: string, userId: number, subtotal: number): Promise<CouponResult> {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return { ok: false, error: "กรุณากรอกโค้ดส่วนลด" };

  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, normalized)).limit(1);
  if (!coupon || !coupon.isActive) return { ok: false, error: "โค้ดส่วนลดไม่ถูกต้องหรือถูกปิดใช้งาน" };

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "โค้ดส่วนลดหมดอายุแล้ว" };
  }
  if (subtotal < Number(coupon.minPurchase)) {
    return { ok: false, error: `ใช้ได้เมื่อยอดซื้อตั้งแต่ ฿${Number(coupon.minPurchase).toLocaleString("th-TH")} ขึ้นไป` };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: "โค้ดส่วนลดถูกใช้ครบจำนวนแล้ว" };
  }

  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(couponRedemptionsTable)
    .where(and(eq(couponRedemptionsTable.couponId, coupon.id), eq(couponRedemptionsTable.userId, userId)));
  if ((used?.n ?? 0) >= coupon.perUserLimit) {
    return { ok: false, error: "คุณใช้โค้ดนี้ครบจำนวนครั้งที่กำหนดแล้ว" };
  }

  let discount: number;
  if (coupon.discountType === "fixed") {
    discount = Number(coupon.discountValue);
  } else {
    discount = Math.round((subtotal * Number(coupon.discountValue)) / 100);
    if (coupon.maxDiscount != null) discount = Math.min(discount, Number(coupon.maxDiscount));
  }
  // Never discount below zero / past the price.
  discount = Math.max(0, Math.min(Math.round(discount), subtotal));
  if (discount <= 0) return { ok: false, error: "โค้ดนี้ไม่สามารถใช้กับยอดนี้ได้" };

  return { ok: true, coupon, discount };
}
