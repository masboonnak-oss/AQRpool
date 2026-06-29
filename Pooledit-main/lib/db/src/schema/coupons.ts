import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Discount coupons / promo codes applied at package purchase. Additive: a purchase
// without a code behaves exactly as before. See 0012 migration.
export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // stored uppercase
  description: text("description"),
  // "percent" → discountValue is a % (0–100); "fixed" → discountValue is THB off.
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  // Cap for percent coupons (null = no cap). Ignored for fixed.
  maxDiscount: numeric("max_discount", { precision: 10, scale: 2 }),
  minPurchase: numeric("min_purchase", { precision: 10, scale: 2 }).notNull().default("0"),
  usageLimit: integer("usage_limit"),        // total redemptions allowed (null = unlimited)
  usedCount: integer("used_count").notNull().default(0),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  branchId: integer("branch_id").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per successful redemption — enforces perUserLimit and gives an audit trail.
export const couponRedemptionsTable = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => couponsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // discount applied (THB)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
export type CouponRedemption = typeof couponRedemptionsTable.$inferSelect;
