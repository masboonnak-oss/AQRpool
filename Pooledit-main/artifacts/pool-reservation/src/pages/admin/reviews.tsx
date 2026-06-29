import { FC, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, MessageSquareQuote, Trash2, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

type Review = { id: number; userId: number; rating: number; comment: string | null; reply: string | null; isPublished: boolean; createdAt: string; reviewer?: string; avatarUrl?: string | null };

const Stars: FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("w-4 h-4", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />)}
  </div>
);

export const AdminReviews: FC = () => {
  const { toast } = useToast();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    const res = await fetch(`${baseUrl}/api/reviews/all`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const patch = async (id: number, body: Record<string, unknown>, okMsg: string) => {
    const res = await fetch(`${baseUrl}/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) { toast({ title: okMsg }); fetchReviews(); }
    else toast({ title: "ทำรายการไม่สำเร็จ", variant: "destructive" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/api/reviews/${deleteTarget.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      toast({ title: "ลบรีวิวแล้ว" });
      setDeleteTarget(null);
      fetchReviews();
    } catch { toast({ title: "ลบไม่สำเร็จ", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="รีวิวและเรตติ้ง"
        subtitle={`${reviews.length} รีวิว · เฉลี่ย ${avg.toFixed(1)} ดาว`}
        icon={MessageSquareQuote}
        gradient="from-amber-400 to-orange-500"
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">ยังไม่มีรีวิว</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className={!r.isPublished ? "opacity-70" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                    {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : (r.reviewer?.[0] || "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.reviewer}</span>
                      <Stars value={r.rating} />
                      {!r.isPublished && <Badge variant="secondary">ซ่อนอยู่</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleDateString("th-TH")}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                  </div>
                </div>

                {r.reply && <div className="ml-12 rounded-lg bg-secondary/50 p-3 text-sm"><span className="font-bold text-primary text-xs">ตอบกลับ: </span>{r.reply}</div>}

                <div className="flex flex-wrap items-center gap-2 pl-12">
                  <Textarea
                    value={replyDraft[r.id] ?? r.reply ?? ""}
                    onChange={(e) => setReplyDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                    rows={1}
                    placeholder="ตอบกลับแบบสาธารณะ..."
                    className="flex-1 min-w-[200px]"
                  />
                  <Button size="sm" variant="outline" onClick={() => patch(r.id, { reply: replyDraft[r.id] ?? r.reply ?? "" }, "บันทึกการตอบกลับแล้ว")}>
                    <Reply className="w-4 h-4 mr-1" />ตอบ
                  </Button>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.isPublished} onCheckedChange={(v) => patch(r.id, { isPublished: v }, v ? "แสดงรีวิวแล้ว" : "ซ่อนรีวิวแล้ว")} />
                    <span className="text-xs text-muted-foreground">แสดง</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรีวิว</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบรีวิวของ <span className="font-semibold">{deleteTarget?.reviewer}</span> ถาวร? (ถ้าต้องการแค่ซ่อน ให้ปิดสวิตช์ "แสดง" แทน)</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting}>{deleting ? "กำลังลบ..." : "ลบถาวร"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
