import { pgTable, serial, integer, numeric, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const topupMethodEnum = pgEnum("topup_method", ["bank_transfer", "qr_payment", "slip"]);
export const topupStatusEnum = pgEnum("topup_status", ["pending", "approved", "rejected"]);

export const topupRequestsTable = pgTable("topup_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: topupMethodEnum("method").notNull().default("bank_transfer"),
  slipImageUrl: text("slip_image_url"),
  note: text("note"),
  status: topupStatusEnum("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewNote: text("review_note"),
  // Automated slip-reading results (QR + OCR) to assist admin review.
  slipRef: text("slip_ref"),                               // bank reference id from the QR
  slipAmount: numeric("slip_amount", { precision: 12, scale: 2 }), // amount read from the slip
  slipBank: text("slip_bank"),
  slipRecipientMatch: boolean("slip_recipient_match"),     // null = merchant not configured
  slipVerdict: text("slip_verdict"),                       // 'match' | 'review' | 'duplicate' | 'unread'
  slipWarnings: text("slip_warnings"),                     // JSON array of warning codes
  slipCheckedAt: timestamp("slip_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  branchId: integer("branch_id").default(1),
});

export type TopupRequest = typeof topupRequestsTable.$inferSelect;
