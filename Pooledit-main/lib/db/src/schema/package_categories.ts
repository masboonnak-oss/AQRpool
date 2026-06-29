import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// Managed taxonomy for grouping membership packages (ว่ายน้ำ / แอโรบิค / ฟิตเนส / อื่นๆ).
// Admins manage these; trainers pick a category ("หมวดหมู่คอส") when scheduling, and a
// booking against that slot deducts the member's package of the matching category.
export const packageCategoriesTable = pgTable("package_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PackageCategory = typeof packageCategoriesTable.$inferSelect;
