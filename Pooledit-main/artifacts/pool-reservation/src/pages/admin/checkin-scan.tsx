import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, CameraOff, UserCheck, CheckCircle2, XCircle, Ticket, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/member-avatar";

type LookupPackage = {
  memberPackageId: number;
  packageId: number;
  name: string;
  endDate: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  canUse: boolean;
};

type LookupData = {
  code: string;
  user: { id: number; firstName: string; lastName: string; houseNumber: string | null; profileImageUrl?: string | null };
  hasQuota: boolean;
  totalRemaining: number | null;
  packageName: string | null;
  packages?: LookupPackage[];
};

type ResultData = {
  ok: boolean;
  message: string;
  user?: { firstName: string; lastName: string };
  remainingAfter?: number | null;
  packageName?: string | null;
};

type Candidate = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  houseNumber: string | null;
  profileImageUrl?: string | null;
};

const ELEMENT_ID = "qr-reader";

export function AdminCheckinScan() {
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { toast } = useToast();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [lookup, setLookup] = useState<LookupData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [selectedMemberPackageId, setSelectedMemberPackageId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function stopScanner() {
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); } catch { /* already stopped */ }
      try { await s.clear(); } catch { /* noop */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => { void stopScanner(); };
  }, []);

  async function startScanner() {
    setResult(null);
    setLookup(null);
    setCandidates(null);
    setSelectedMemberPackageId(null);
    try {
      const s = new Html5Qrcode(ELEMENT_ID);
      scannerRef.current = s;
      setScanning(true);
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await stopScanner();
          void doLookup(decoded);
        },
        () => { /* ignore per-frame decode errors */ },
      );
    } catch {
      setScanning(false);
      toast({
        title: "เปิดกล้องไม่ได้",
        description: "อนุญาตการใช้กล้อง หรือใช้การกรอกรหัสด้านล่าง",
        variant: "destructive",
      });
    }
  }

  // Shared lookup: `query` is the lookup querystring, `code` is what the later POST /checkin
  // uses to re-resolve the member (their phone/ART code — both resolvable server-side).
  async function fetchLookup(query: string, code: string) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/checkin/lookup?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setLookup(null);
        setSelectedMemberPackageId(null);
        toast({ title: "ไม่พบสมาชิก", description: data.error, variant: "destructive" });
      } else {
        setCandidates(null);
        const packages = (data.packages ?? []) as LookupPackage[];
        setLookup({ ...data, code, packages });
        setSelectedMemberPackageId(packages.find((p) => p.canUse)?.memberPackageId ?? null);
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  // QR scan path: resolve directly by the scanned token.
  function doLookup(code: string) {
    const c = code.trim();
    if (!c) return;
    return fetchLookup(`token=${encodeURIComponent(c)}`, c);
  }

  // Admin picks a candidate from the name/phone search.
  function doLookupById(c: Candidate) {
    return fetchLookup(`memberId=${c.id}`, c.code);
  }

  // Manual search box: name / phone / member code → candidate list (1 result auto-opens).
  async function doSearch(q: string) {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setResult(null);
    setLookup(null);
    try {
      const res = await fetch(`${baseUrl}/api/checkin/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const members = (data.members ?? []) as Candidate[];
      if (members.length === 0) {
        setCandidates(null);
        toast({ title: "ไม่พบสมาชิก", description: "ลองค้นด้วยเบอร์โทร ชื่อจริง หรือรหัสสมาชิก", variant: "destructive" });
      } else if (members.length === 1) {
        await doLookupById(members[0]);
      } else {
        setCandidates(members);
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmCheckin() {
    if (!lookup?.code || !selectedMemberPackageId) return;
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: lookup.code, memberPackageId: selectedMemberPackageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error, user: data.user });
      } else {
        setResult({ ok: true, message: data.message, user: data.user, remainingAfter: data.remainingAfter, packageName: data.packageName });
      }
      setLookup(null);
      setSelectedMemberPackageId(null);
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const lookupPackages = lookup?.packages ?? [];
  const selectedPackage = lookupPackages.find((p) => p.memberPackageId === selectedMemberPackageId) ?? null;

  return (
    <div className="mx-auto max-w-md space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-gradient flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" /> สแกนเช็คอิน
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          สแกน QR ของสมาชิก เลือกคอร์สที่ต้องการ แล้วระบบจะหักสิทธิ์ 1 ครั้งจากคอร์สนั้นเท่านั้น
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div id={ELEMENT_ID} className={cn("w-full rounded-xl overflow-hidden bg-black/90 mx-auto", !scanning && "hidden")} />
          {!scanning && (
            <div className="aspect-square w-full rounded-xl bg-muted/50 border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Camera className="w-10 h-10 opacity-40" />
              <span className="text-sm">กดเปิดกล้องเพื่อเริ่มสแกน</span>
            </div>
          )}
          {scanning ? (
            <Button variant="outline" className="w-full gap-2" onClick={() => void stopScanner()}>
              <CameraOff className="w-4 h-4" /> ปิดกล้อง
            </Button>
          ) : (
            <Button className="w-full gap-2" onClick={() => void startScanner()}>
              <Camera className="w-4 h-4" /> เปิดกล้องสแกน
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ค้นหาด้วยชื่อจริง / เบอร์โทร / รหัสสมาชิก
          </label>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="เช่น สมชาย, 0812345678, ART00027"
              inputMode="search"
              onKeyDown={(e) => e.key === "Enter" && doSearch(manual)}
            />
            <Button variant="outline" disabled={busy || !manual.trim()} onClick={() => doSearch(manual)} className="gap-1.5 shrink-0">
              <Search className="w-4 h-4" /> ค้นหา
            </Button>
          </div>
        </CardContent>
      </Card>

      {candidates && candidates.length > 0 && !lookup && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              พบ {candidates.length} คน — เลือกสมาชิก
            </div>
            <div className="grid gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => doLookupById(c)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                >
                  <MemberAvatar firstName={c.firstName} lastName={c.lastName} src={c.profileImageUrl} className="w-10 h-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{c.firstName} {c.lastName}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.phone || c.code}{c.houseNumber ? ` · บ้าน ${c.houseNumber}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lookup && (
        <Card className="rounded-2xl border-primary/40 ring-2 ring-primary/10">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <MemberAvatar firstName={lookup.user.firstName} lastName={lookup.user.lastName} src={lookup.user.profileImageUrl} className="w-12 h-12 text-base" />
              <div className="flex-1">
                <div className="font-bold text-lg">{lookup.user.firstName} {lookup.user.lastName}</div>
                <div className="text-xs text-muted-foreground">บ้านเลขที่ {lookup.user.houseNumber ?? "-"}</div>
              </div>
            </div>

            <div className="rounded-xl bg-secondary/40 p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{lookup.packageName ?? "ไม่มีแพ็กเกจ"}</span>
              <span className={cn("font-bold", lookup.hasQuota ? "text-primary" : "text-destructive")}>
                คงเหลือ {lookup.totalRemaining === null ? "ไม่จำกัด" : `${lookup.totalRemaining} ครั้ง`}
              </span>
            </div>

            {lookupPackages.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">เลือกคอร์สที่จะตัด</div>
                <div className="grid gap-2">
                  {lookupPackages.map((pkg) => {
                    const active = selectedMemberPackageId === pkg.memberPackageId;
                    return (
                      <button
                        key={pkg.memberPackageId}
                        type="button"
                        disabled={!pkg.canUse}
                        onClick={() => setSelectedMemberPackageId(pkg.memberPackageId)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-all",
                          active ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/50",
                          !pkg.canUse && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold">{pkg.name}</div>
                            <div className="text-xs text-muted-foreground">
                              หมดอายุ {new Date(pkg.endDate).toLocaleDateString("th-TH")}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                            {pkg.remaining === null ? "ไม่จำกัด" : `เหลือ ${pkg.remaining}`}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          ใช้ไป {pkg.used}/{pkg.quota ?? "∞"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedPackage && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                จะตัดคอร์ส: <span className="font-bold">{selectedPackage.name}</span>
              </div>
            )}

            <Button className="w-full gap-2 min-h-[48px]" disabled={busy || !lookup.hasQuota || !selectedMemberPackageId} onClick={confirmCheckin}>
              <UserCheck className="w-5 h-5" /> {lookup.hasQuota ? "ยืนยันเช็คอิน (หัก 1 ครั้ง)" : "ไม่มีสิทธิ์คงเหลือ"}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={cn("rounded-2xl", result.ok ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-destructive/40 bg-destructive/5")}>
          <CardContent className="p-5 text-center space-y-2">
            {result.ok ? <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" /> : <XCircle className="w-12 h-12 text-destructive mx-auto" />}
            <div className="font-bold text-lg">{result.message}</div>
            {result.user && <div className="text-sm">{result.user.firstName} {result.user.lastName}</div>}
            {result.ok && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                <Ticket className="w-4 h-4" /> คงเหลือ {result.remainingAfter === null ? "ไม่จำกัด" : `${result.remainingAfter} ครั้ง`}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
