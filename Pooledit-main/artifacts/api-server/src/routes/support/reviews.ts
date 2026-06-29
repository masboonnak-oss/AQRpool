import { Router } from "express";
import { db, reviewsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, requireAdmin, optionalAuth } from "../../middlewares/auth.js";

// Member reviews / ratings of the club — social proof on the landing page plus a
// member submit flow and an admin moderation panel. Additive: no booking/finance impact.
const router = Router();

// Public reviewer label: first name + last-name initial (privacy-preserving), e.g. "สมชาย ส.".
function reviewerName(firstName: string | null, lastName: string | null): string {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  return l ? `${f} ${l[0]}.` : f || "สมาชิก";
}

type Row = {
  id: number; userId: number; rating: number; comment: string | null; reply: string | null;
  isPublished: boolean; createdAt: Date; firstName: string | null; lastName: string | null;
  profileImageUrl: string | null;
};

function serialize(r: Row, includeReviewer = true) {
  return {
    id: r.id,
    userId: r.userId,
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    isPublished: r.isPublished,
    createdAt: r.createdAt.toISOString(),
    reviewer: includeReviewer ? reviewerName(r.firstName, r.lastName) : undefined,
    avatarUrl: includeReviewer ? r.profileImageUrl : undefined,
  };
}

const baseSelect = {
  id: reviewsTable.id,
  userId: reviewsTable.userId,
  rating: reviewsTable.rating,
  comment: reviewsTable.comment,
  reply: reviewsTable.reply,
  isPublished: reviewsTable.isPublished,
  createdAt: reviewsTable.createdAt,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  profileImageUrl: usersTable.profileImageUrl,
};

// GET /reviews — public: published reviews + aggregate summary. If the caller is
// authenticated, also returns their own review (even if unpublished) as `mine`.
router.get("/", optionalAuth, async (req, res) => {
  try {
    const rows = await db
      .select(baseSelect)
      .from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(eq(reviewsTable.isPublished, true))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(60);

    const [agg] = await db
      .select({ avg: sql<number>`coalesce(avg(${reviewsTable.rating}), 0)::float`, count: sql<number>`count(*)::int` })
      .from(reviewsTable)
      .where(eq(reviewsTable.isPublished, true));

    let mine = null;
    if (req.user?.userId) {
      const [own] = await db
        .select(baseSelect)
        .from(reviewsTable)
        .innerJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
        .where(eq(reviewsTable.userId, req.user.userId))
        .limit(1);
      if (own) mine = serialize(own as Row, false);
    }

    return res.json({
      reviews: rows.map((r) => serialize(r as Row)),
      summary: { average: Math.round((agg?.avg ?? 0) * 10) / 10, count: agg?.count ?? 0 },
      mine,
    });
  } catch {
    return res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /reviews — member: create or update their own review (one per member).
router.post("/", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "กรุณาให้คะแนน 1–5 ดาว" });
    }
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 1000) : null;

    const [existing] = await db.select({ id: reviewsTable.id }).from(reviewsTable).where(eq(reviewsTable.userId, userId)).limit(1);
    let row;
    if (existing) {
      // Editing resets moderation: re-publish and clear any stale admin reply.
      [row] = await db
        .update(reviewsTable)
        .set({ rating, comment, reply: null, isPublished: true, createdAt: new Date() })
        .where(eq(reviewsTable.id, existing.id))
        .returning();
    } else {
      [row] = await db.insert(reviewsTable).values({ userId, rating, comment }).returning();
    }
    return res.status(existing ? 200 : 201).json({ id: row.id, rating: row.rating, comment: row.comment, isPublished: row.isPublished, createdAt: row.createdAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "บันทึกรีวิวไม่สำเร็จ" });
  }
});

// GET /reviews/all — admin: every review incl. hidden, newest first.
router.get("/all", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select(baseSelect)
      .from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .orderBy(desc(reviewsTable.createdAt));
    return res.json(rows.map((r) => ({ ...serialize(r as Row), comment: r.comment })));
  } catch {
    return res.status(500).json({ error: "Failed to load reviews" });
  }
});

// PATCH /reviews/:id — admin: hide/show or post a public reply.
router.patch("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Partial<typeof reviewsTable.$inferInsert> = {};
    if (req.body?.isPublished !== undefined) updates.isPublished = Boolean(req.body.isPublished);
    if (req.body?.reply !== undefined) updates.reply = typeof req.body.reply === "string" && req.body.reply.trim() ? req.body.reply.trim().slice(0, 1000) : null;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "nothing to update" });
    const [row] = await db.update(reviewsTable).set(updates).where(eq(reviewsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Review not found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to update review" });
  }
});

// DELETE /reviews/:id — admin: remove a review.
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
