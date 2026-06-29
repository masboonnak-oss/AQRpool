import { FC, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { Ticket, Plus, Pencil, Trash2 } from "lucide-react";

type Coupon = {
  id: number; code: string; description?: string | null; discountType: "percent" | "fixed";
  discountValue: number; maxDiscount: number | null; minPurchase: number; usageLimit: number | null;
  usedCount: number; perUserLimit: number; isActive: boolean; expiresAt: string | null;
};

type Form = {
  code: string; description: string; discountType: "percent" | "fixed"; discountValue: string;
  maxDiscount: string; minPurchase: string; usageLimit: string; perUserLimit: string; isActive: boolean; expiresAt: string;
};

const empty = (): Form => ({
  code: "", description: "", discountType: "percent", discountValue: "", maxDiscount: "",
  minPurchase: "0", usageLimit: "", perUserLimit: "1", isActive: true, expiresAt: "",
});

export const AdminCoupons: FC = () => {
  const { toast } = useToast();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"" | "add" | "edit">("");
  const [form, setForm] = useState<Form>(empty());
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const fetchCoupons = async () => {
    setLoading(true);
    const res = await fetch(`${baseUrl}/api/coupons/all`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCoupons(await res.json());
    setLoading(false);
  };
  useEffect(() => { fetchCoupons(); }, []);

  const openAdd = () => { setForm(empty()); setEditId(null); setDialog("add"); };
  const openEdit = (c: Coupon) => {
    setForm({
      code: c.code, description: c.description || "", discountType: c.discountType,
      discountValue: String(c.discountValue), maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      minPurchase: String(c.minPurchase), usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      perUserLimit: String(c.perUserLimit), isActive: c.isActive,
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    });
    setEditId(c.id); setDialog("edit");
  };

  const save = async () => {
    if (!form.code.trim() || !form.discountValue) { toast({ title: "กรอกโค้ดและมูลค่าส่วนลด", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        code: form.code, description: form.description, discountType: form.discountType,
        discountValue: Number(form.discountValue), maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
        minPurchase: Number(form.minPurchase || 0), usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit || 1), isActive: form.isActive,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      const url = dialog === "edit" ? `${baseUrl}/api/coupons/${editId}` : `${baseUrl}/api/coupons`;
      const res = await fetch(url, {
        method: dialog === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: dialog === "edit" ? "อัปเดตคูปองแล้ว" : "เพิ่มคูปองแล้ว" });
      setDialog("");
      fetchCoupons();
    } catch (e: any) { toast({ title: e.message || "เกิดข้อผิดพลาด", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`${baseUrl}/api/coupons/${deleteTarget.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { toast({ title: "ลบคูปองแล้ว" }); setDeleteTarget(null); fetchCoupons(); }
    else toast({ title: "ลบไม่สำเร็จ", variant: "destructive" });
  };

  const fmtDiscount = (c: Coupon) => c.discountType === "percent" ? `${c.discountValue}%${c.maxDiscount ? ` (สูงสุด ฿${c.maxDiscount.toLocaleString()})` : ""}` : `฿${c.discountValue.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="คูปองส่วนลด"
        icon={Ticket}
        gradient="from-emerald-400 to-teal-600"
        actions={<Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />เพิ่มคูปอง</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>ยังไม่มีคูปอง</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
            const used = c.usageLimit != null && c.usedCount >= c.usageLimit;
            return (
              <Card key={c.id} className={!c.isActive || expired || used ? "opacity-60" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-lg tracking-wide truncate">{c.code}</div>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                    <Badge variant={c.isActive && !expired && !used ? "default" : "secondary"}>
                      {expired ? "หมดอายุ" : used ? "ใช้ครบ" : c.isActive ? "ใช้งาน" : "ปิด"}
                    </Badge>
                  </div>
                  <div className="text-2xl font-display font-extrabold text-gradient">ลด {fmtDiscount(c)}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {c.minPurchase > 0 && <div>ขั้นต่ำ ฿{c.minPurchase.toLocaleString()}</div>}
                    <div>ใช้ไปแล้ว {c.usedCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""} ครั้ง · {c.perUserLimit}/คน</div>
                    {c.expiresAt && <div>หมดอายุ {new Date(c.expiresAt).toLocaleDateString("th-TH")}</div>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}><Pencil className="w-3 h-3 mr-1" />แก้ไข</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialog !== ""} onOpenChange={() => setDialog("")}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog === "edit" ? "แก้ไขคูปอง" : "เพิ่มคูปอง"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>โค้ด</Label><Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="เช่น NEWYEAR2026" className="mt-1 font-mono" /></div>
            <div><Label>คำอธิบาย</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภท</Label>
                <Select value={form.discountType} onValueChange={(v) => setForm((p) => ({ ...p, discountType: v as "percent" | "fixed" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">เปอร์เซ็นต์ (%)</SelectItem>
                    <SelectItem value="fixed">จำนวนเงิน (฿)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>มูลค่าส่วนลด</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} className="mt-1" /></div>
            </div>
            {form.discountType === "percent" && (
              <div><Label>ส่วนลดสูงสุด (฿) — เว้นว่าง = ไม่จำกัด</Label><Input type="number" value={form.maxDiscount} onChange={(e) => setForm((p) => ({ ...p, maxDiscount: e.target.value }))} className="mt-1" /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ยอดซื้อขั้นต่ำ (฿)</Label><Input type="number" value={form.minPurchase} onChange={(e) => setForm((p) => ({ ...p, minPurchase: e.target.value }))} className="mt-1" /></div>
              <div><Label>จำกัดต่อคน</Label><Input type="number" value={form.perUserLimit} onChange={(e) => setForm((p) => ({ ...p, perUserLimit: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>จำนวนครั้งทั้งหมด — เว้นว่าง = ไม่จำกัด</Label><Input type="number" value={form.usageLimit} onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))} className="mt-1" /></div>
              <div><Label>วันหมดอายุ</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} /><Label>เปิดใช้งาน</Label></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialog("")}>ยกเลิก</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบคูปอง</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบโค้ด <span className="font-mono font-semibold">{deleteTarget?.code}</span>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDelete(); }}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
