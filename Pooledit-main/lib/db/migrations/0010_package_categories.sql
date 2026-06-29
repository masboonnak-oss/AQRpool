-- Managed package categories (ว่ายน้ำ / แอโรบิค / ฟิตเนส / อื่นๆ) so admins can group
-- packages, and trainers pick a "หมวดหมู่คอส" instead of a specific course when scheduling.
CREATE TABLE IF NOT EXISTS "package_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "name_en" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Attach packages to a category (nullable: legacy packages stay uncategorised).
ALTER TABLE "membership_packages" ADD COLUMN IF NOT EXISTS "category_id" integer;

CREATE INDEX IF NOT EXISTS "membership_packages_category_id_idx" ON "membership_packages" ("category_id");

-- Seed the four default categories once (only while the table is still empty, so
-- re-running this migration — or an admin who later deletes one — won't resurrect them).
INSERT INTO "package_categories" ("name", "name_en", "sort_order")
SELECT v.name, v.name_en, v.sort_order
FROM (VALUES
  ('ว่ายน้ำ', 'Swimming', 1),
  ('แอโรบิค', 'Aerobics', 2),
  ('ฟิตเนส', 'Fitness', 3),
  ('อื่นๆ', 'Others', 4)
) AS v(name, name_en, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "package_categories");
