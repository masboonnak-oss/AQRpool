-- Discount coupons / promo codes applied at package purchase (additive — a purchase
-- without a code is unchanged). coupon_redemptions tracks per-user usage.
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "discount_type" text NOT NULL DEFAULT 'percent',
  "discount_value" numeric(10, 2) NOT NULL,
  "max_discount" numeric(10, 2),
  "min_purchase" numeric(10, 2) NOT NULL DEFAULT 0,
  "usage_limit" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "per_user_limit" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp with time zone,
  "branch_id" integer DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "coupon_id" integer NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" numeric(10, 2) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions" ("coupon_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_id_idx" ON "coupon_redemptions" ("user_id");
