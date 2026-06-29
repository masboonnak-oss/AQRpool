import { Router } from "express";
import { db, reservationsTable, usersTable, facilitiesTable, instructorsTable, membershipPackagesTable, memberPackagesTable, branchesTable, ordersTable, attendanceTable } from "@workspace/db";
import { eq, gte, lte, and, sql, inArray, isNull, asc, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../../middlewares/auth.js";
import { attachBranch, branchEq } from "../../middlewares/branch.js";
import { displayMemberCode } from "../../lib/memberCode.js";
import { bangkokDate } from "../../lib/date.js";

const router = Router();

// GET /stats/public — lightweight, non-sensitive aggregate counts for the public
// landing page (no auth). Powers the live hero numbers; reflects admin changes.
router.get("/public", async (_req, res) => {
  try {
    const [{ members }] = await db
      .select({ members: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "member"));
    const [{ instructors }] = await db
      .select({ instructors: sql<number>`count(*)::int` })
      .from(instructorsTable)
      .where(eq(instructorsTable.status, "active"));
    const [{ facilities }] = await db
      .select({ facilities: sql<number>`count(*)::int` })
      .from(facilitiesTable)
      .where(eq(facilitiesTable.isActive, true));
    const [{ packages }] = await db
      .select({ packages: sql<number>`count(*)::int` })
      .from(membershipPackagesTable)
      .where(eq(membershipPackagesTable.isActive, true));
    const [{ reservations }] = await db
      .select({ reservations: sql<number>`count(*)::int` })
      .from(reservationsTable);
    return res.json({ members, instructors, facilities, packages, reservations });
  } catch {
    return res.status(500).json({ error: "Failed to get public stats" });
  }
});

// GET /stats/branches — cross-branch oversight for super_admin (per-branch + grand totals).
router.get("/branches", authenticate, async (req, res) => {
  if (req.user?.role !== "super_admin") return res.status(403).json({ error: "Forbidden: super admin only" });
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

    const branches = await db.select().from(branchesTable).orderBy(asc(branchesTable.id));
    const members = await db.select({ b: usersTable.branchId, n: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, "member")).groupBy(usersTable.branchId);
    const resTotal = await db.select({ b: reservationsTable.branchId, n: sql<number>`count(*)::int` }).from(reservationsTable).groupBy(reservationsTable.branchId);
    const resToday = await db.select({ b: reservationsTable.branchId, n: sql<number>`count(*)::int` }).from(reservationsTable).where(eq(reservationsTable.date, today)).groupBy(reservationsTable.branchId);
    const revenue = await db.select({ b: ordersTable.branchId, total: sql<number>`coalesce(sum(${ordersTable.subtotal}),0)::float` }).from(ordersTable).where(inArray(ordersTable.status, ["paid", "shipped"])).groupBy(ordersTable.branchId);
    const onDuty = await db.select({ b: attendanceTable.branchId, n: sql<number>`count(*)::int` }).from(attendanceTable).where(isNull(attendanceTable.clockOut)).groupBy(attendanceTable.branchId);

    const map = (rows: any[], key = "n") => new Map(rows.map((r) => [r.b, r[key]]));
    const M = map(members), RT = map(resTotal), RD = map(resToday), RV = map(revenue, "total"), DU = map(onDuty);

    const list = branches.map((b) => ({
      id: b.id, name: b.name, nameEn: b.nameEn, code: b.code, isMain: b.isMain, isActive: b.isActive,
      members: M.get(b.id) || 0,
      reservations: RT.get(b.id) || 0,
      reservationsToday: RD.get(b.id) || 0,
      revenue: RV.get(b.id) || 0,
      onDuty: DU.get(b.id) || 0,
    }));
    const totals = list.reduce((a, b) => ({
      members: a.members + b.members, reservations: a.reservations + b.reservations,
      reservationsToday: a.reservationsToday + b.reservationsToday, revenue: a.revenue + b.revenue, onDuty: a.onDuty + b.onDuty,
    }), { members: 0, reservations: 0, reservationsToday: 0, revenue: 0, onDuty: 0 });

    return res.json({ branches: list, totals });
  } catch {
    return res.status(500).json({ error: "Failed to build branch overview" });
  }
});

// GET /stats/admin
router.get("/admin", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const today = bangkokDate();
    const monthStart = today.slice(0, 7) + "-01";
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // Branch scope: super_admin (all) → undefined; branch admin → their branch only.
    const uBranch = branchEq(req, usersTable.branchId);
    const rBranch = branchEq(req, reservationsTable.branchId);

    const [{ totalMembers }] = await db
      .select({ totalMembers: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(uBranch);

    const [{ totalReservations }] = await db
      .select({ totalReservations: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(rBranch);

    const [{ todayReservations }] = await db
      .select({ todayReservations: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(and(eq(reservationsTable.date, today), rBranch));

    const [{ monthReservations }] = await db
      .select({ monthReservations: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(and(gte(reservationsTable.date, monthStart), lte(reservationsTable.date, monthEnd), rBranch));

    const [{ upcomingReservations }] = await db
      .select({ upcomingReservations: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(and(gte(reservationsTable.date, today), inArray(reservationsTable.status, ["confirmed", "pending"]), rBranch));

    const [{ cancelledThisMonth }] = await db
      .select({ cancelledThisMonth: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(
        and(
          gte(reservationsTable.date, monthStart),
          lte(reservationsTable.date, monthEnd),
          eq(reservationsTable.status, "cancelled"),
          rBranch
        )
      );

    return res.json({
      totalMembers,
      totalReservations,
      todayReservations,
      monthReservations,
      upcomingReservations,
      cancelledThisMonth,
    });
  } catch {
    return res.status(500).json({ error: "Failed to get admin stats" });
  }
});

// GET /stats/member
router.get("/member", authenticate, async (req, res) => {
  try {
    const today = bangkokDate();
    const monthStart = today.slice(0, 7) + "-01";
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const userId = req.user!.userId;

    const [{ totalReservations }] = await db
      .select({ totalReservations: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(eq(reservationsTable.userId, userId));

    const [{ upcomingCount }] = await db
      .select({ upcomingCount: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.userId, userId),
          gte(reservationsTable.date, today),
          inArray(reservationsTable.status, ["confirmed", "pending"])
        )
      );

    const [{ cancelledCount }] = await db
      .select({ cancelledCount: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(and(eq(reservationsTable.userId, userId), eq(reservationsTable.status, "cancelled")));

    const [{ thisMonthCount }] = await db
      .select({ thisMonthCount: sql<number>`count(*)::int` })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.userId, userId),
          gte(reservationsTable.date, monthStart),
          lte(reservationsTable.date, monthEnd)
        )
      );

    return res.json({ totalReservations, upcomingCount, cancelledCount, thisMonthCount });
  } catch {
    return res.status(500).json({ error: "Failed to get member stats" });
  }
});

// GET /stats/monthly
router.get("/monthly", authenticate, requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const rows = await db
      .select({
        month: sql<string>`to_char(${reservationsTable.date}::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
        cancelled: sql<number>`sum(case when ${reservationsTable.status} = 'cancelled' then 1 else 0 end)::int`,
      })
      .from(reservationsTable)
      .where(sql`extract(year from ${reservationsTable.date}::date) = ${year}`)
      .groupBy(sql`to_char(${reservationsTable.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${reservationsTable.date}::date, 'YYYY-MM')`);

    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to get monthly stats" });
  }
});

// GET /stats/top-users
router.get("/top-users", authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        houseNumber: usersTable.houseNumber,
        phone: usersTable.phone,
        reservationCount: sql<number>`count(${reservationsTable.id})::int`,
      })
      .from(usersTable)
      .leftJoin(reservationsTable, eq(reservationsTable.userId, usersTable.id))
      .groupBy(usersTable.id, usersTable.firstName, usersTable.lastName, usersTable.houseNumber, usersTable.phone)
      .orderBy(sql`count(${reservationsTable.id}) DESC`)
      .limit(10);

    return res.json(rows.map((r) => ({ ...r, memberCode: displayMemberCode(r) })));
  } catch {
    return res.status(500).json({ error: "Failed to get top users" });
  }
});

// GET /stats/sales?from=&to=&q= — admin: unified sales history (package purchases +
// shop orders) sorted newest-first, with per-type totals. Date range + name search.
router.get("/sales", authenticate, requireAdmin, attachBranch, async (req, res) => {
  try {
    const from = typeof req.query.from === "string" && req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = typeof req.query.to === "string" && req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const inRange = (d: Date) => (!from || d >= from) && (!to || d <= to);

    // Package purchases (each member_packages row = one purchase).
    const pkgRows = await db
      .select({ mp: memberPackagesTable, pkg: membershipPackagesTable, u: usersTable })
      .from(memberPackagesTable)
      .innerJoin(membershipPackagesTable, eq(memberPackagesTable.packageId, membershipPackagesTable.id))
      .innerJoin(usersTable, eq(memberPackagesTable.userId, usersTable.id))
      .where(branchEq(req, memberPackagesTable.branchId))
      .orderBy(desc(memberPackagesTable.createdAt));

    // Shop orders (exclude cancelled from sales).
    const orderRows = await db
      .select({ o: ordersTable, u: usersTable })
      .from(ordersTable)
      .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(branchEq(req, ordersTable.branchId))
      .orderBy(desc(ordersTable.createdAt));

    type Sale = { kind: "package" | "product"; date: string; memberId: number; memberName: string; memberCode: string; detail: string; amount: number; status: string };
    const sales: Sale[] = [];

    for (const { mp, pkg, u } of pkgRows) {
      if (!inRange(mp.createdAt)) continue;
      sales.push({
        kind: "package", date: mp.createdAt.toISOString(), memberId: u.id,
        memberName: `${u.firstName} ${u.lastName}`, memberCode: displayMemberCode(u),
        detail: pkg.name, amount: Number(mp.pricePaid), status: mp.status,
      });
    }
    for (const { o, u } of orderRows) {
      if (o.status === "cancelled" || !inRange(o.createdAt)) continue;
      let count = 0;
      try { const items = JSON.parse(o.items); count = Array.isArray(items) ? items.reduce((s: number, it: any) => s + (Number(it.qty) || 1), 0) : 0; } catch { /* ignore */ }
      sales.push({
        kind: "product", date: o.createdAt.toISOString(), memberId: u.id,
        memberName: `${u.firstName} ${u.lastName}`, memberCode: displayMemberCode(u),
        detail: count ? `สินค้า ${count} ชิ้น` : "คำสั่งซื้อสินค้า", amount: Number(o.subtotal), status: o.status,
      });
    }

    const filtered = q
      ? sales.filter((s) => s.memberName.toLowerCase().includes(q) || s.memberCode.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q))
      : sales;
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    const packageTotal = filtered.filter((s) => s.kind === "package").reduce((sum, s) => sum + s.amount, 0);
    const productTotal = filtered.filter((s) => s.kind === "product").reduce((sum, s) => sum + s.amount, 0);

    return res.json({
      sales: filtered,
      summary: {
        packageTotal, productTotal, total: packageTotal + productTotal,
        packageCount: filtered.filter((s) => s.kind === "package").length,
        productCount: filtered.filter((s) => s.kind === "product").length,
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to get sales" });
  }
});

export default router;
