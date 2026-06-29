import { Router } from "express";
import { db, packageCategoriesTable, membershipPackagesTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../../middlewares/auth.js";

// Managed package categories ("หมวดหมู่แพ็กเกจ": ว่ายน้ำ / แอโรบิค / ฟิตเนส / อื่นๆ).
// Global taxonomy shared across branches — admins add/edit/delete, members & trainers
// read it for the booking / teaching / calendar dropdowns.
const router = Router();

function serialize(c: typeof packageCategoriesTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

// GET /package-categories — list active categories (any authenticated user).
router.get("/", authenticate, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(packageCategoriesTable)
      .where(eq(packageCategoriesTable.isActive, true))
      .orderBy(asc(packageCategoriesTable.sortOrder), asc(packageCategoriesTable.id));
    return res.json(rows.map(serialize));
  } catch {
    return res.status(500).json({ error: "Failed to list categories" });
  }
});

// GET /package-categories/all — admin: all categories incl. inactive, with package counts.
router.get("/all", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(packageCategoriesTable)
      .orderBy(asc(packageCategoriesTable.sortOrder), asc(packageCategoriesTable.id));
    const counts = await db
      .select({ categoryId: membershipPackagesTable.categoryId, n: sql<number>`count(*)::int` })
      .from(membershipPackagesTable)
      .groupBy(membershipPackagesTable.categoryId);
    const cmap = new Map(counts.map((c) => [c.categoryId, c.n]));
    return res.json(rows.map((c) => ({ ...serialize(c), packageCount: cmap.get(c.id) ?? 0 })));
  } catch {
    return res.status(500).json({ error: "Failed to list categories" });
  }
});

// POST /package-categories — admin: create.
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "กรุณาระบุชื่อหมวดหมู่" });
    const nameEn = typeof req.body?.nameEn === "string" && req.body.nameEn.trim() ? req.body.nameEn.trim() : null;
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    const [row] = await db
      .insert(packageCategoriesTable)
      .values({ name, nameEn, sortOrder })
      .returning();
    return res.status(201).json(serialize(row));
  } catch {
    return res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /package-categories/:id — admin: update.
router.patch("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Partial<typeof packageCategoriesTable.$inferInsert> = {};
    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (!name) return res.status(400).json({ error: "กรุณาระบุชื่อหมวดหมู่" });
      updates.name = name;
    }
    if (req.body?.nameEn !== undefined) updates.nameEn = typeof req.body.nameEn === "string" && req.body.nameEn.trim() ? req.body.nameEn.trim() : null;
    if (req.body?.sortOrder !== undefined) updates.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "nothing to update" });
    const [row] = await db.update(packageCategoriesTable).set(updates).where(eq(packageCategoriesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Category not found" });
    return res.json(serialize(row));
  } catch {
    return res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /package-categories/:id — admin: delete. Packages keep existing but become
// uncategorised (category_id -> null) so nothing 500s on a dangling reference.
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(packageCategoriesTable).where(eq(packageCategoriesTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Category not found" });
    await db.update(membershipPackagesTable).set({ categoryId: null }).where(eq(membershipPackagesTable.categoryId, id));
    await db.delete(packageCategoriesTable).where(eq(packageCategoriesTable.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
