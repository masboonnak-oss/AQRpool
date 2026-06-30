import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Palette, Save, RotateCcw, Check, Sparkles, CalendarCheck, Type, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { ColorWheel } from "@/components/color-wheel";
import { applyThemeColor, deriveThemeVars, type ThemeColor } from "@/lib/theme-colors";
import { FONTS, FONT_MAP, applyThemeFont, previewFontsHref } from "@/lib/theme-fonts";
import { ImageUpload } from "@/components/image-upload";
import { BrandMark } from "@/components/brand";
import { applyBrandLogo, DEFAULT_LOGO_URL } from "@/lib/brand-logo";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT: ThemeColor = { h: 212, s: 85, l: 33 };
const PRESETS: { name: string; c: ThemeColor }[] = [
  { name: "Aquarich Premium", c: { h: 212, s: 85, l: 33 } },
  { name: "ฟ้าน้ำทะเล", c: { h: 196, s: 90, l: 42 } },
  { name: "น้ำเงิน", c: { h: 222, s: 85, l: 55 } },
  { name: "ม่วง", c: { h: 270, s: 75, l: 58 } },
  { name: "ชมพู", c: { h: 330, s: 80, l: 58 } },
  { name: "แดง", c: { h: 2, s: 80, l: 55 } },
  { name: "ส้ม", c: { h: 24, s: 90, l: 52 } },
  { name: "เหลืองทอง", c: { h: 43, s: 90, l: 50 } },
  { name: "เขียว", c: { h: 150, s: 70, l: 42 } },
  { name: "เขียวมิ้นต์", c: { h: 168, s: 78, l: 42 } },
];

export function AdminTheme() {
  const { toast } = useToast();
  const { isDev } = useAuth();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [color, setColor] = useState<ThemeColor>(DEFAULT);
  const [font, setFont] = useState<string>("default");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<{ color: ThemeColor | null; font: string | null; logoUrl: string | null }>({ color: null, font: null, logoUrl: null });

  // Load current published theme + load all preview fonts so the picker renders correctly.
  useEffect(() => {
    fetch(`${baseUrl}/api/theme`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      savedRef.current = { color: d?.color ?? null, font: d?.font ?? null, logoUrl: d?.logoUrl ?? null };
      if (d?.color) setColor(d.color);
      if (d?.font) setFont(d.font);
      setLogoUrl(d?.logoUrl ?? null);
    }).catch(() => {});

    const url = previewFontsHref();
    let link: HTMLLinkElement | null = null;
    if (url) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
    // On leave: revert live preview back to the published theme + drop the preview fonts.
    return () => {
      applyThemeColor(savedRef.current.color);
      applyThemeFont(savedRef.current.font);
      applyBrandLogo(savedRef.current.logoUrl);
      link?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview as the admin edits.
  useEffect(() => { applyThemeColor(color); }, [color]);
  useEffect(() => { applyThemeFont(font); }, [font]);
  useEffect(() => { applyBrandLogo(logoUrl); }, [logoUrl]);

  const publish = async () => {
    setSaving(true);
    try {
      const body: { color: ThemeColor | null; font: string | null; logoUrl?: string | null } = { color, font };
      if (isDev) body.logoUrl = logoUrl;
      const r = await fetch(`${baseUrl}/api/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      savedRef.current = { color, font, logoUrl: isDev ? logoUrl : savedRef.current.logoUrl };
      toast({ title: "เผยแพร่ธีมแล้ว", description: isDev ? "สี ฟอนต์ และโลโก้จะอัปเดตให้ทุกเครื่องภายในไม่กี่วินาที" : "ทุกเครื่องจะเปลี่ยนสี/ฟอนต์ตามภายในไม่กี่วินาที" });
    } catch {
      toast({ title: "บันทึกไม่สำเร็จ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const resetDefault = async () => {
    setSaving(true);
    try {
      const body: { color: null; font: null; logoUrl?: null } = { color: null, font: null };
      if (isDev) body.logoUrl = null;
      const r = await fetch(`${baseUrl}/api/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      savedRef.current = { color: null, font: null, logoUrl: isDev ? null : savedRef.current.logoUrl };
      setColor(DEFAULT); setFont("default"); if (isDev) setLogoUrl(null);
      applyThemeColor(null); applyThemeFont(null); if (isDev) applyBrandLogo(null);
      toast({ title: "คืนค่าเริ่มต้นแล้ว" });
    } catch {
      toast({ title: "ไม่สำเร็จ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const swatch = `hsl(${color.h} ${color.s}% ${color.l}%)`;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader title="ธีมเว็บไซต์" subtitle="เลือกสีหลักและฟอนต์ของระบบ แล้วเผยแพร่ให้ทุกเครื่องเห็นแบบเรียลไทม์" icon={Palette} gradient="from-fuchsia-500 to-violet-600" />

      {isDev && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              โลโก้เว็บไซต์
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                <ShieldCheck className="h-3 w-3" /> DEV
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                maxMb={2}
                shape="square"
                label="อัปโหลดโลโก้"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={publish} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "กำลังบันทึก..." : "บันทึกและเผยแพร่โลโก้"}
                </Button>
                <Button variant="outline" onClick={() => setLogoUrl(null)} disabled={saving} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  ใช้โลโก้เริ่มต้น
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                รองรับ JPG/PNG/WebP สูงสุด 2MB เมื่อกดบันทึกและเผยแพร่ โลโก้จะอัปเดตให้ทุกหน้าที่ใช้แบรนด์กลางแบบเรียลไทม์
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground">ตัวอย่างโลโก้</div>
              <div className="rounded-md border bg-card p-4">
                <BrandMark size="md" tagline />
              </div>
              <div className="flex items-center gap-3 rounded-md border bg-card p-4">
                <img src={logoUrl || DEFAULT_LOGO_URL} alt="Logo preview" className="h-16 w-16 rounded-md object-contain bg-muted p-1" />
                <div>
                  <div className="font-semibold">Aquarich</div>
                  <div className="text-xs text-muted-foreground">โลโก้ที่จะเผยแพร่</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Picker */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> เลือกสี (ลากบนวงล้อ)</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <ColorWheel value={color} onChange={setColor} />

            <div>
              <p className="text-xs text-muted-foreground mb-2">สีสำเร็จรูป</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const active = p.c.h === color.h && p.c.s === color.s && p.c.l === color.l;
                  return (
                    <button key={p.name} title={p.name} onClick={() => setColor(p.c)}
                      className="w-9 h-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ background: `hsl(${p.c.h} ${p.c.s}% ${p.c.l}%)`, boxShadow: active ? "0 0 0 2px hsl(var(--ring))" : undefined }}>
                      {active && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
              <div className="w-10 h-10 rounded-lg shadow-inner ring-1 ring-border" style={{ background: swatch }} />
              <div className="text-sm">
                <div className="font-medium">สีที่เลือก</div>
                <div className="text-xs text-muted-foreground font-mono">H {color.h}° · S {color.s}% · L {color.l}%</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={publish} disabled={saving} className="flex-1 gap-2 bg-gradient-to-r from-primary to-cyan-500">
                <Save className="w-4 h-4" /> {saving ? "กำลังบันทึก..." : "บันทึก & เผยแพร่"}
              </Button>
              <Button variant="outline" onClick={resetDefault} disabled={saving} className="gap-2">
                <RotateCcw className="w-4 h-4" /> ค่าเริ่มต้น
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">ตัวอย่างจะแสดงสดทันทีบนหน้านี้ · กด "บันทึก & เผยแพร่" เพื่อให้ทุกเครื่อง/สมาชิกเห็นพร้อมกัน</p>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> ตัวอย่างสด</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl p-5 text-white bg-brand bg-brand-animated sheen shadow-lg">
              <div className="text-lg font-display font-extrabold">Aquarich</div>
              <div className="text-sm text-white/85">ระบบจองสระว่ายน้ำ</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="gap-1.5"><CalendarCheck className="w-4 h-4" /> ปุ่มหลัก</Button>
              <Button variant="outline">ปุ่มรอง</Button>
              <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">ป้ายสถานะ</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["--brand-from", "--brand-via", "--brand-to"].map((v) => (
                <div key={v} className="h-14 rounded-xl ring-1 ring-border" style={{ background: `hsl(${deriveThemeVars(color)[v]})` }} />
              ))}
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="font-semibold mb-1">การ์ดตัวอย่าง</div>
              <p className="text-sm text-muted-foreground">ลิงก์ <a className="text-primary font-medium">ดูเพิ่มเติม</a> และข้อความตัวอย่างเพื่อดูสีหลักที่เลือก</p>
              <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-primary to-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Font picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Type className="w-4 h-4 text-primary" /> ฟอนต์ของเว็บไซต์</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">เลือกฟอนต์สไตล์หรูหรา/ทางการ (รองรับภาษาไทย) — กดเลือกเพื่อดูตัวอย่างสด แล้วกด "บันทึก &amp; เผยแพร่" ด้านบน</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FONTS.map((f) => {
              const active = f.key === font;
              return (
                <button
                  key={f.key}
                  onClick={() => setFont(f.key)}
                  className={
                    "text-left rounded-2xl border p-4 transition-all hover:border-primary/60 " +
                    (active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="text-2xl font-extrabold mt-1 leading-tight" style={{ fontFamily: f.display }}>Aquarich</div>
                  <div className="text-sm mt-0.5" style={{ fontFamily: f.sans }}>จองสระว่ายน้ำ ง่ายทุกที่ทุกเวลา 0123</div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">{f.note}</div>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">ฟอนต์ที่ใช้อยู่: <span className="font-semibold text-foreground">{FONT_MAP[font]?.label ?? "ค่าเริ่มต้น"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
