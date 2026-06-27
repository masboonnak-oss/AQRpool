import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { downloadCsv, csvStamp } from "@/lib/export-csv";
import { cn } from "@/lib/utils";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

type AuditLog = {
  id: number;
  actorUserId: number | null;
  actorUsername: string | null;
  actorRole: string | null;
  actorName: string | null;
  memberCode: string | null;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditResponse = {
  logs: AuditLog[];
  actions: { action: string; count: number }[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
};

const actionLabel: Record<string, string> = {
  login_success: "เข้าสู่ระบบสำเร็จ",
  login_failed: "เข้าสู่ระบบไม่สำเร็จ",
  logout: "ออกจากระบบ",
  session_check: "ตรวจสอบ session",
  backup_access: "เข้าถึง backup",
  audit_log_access: "ดูบันทึกความปลอดภัย",
  checkin: "เช็คอิน",
  topup: "เติมเงิน",
  wallet: "กระเป๋าเงิน",
  order: "คำสั่งซื้อ",
  reservation: "การจอง",
  user: "จัดการผู้ใช้",
  package: "แพ็กเกจ/คอร์ส",
  instructor: "ครูฝึก",
  staff_task: "ภารกิจพนักงาน",
  attendance: "ลงเวลางาน",
  leave: "คำขอลา",
  request_failed: "คำขอผิดพลาด",
};

const methodTone: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  POST: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  PATCH: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-700 border-red-500/20",
};

function localTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function AdminAuditLogs() {
  const token = localStorage.getItem("pool_token");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [action, setAction] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "50", from, to, action, method, status });
    if (search.trim()) qs.set("search", search.trim());
    return qs.toString();
  }, [action, from, method, page, search, status, to]);

  const { data, isLoading, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ["audit-logs", query],
    queryFn: async () => {
      const r = await fetch(`${baseUrl}/api/audit-logs?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("โหลดบันทึกความปลอดภัยไม่สำเร็จ");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const logs = data?.logs ?? [];
  const failed = logs.filter((log) => log.statusCode >= 400).length;

  const exportCsv = () => {
    downloadCsv(`audit-logs-${csvStamp()}.csv`, [
      ["เวลา", "ชื่อ", "รหัส", "username", "role", "action", "method", "path", "status", "ip", "อุปกรณ์"],
      ...logs.map((log) => [
        localTime(log.createdAt),
        log.actorName ?? "-",
        log.memberCode ?? "-",
        log.actorUsername ?? "-",
        log.actorRole ?? "-",
        actionLabel[log.action] ?? log.action,
        log.method,
        log.path,
        log.statusCode,
        log.ip ?? "-",
        log.userAgent ?? "-",
      ]),
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="บันทึกความปลอดภัย"
        subtitle="Super admin ตรวจสอบได้ว่าใครเข้าระบบหรือทำรายการอะไร เวลาไหน IP/อุปกรณ์ใด"
        icon={ShieldCheck}
        gradient="from-slate-700 to-cyan-600"
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> รีเฟรช
            </Button>
            <Button onClick={exportCsv} disabled={!logs.length} className="gap-2">
              <Download className="w-4 h-4" /> ดาวน์โหลด
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass border-none shadow-lg"><CardContent className="p-5"><div className="text-2xl font-bold">{data?.total ?? 0}</div><div className="text-sm text-muted-foreground">รายการทั้งหมดตามตัวกรอง</div></CardContent></Card>
        <Card className="glass border-none shadow-lg"><CardContent className="p-5"><div className="text-2xl font-bold text-emerald-600">{logs.length - failed}</div><div className="text-sm text-muted-foreground">รายการสำเร็จในหน้านี้</div></CardContent></Card>
        <Card className="glass border-none shadow-lg"><CardContent className="p-5"><div className="text-2xl font-bold text-red-600">{failed}</div><div className="text-sm text-muted-foreground">รายการผิดพลาด/ถูกปฏิเสธ</div></CardContent></Card>
      </div>

      <Card className="glass rounded-2xl border-none shadow-lg">
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหาชื่อ / รหัส / IP / path / status" className="pl-9" />
            </div>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="all">ทุก action</option>
              {(data?.actions ?? []).map((a) => <option key={a.action} value={a.action}>{actionLabel[a.action] ?? a.action} ({a.count})</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
              <option value="all">ทุก method</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">ทุกสถานะ</option>
              <option value="success">สำเร็จ</option>
              <option value="failed">ผิดพลาด/ถูกปฏิเสธ</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass rounded-2xl border-none shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden lg:grid grid-cols-[170px_190px_150px_90px_1fr_90px_130px] gap-3 px-5 py-3 text-xs font-bold text-muted-foreground border-b">
            <span>เวลา</span><span>ผู้ใช้</span><span>Action</span><span>Method</span><span>Path</span><span>Status</span><span>IP</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">กำลังโหลดบันทึก...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">ไม่พบบันทึกตามตัวกรองนี้</div>
          ) : (
            <div className="divide-y divide-border/60">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-4">
                  <div className="hidden lg:grid grid-cols-[170px_190px_150px_90px_1fr_90px_130px] gap-3 items-start text-sm">
                    <span className="text-xs text-muted-foreground">{localTime(log.createdAt)}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{log.actorName ?? "ไม่ระบุ"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{log.memberCode ?? log.actorUsername ?? "-"}</div>
                      <div className="text-[10px] text-muted-foreground">{log.actorRole ?? "-"}</div>
                    </div>
                    <span className="truncate">{actionLabel[log.action] ?? log.action}</span>
                    <Badge variant="outline" className={cn("justify-center", methodTone[log.method])}>{log.method}</Badge>
                    <span className="font-mono text-xs truncate" title={log.path}>{log.path}</span>
                    <Badge className={log.statusCode >= 400 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}>{log.statusCode}</Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate">{log.ip ?? "-"}</span>
                  </div>

                  <div className="lg:hidden space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{log.actorName ?? "ไม่ระบุ"}</div>
                        <div className="text-xs text-muted-foreground">{localTime(log.createdAt)}</div>
                      </div>
                      <Badge className={log.statusCode >= 400 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}>{log.statusCode}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={methodTone[log.method]}>{log.method}</Badge>
                      <Badge variant="outline">{actionLabel[log.action] ?? log.action}</Badge>
                      {log.memberCode && <Badge variant="outline" className="font-mono">{log.memberCode}</Badge>}
                    </div>
                    <div className="font-mono text-xs break-all text-muted-foreground">{log.path}</div>
                    <div className="text-xs text-muted-foreground">IP: {log.ip ?? "-"} · {log.actorRole ?? "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">หน้า {data?.page ?? 1} / {data?.totalPages ?? 1}</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</Button>
          <Button variant="outline" disabled={!data || page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
        </div>
      </div>
    </div>
  );
}
