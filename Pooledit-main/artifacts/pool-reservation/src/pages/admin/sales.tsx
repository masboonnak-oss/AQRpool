import { FC, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Receipt, Crown, ShoppingBag, Search, Coins } from "lucide-react";

type Sale = {
  kind: "package" | "product";
  date: string;
  memberId: number;
  memberName: string;
  memberCode: string;
  detail: string;
  amount: number;
  status: string;
};
type Summary = { packageTotal: number; productTotal: number; total: number; packageCount: number; productCount: number };

const baht = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => todayStr().slice(0, 8) + "01";

export const AdminSales: FC = () => {
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [q, setQ] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary>({ packageTotal: 0, productTotal: 0, total: 0, packageCount: 0, productCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`${baseUrl}/api/stats/sales?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setSales(d.sales || []);
      setSummary(d.summary || { packageTotal: 0, productTotal: 0, total: 0, packageCount: 0, productCount: 0 });
    }
    setLoading(false);
  }, [baseUrl, token, from, to, q]);

  // Refetch on date change; search is applied via the button / Enter.
  useEffect(() => { fetchSales(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const cards = [
    { label: "ยอดรวมทั้งหมด", value: baht(summary.total), icon: Coins, grad: "from-emerald-500 to-teal-600", sub: `${summary.packageCount + summary.productCount} รายการ` },
    { label: "ยอดขายแพ็กเกจ", value: baht(summary.packageTotal), icon: Crown, grad: "from-amber-400 to-orange-600", sub: `${summary.packageCount} รายการ` },
    { label: "ยอดขายสินค้า", value: baht(summary.productTotal), icon: ShoppingBag, grad: "from-fuchsia-500 to-pink-600", sub: `${summary.productCount} รายการ` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="ประวัติการขาย" subtitle="แพ็กเกจ + สินค้า รวมในที่เดียว" icon={Receipt} gradient="from-emerald-400 to-teal-600" />

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`icon-tile rounded-xl p-2.5 bg-gradient-to-br ${c.grad}`}><c.icon className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-display font-extrabold text-gradient truncate">{c.value}</p>
                <p className="text-[11px] text-muted-foreground">{c.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">ถึงวันที่</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" /></div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">ค้นหา (ชื่อ / รหัส / รายการ)</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchSales()} placeholder="ค้นหา..." className="mt-1" />
          </div>
          <Button variant="outline" onClick={fetchSales} className="gap-1.5"><Search className="w-4 h-4" />ค้นหา</Button>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>ไม่มีรายการขายในช่วงที่เลือก</p></div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {sales.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 sm:p-4">
                <div className={`shrink-0 rounded-lg p-2 ${s.kind === "package" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300"}`}>
                  {s.kind === "package" ? <Crown className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{s.memberName}</span>
                    <Badge variant="outline" className="text-[10px]">{s.memberCode}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{baht(s.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(s.date).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })} {new Date(s.date).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
