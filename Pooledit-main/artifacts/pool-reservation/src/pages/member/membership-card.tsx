import { FC, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ticket, QrCode, CalendarClock, Sparkles, ShieldCheck, BadgePercent, Check, Crown, Download, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv, csvStamp } from "@/lib/export-csv";
import { tierTheme } from "@/lib/membership-tiers";
import { TierCard, type TierInfo } from "@/components/membership/tier-card";

type UsagePackage = {
  memberPackageId: number;
  name: string;
  endDate: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  bookingDiscount: number;
  benefits: string[];
};
type Usage = {
  hasActivePackage: boolean;
  hasQuota: boolean;
  totalRemaining: number | null;
  bestDiscount: number;
  tier?: TierInfo;
  points?: number;
  benefits: string[];
  packages: UsagePackage[];
};
type MyPackage = {
  id: number;
  pricePaid: number;
  bookingsUsed: number;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  isExpired: boolean;
  package: {
    name: string;
    maxBookingsPerMonth: number | null;
    price: number;
  };
};

export const MembershipCard: FC = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: code } = useQuery<{ token: string }>({
    queryKey: ["checkin", "my-code"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/checkin/my-code`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { token: "" };
      return res.json();
    },
  });

  const { data: usage } = useQuery<Usage>({
    queryKey: ["packages", "my-usage"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/packages/my-usage`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { hasActivePackage: false, hasQuota: false, totalRemaining: 0, bestDiscount: 0, benefits: [], packages: [] };
      return res.json();
    },
  });
  const { data: myPackages = [] } = useQuery<MyPackage[]>({
    queryKey: ["packages", "my"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/packages/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const remaining = usage?.totalRemaining ?? null;
  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "U";
  const tier = usage?.tier;
  const theme = tierTheme(tier?.id);
  const exportPackages = () => {
    downloadCsv(`my-course-history-${csvStamp()}.csv`, [
      ["คอร์ส", "วันที่เติม", "วันเริ่ม", "วันหมดอายุ", "ใช้ไป", "โควตา", "ยอดชำระ", "สถานะ"],
      ...myPackages.map((p) => [
        p.package.name,
        new Date(p.createdAt).toLocaleString("th-TH"),
        new Date(p.startDate).toLocaleDateString("th-TH"),
        new Date(p.endDate).toLocaleDateString("th-TH"),
        p.bookingsUsed,
        p.package.maxBookingsPerMonth ?? "ไม่จำกัด",
        p.pricePaid,
        p.status,
      ]),
    ]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setLocation("/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92dvh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>บัตรสมาชิก</DialogTitle>
        </DialogHeader>
    <div className="bg-background pb-6">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-cyan-50/50 to-background dark:from-primary/20 dark:via-cyan-900/20 dark:to-background py-10 px-4">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -top-6 -right-12 w-44 h-44 rounded-full bg-primary/15 blur-3xl" />
        <Waves className="absolute bottom-1 right-4 w-20 h-20 text-primary/10" strokeWidth={1.2} />
        <div className="max-w-md mx-auto text-center space-y-1 relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-600">
            บัตรสมาชิก
          </h1>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
            <QrCode className="w-4 h-4 text-cyan-500" /> ให้แอดมินสแกน QR เพื่อเช็คอิน
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-2 space-y-6">
        {/* Premium loyalty-rank card — the showpiece */}
        {tier && (
          <TierCard
            theme={theme}
            tier={tier}
            name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "สมาชิก"}
            memberCode={(user as any)?.memberCode}
            initials={initials}
            points={usage?.points}
          />
        )}

        {/* Rank perks / สิทธิพิเศษตามแรงค์ */}
        {tier && (
          <Card className="rounded-2xl overflow-hidden border-border/60">
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: theme.surface, color: theme.ink }}>
              <theme.Icon className="w-4 h-4" />
              <span className="font-bold text-sm">สิทธิพิเศษแรงค์ {theme.label}</span>
            </div>
            <CardContent className="p-5">
              <ul className="space-y-2">
                {theme.perks.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: `hsl(var(--primary))` }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Member QR card — premium themed header */}
        <Card className="overflow-hidden rounded-3xl border-border/60 shadow-xl">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-cyan-500 to-blue-600 p-5 text-white">
            {/* decorative water + glow */}
            <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <Waves className="absolute -bottom-3 right-2 w-28 h-28 text-white/10" strokeWidth={1.2} />
            <div className="relative">
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-widest uppercase text-white/85">
                <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Aquarich Member</span>
                <span className="flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-300" /> {usage?.hasActivePackage ? "Active" : "Member"}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {/* chip */}
                <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 ring-1 ring-white/40 shrink-0" />
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold border-2 border-white/40">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-lg truncate">{user?.firstName} {user?.lastName}</div>
                  <div className="text-white/85 text-xs font-mono tracking-wider">{(user as any)?.memberCode ?? ""}</div>
                </div>
                <Ticket className="w-7 h-7 ml-auto opacity-80" />
              </div>
            </div>
          </div>

          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="p-4 bg-white rounded-2xl shadow-inner ring-1 ring-border">
              {code?.token ? (
                <QRCodeSVG value={code.token} size={208} level="M" includeMargin={false} />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              )}
            </div>

            <div className="mt-6 w-full rounded-2xl bg-secondary/40 p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">จำนวนครั้งคงเหลือ</div>
              <div className={cn("text-5xl font-extrabold mt-1", usage?.hasQuota ? "text-primary" : "text-destructive")}>
                {remaining === null ? "∞" : remaining}
                {remaining !== null && <span className="text-xl font-bold text-muted-foreground"> ครั้ง</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Member benefits / สิทธิพิเศษสมาชิก */}
        {usage && usage.hasActivePackage && (usage.benefits.length > 0 || usage.bestDiscount > 0) && (
          <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 to-cyan-50/40 dark:from-primary/10 dark:to-cyan-900/10">
            <CardContent className="p-5 space-y-3">
              <h2 className="font-bold flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" /> สิทธิพิเศษสมาชิก
              </h2>
              {usage.bestDiscount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <BadgePercent className="w-4 h-4 shrink-0" />
                  ส่วนลดค่าจอง {usage.bestDiscount}%
                </div>
              )}
              {usage.benefits.length > 0 && (
                <ul className="space-y-1.5">
                  {usage.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Packages */}
        {usage && usage.packages.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> แพ็กเกจของฉัน</h2>
            {usage.packages.map((p) => (
              <Card key={p.memberPackageId} className="rounded-2xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" />
                      หมดอายุ {new Date(p.endDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    {p.bookingDiscount > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <BadgePercent className="w-3.5 h-3.5" /> ลดค่าจอง {p.bookingDiscount}%
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{p.remaining === null ? "∞" : p.remaining}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.quota === null ? "ไม่จำกัด" : `ใช้ไป ${p.used}/${p.quota}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground space-y-3">
              <Ticket className="w-10 h-10 mx-auto opacity-40" />
              <p>คุณยังไม่มีแพ็กเกจที่ใช้งานได้</p>
              <Button onClick={() => setLocation("/packages")} className="rounded-full gap-1.5">
                <Ticket className="w-4 h-4" /> ดูแพ็กเกจ
              </Button>
            </CardContent>
          </Card>
        )}

        {myPackages.length > 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> ประวัติคอร์สทั้งหมด</h2>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={exportPackages}>
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                </Button>
              </div>
              <div className="space-y-2">
                {myPackages.map((p) => (
                  <div key={p.id} className="rounded-xl bg-secondary/40 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{p.package.name}</div>
                      <div className="text-xs text-muted-foreground">
                        เติม {new Date(p.createdAt).toLocaleDateString("th-TH")} • หมดอายุ {new Date(p.endDate).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn("text-xs font-semibold", p.status === "active" && !p.isExpired ? "text-emerald-600" : "text-muted-foreground")}>
                        {p.status === "active" && !p.isExpired ? "ใช้งานได้" : "หมดอายุ"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">ใช้ไป {p.bookingsUsed}/{p.package.maxBookingsPerMonth ?? "∞"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
      </DialogContent>
    </Dialog>
  );
};
