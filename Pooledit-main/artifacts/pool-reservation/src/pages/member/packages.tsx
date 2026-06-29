import { FC, useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Crown, CheckCircle2, Calendar, Zap, ShoppingBag, BadgePercent, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { tierTheme } from "@/lib/membership-tiers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Package = { id: number; name: string; nameEn: string; description?: string; imageUrl?: string | null; price: number; durationDays: number; benefits?: string; bookingDiscount: number; maxBookingsPerMonth?: number; isActive: boolean; categoryId?: number | null };
type MemberPackage = { id: number; packageId: number; pricePaid: number; status: string; startDate: string; endDate: string; isExpired: boolean; package: Package };
type Tier = { id: string; label: string; discount: number };
type Category = { id: number; name: string };

export const Packages: FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [myPackages, setMyPackages] = useState<MemberPackage[]>([]);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyPkg, setBuyPkg] = useState<Package | null>(null);
  const [buying, setBuying] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; finalPrice: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [pkRes, myRes, wRes, uRes, catRes] = await Promise.all([
      fetch(`${baseUrl}/api/packages`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/api/packages/my`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/api/wallet/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/api/packages/my-usage`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/api/package-categories`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (pkRes.ok) setPackages(await pkRes.json());
    if (myRes.ok) setMyPackages(await myRes.json());
    if (wRes.ok) setWallet(await wRes.json());
    if (uRes.ok) { const u = await uRes.json(); setTier(u.tier ?? null); }
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const categoryName = (id?: number | null) => categories.find((c) => c.id === id)?.name;

  // Rank discount applied at purchase (server-enforced; shown here for transparency).
  const tierDiscount = tier?.discount ?? 0;
  const priceAfter = (p: number) => Math.round(p * (1 - tierDiscount / 100));

  const openBuy = (pkg: Package) => {
    setBuyPkg(pkg);
    setCouponInput(""); setCoupon(null); setCouponError("");
  };

  // Charge = tier price minus any validated coupon.
  const chargeFor = (pkg: Package) => coupon ? coupon.finalPrice : priceAfter(pkg.price);

  const applyCoupon = async () => {
    if (!buyPkg || !couponInput.trim()) return;
    setCheckingCoupon(true); setCouponError("");
    try {
      const res = await fetch(`${baseUrl}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: couponInput, subtotal: priceAfter(buyPkg.price) }),
      });
      const d = await res.json();
      if (d.valid) { setCoupon({ code: d.code, discount: d.discount, finalPrice: d.finalPrice }); setCouponError(""); }
      else { setCoupon(null); setCouponError(d.error || "โค้ดไม่ถูกต้อง"); }
    } catch { setCouponError("ตรวจสอบโค้ดไม่สำเร็จ"); }
    finally { setCheckingCoupon(false); }
  };

  const handleBuy = async () => {
    if (!buyPkg) return;
    setBuying(true);
    try {
      const res = await fetch(`${baseUrl}/api/packages/${buyPkg.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(coupon ? { couponCode: coupon.code } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: t("pkg.purchaseSuccess") });
      fetchAll();
    } catch (err: any) {
      toast({ title: err.message.includes("ไม่เพียงพอ") ? t("pkg.insufficientBalance") : err.message, variant: "destructive" });
    } finally {
      setBuying(false);
      setBuyPkg(null);
    }
  };

  const activePackage = myPackages.find(mp => mp.status === "active" && !mp.isExpired);

  if (loading) return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-6 space-y-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t("pkg.title")} icon={Crown} gradient="from-amber-400 to-orange-600" />

      {/* Rank discount banner */}
      {tier && tierDiscount > 0 && (() => {
        const th = tierTheme(tier.id);
        const Icon = th.Icon;
        return (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3 text-sm font-semibold" style={{ background: th.surface, color: th.ink }}>
            <Icon className="w-5 h-5 shrink-0" />
            <span>สิทธิ์แรงค์ {th.label} — รับส่วนลดซื้อคอร์ส/แพ็กเกจทุกชิ้น {tierDiscount}% โดยอัตโนมัติ</span>
          </div>
        );
      })()}

      {/* Active package banner */}
      {activePackage && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-300/60 dark:border-amber-400/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="icon-tile rounded-xl p-2.5 bg-gradient-to-br from-amber-400 to-orange-600"><Crown className="w-5 h-5" /></div>
            <div className="flex-1">
              <p className="font-semibold">{activePackage.package.name}</p>
              <p className="text-sm text-muted-foreground">{t("pkg.expires")}: {new Date(activePackage.endDate).toLocaleDateString("th-TH")}</p>
            </div>
            <Badge className="bg-amber-500 text-white">{t("pkg.active")}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Available packages */}
      <div className="grid sm:grid-cols-2 gap-4">
        {packages.length === 0 ? (
          <p className="text-muted-foreground col-span-2 text-center py-12">{t("pkg.noPackages")}</p>
        ) : packages.map(pkg => {
          const owned = myPackages.find(mp => mp.packageId === pkg.id && mp.status === "active" && !mp.isExpired);
          return (
            <Card key={pkg.id} className={cn("card-lift relative overflow-hidden", owned && "ring-2 ring-amber-400")}>
              {/* corner wash for depth */}
              <div className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 opacity-10 blur-2xl" />
              {owned && <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3 py-1 rounded-bl-lg shadow-sm z-10">มีอยู่แล้ว</div>}
              {pkg.imageUrl && <img src={pkg.imageUrl} alt={pkg.name} className="h-40 w-full object-cover" />}
              <CardContent className="p-6 space-y-4 relative">
                <div>
                  {categoryName(pkg.categoryId) && (
                    <Badge variant="outline" className="mb-1.5 gap-1"><Tags className="w-3 h-3" />{categoryName(pkg.categoryId)}</Badge>
                  )}
                  <h3 className="text-lg font-display font-bold">{pkg.name}</h3>
                  {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-3xl font-display font-extrabold text-gradient">฿{priceAfter(pkg.price).toLocaleString()}</span>
                  {tierDiscount > 0 && (
                    <>
                      <span className="text-base text-muted-foreground line-through mb-1">฿{pkg.price.toLocaleString()}</span>
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-bold">
                        <BadgePercent className="w-3 h-3" /> ลด {tierDiscount}%
                      </span>
                    </>
                  )}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />{pkg.durationDays} {t("pkg.days")}
                  </div>
                  {pkg.bookingDiscount > 0 && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Zap className="w-4 h-4" />ส่วนลดค่าจอง {pkg.bookingDiscount}%
                    </div>
                  )}
                  {pkg.maxBookingsPerMonth && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4" />จองได้สูงสุด {pkg.maxBookingsPerMonth} ครั้ง/เดือน
                    </div>
                  )}
                  {pkg.benefits && pkg.benefits.split("\n").map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />{b}
                    </div>
                  ))}
                </div>
                {!owned && (
                  <Button className="w-full" onClick={() => openBuy(pkg)}>
                    <ShoppingBag className="w-4 h-4 mr-2" />{t("pkg.buy")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Purchase dialog */}
      <AlertDialog open={!!buyPkg} onOpenChange={() => setBuyPkg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการซื้อแพ็กเกจ</AlertDialogTitle>
            <AlertDialogDescription>{buyPkg?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          {buyPkg && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-primary">฿{chargeFor(buyPkg).toLocaleString()}</span>
                {(buyPkg.price - chargeFor(buyPkg)) > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">฿{buyPkg.price.toLocaleString()}</span>
                    <span className="text-xs font-bold text-emerald-600">ประหยัด ฿{(buyPkg.price - chargeFor(buyPkg)).toLocaleString()}</span>
                  </>
                )}
              </div>

              {/* Discount coupon */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="โค้ดส่วนลด (ถ้ามี)"
                    className="font-mono"
                    disabled={!!coupon}
                  />
                  {coupon ? (
                    <Button type="button" variant="outline" onClick={() => { setCoupon(null); setCouponInput(""); setCouponError(""); }}>ลบ</Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>{checkingCoupon ? "..." : "ใช้โค้ด"}</Button>
                  )}
                </div>
                {coupon && <p className="text-xs font-semibold text-emerald-600">✓ ใช้โค้ด {coupon.code} — ลด ฿{coupon.discount.toLocaleString()}</p>}
                {couponError && <p className="text-xs text-red-500">{couponError}</p>}
              </div>

              <p className="text-sm">ยอดเงินคงเหลือ: ฿{(wallet?.balance ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
              {wallet && wallet.balance < chargeFor(buyPkg) && (
                <p className="text-red-500 text-sm">ยอดเงินไม่พอ กรุณาเติมเงินก่อน</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleBuy} disabled={buying || (wallet && buyPkg ? wallet.balance < chargeFor(buyPkg) : false)}>
              {buying ? "กำลังซื้อ..." : "ยืนยันซื้อ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
