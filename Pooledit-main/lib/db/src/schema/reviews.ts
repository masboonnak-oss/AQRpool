import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Member reviews / ratings of the club (social proof, à la Booking.com/Airbnb).
// One row per member (the POST upserts), 1–5 stars + optional comment; admins can
// hide a review or post a public reply. See 0011 migration.
export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  // Admin's public reply to the review (null = no reply yet).
  reply: text("reply"),
  isPublished: boolean("is_published").notNull().default(true),
  branchId: integer("branch_id").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
