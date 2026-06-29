import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tags, Check, X } from "lucide-react";

export type Category = {
  id: number;
  name: string;
  nameEn?: string | null;
  sortOrder: number;
  isActive: boolean;
  packageCount?: number;
};

type RowForm = { name: string; nameEn: string; sortOrder: number; isActive: boolean };

const emptyRow = (): RowForm => ({ name: "", nameEn: "", sortOrder: 0, isActive: true });

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onChanged: () => void;
};

// Admin CRUD for "หมวดหมู่แพ็กเกจ". Deleting a category leaves its packages intact but
// uncategorised (server sets category_id -> null), so the parent refetches packages too.
export const PackageCategoriesDialog: FC<Props> = ({ open, onOpenChange, categories, onChanged }) => {
  const { toast } = useToast();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<RowForm>(emptyRow());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startAdd = () => { setForm(emptyRow()); setEditId("new"); };
  const startEdit = (c: Category) => { setForm({ name: c.name, nameEn: c.nameEn || "", sortOrder: c.sortOrder, isActive: c.isActive }); setEditId(c.id); };
  const cancelEdit = () => { setEditId(null); setForm(emptyRow()); };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "กรุณาระบุชื่อหมวดหมู่", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const isNew = editId === "new";
      const url = isNew ? `${baseUrl}/api/package-categories` : `${baseUrl}/api/package-categories/${editId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name.trim(), nameEn: form.nameEn.trim(), sortOrder: form.sortOrder, isActive: form.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isNew ? "เพิ่มหมวดหมู่แล้ว" : "อัปเดตหมวดหมู่แล้ว" });
      cancelEdit();
      onChanged();
    } catch { toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/api/package-categories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "ลบหมวดหมู่แล้ว" });
      setDeleteTarget(null);
      onChanged();
    } catch { toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const renderRowForm = () => (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/40">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ชื่อ (ไทย)</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1" /></div>
        <div><Label>ชื่อ (English)</Label><Input value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} className="mt-1" /></div>
      </div>
      <div className="flex items-end gap-4">
        <div className="w-28"><Label>ลำดับ</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} className="mt-1" /></div>
        <div className="flex items-center gap-2 pb-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} /><Label>เปิดใช้งาน</Label></div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="w-4 h-4 mr-1" />ยกเลิก</Button>
          <Button size="sm" onClick={save} disabled={saving}><Check className="w-4 h-4 mr-1" />{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) cancelEdit(); onOpenChange(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tags className="w-5 h-5" />จัดการหมวดหมู่แพ็กเกจ</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {categories.length === 0 && editId !== "new" && (
              <p className="text-center text-sm text-muted-foreground py-6">ยังไม่มีหมวดหมู่</p>
            )}

            {categories.map((c) => (
              editId === c.id ? (
                <div key={c.id}>{renderRowForm()}</div>
              ) : (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      {!c.isActive && <Badge variant="secondary">ปิด</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.nameEn || "—"} · {c.packageCount ?? 0} แพ็กเกจ</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              )
            ))}

            {editId === "new" ? renderRowForm() : (
              <Button variant="outline" className="w-full mt-2" onClick={startAdd}><Plus className="w-4 h-4 mr-2" />เพิ่มหมวดหมู่</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหมวดหมู่</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบ <span className="font-semibold">{deleteTarget?.name}</span>?
              {!!deleteTarget?.packageCount && <> แพ็กเกจ {deleteTarget.packageCount} รายการจะกลายเป็น "ไม่ระบุหมวดหมู่" (ไม่ถูกลบ)</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting}>{deleting ? "กำลังลบ..." : "ลบ"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
