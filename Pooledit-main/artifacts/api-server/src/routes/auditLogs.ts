import { Router } from "express";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { auditLogsTable, db, usersTable } from "@workspace/db";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.js";
import { memberCode } from "../lib/memberCode.js";

const router = Router();

router.use(authenticate, requireSuperAdmin);

function parseDate(value: unknown, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const text = String(value);
  const d = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999+07:00` : text);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const action = String(req.query.action || "all");
    const method = String(req.query.method || "all").toUpperCase();
    const status = String(req.query.status || "all");
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to, true);

    const where = and(
      from ? gte(auditLogsTable.createdAt, from) : undefined,
      to ? lte(auditLogsTable.createdAt, to) : undefined,
      action !== "all" ? eq(auditLogsTable.action, action) : undefined,
      method !== "ALL" ? eq(auditLogsTable.method, method) : undefined,
      status === "success" ? sql`${auditLogsTable.statusCode} < 400` : undefined,
      status === "failed" ? sql`${auditLogsTable.statusCode} >= 400` : undefined,
      search
        ? or(
            ilike(auditLogsTable.actorUsername, `%${search}%`),
            ilike(auditLogsTable.actorRole, `%${search}%`),
            ilike(auditLogsTable.action, `%${search}%`),
            ilike(auditLogsTable.path, `%${search}%`),
            ilike(auditLogsTable.ip, `%${search}%`),
            ilike(usersTable.firstName, `%${search}%`),
            ilike(usersTable.lastName, `%${search}%`),
            ilike(usersTable.phone, `%${search}%`),
            sql`${auditLogsTable.metadata}::text ilike ${`%${search}%`}`,
            sql`${auditLogsTable.actorUserId}::text ilike ${`%${search}%`}`,
            sql`${auditLogsTable.statusCode}::text ilike ${`%${search}%`}`,
          )
        : undefined,
    );

    const rows = await db
      .select({
        log: auditLogsTable,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        phone: usersTable.phone,
        email: usersTable.email,
        profileImageUrl: usersTable.profileImageUrl,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.actorUserId, usersTable.id))
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.actorUserId, usersTable.id))
      .where(where);

    const actionRows = await db
      .select({ action: auditLogsTable.action, count: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .groupBy(auditLogsTable.action)
      .orderBy(desc(sql<number>`count(*)::int`))
      .limit(50);

    return res.json({
      logs: rows.map(({ log, firstName, lastName, phone, email, profileImageUrl }) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        actorName: firstName || lastName ? `${firstName ?? ""} ${lastName ?? ""}`.trim() : log.actorUsername,
        memberCode: log.actorUserId ? memberCode(log.actorUserId) : null,
        phone,
        email,
        profileImageUrl,
      })),
      actions: actionRows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export default router;
