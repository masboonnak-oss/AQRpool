import { FC, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Star, MessageSquareQuote, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Review = { id: number; rating: number; comment: string | null; reply: string | null; createdAt: string; reviewer?: string; avatarUrl?: string | null };
type Mine = { id: number; rating: number; comment: string | null; isPublished: boolean; createdAt: string } | null;

const SIZES = { sm: "w-3 h-3", md: "w-5 h-5", lg: "w-7 h-7" } as const;

const StarRow: FC<{ value: number; size?: keyof typeof SIZES; onChange?: (v: number) => void }> = ({ value, size = "md", onChange }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        className={cn("transition-transform", onChange && "hover:scale-110 cursor-pointer")}
        aria-label={`${n} ดาว`}
      >
        <Star className={cn(SIZES[size], n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
      </button>
    ))}
  </div>
);

export const MemberReviews: FC = () => {
  const { toast } = useToast();
  const token = localStorage.getItem("pool_token");
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [mine, setMine] = useState<Mine>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    const res = await fetch(`${baseUrl}/api/reviews`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setReviews(d.reviews || []);
      setSummary(d.summary || { average: 0, count: 0 });
      setMine(d.mine || null);
      if (d.mine) { setRating(d.mine.rating); setComment(d.mine.comment || ""); }
    }
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const submit = async () => {
    if (rating < 1) { toast({ title: "กรุณาให้คะแนนดาว", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: mine ? "อัปเดตรีวิวแล้ว ขอบคุณค่ะ" : "ขอบคุณสำหรับรีวิว!" });
      fetchReviews();
    } catch { toast({ title: "บันทึกไม่สำเร็จ", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="รีวิวสโมสร" subtitle="แบ่งปันประสบการณ์ของคุณ" icon={MessageSquareQuote} gradient="from-amber-400 to-orange-500" />

      {/* Summary */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 flex items-center gap-5">
          <div className="text-center">
            <div className="text-4xl font-display font-extrabold text-gradient">{summary.average.toFixed(1)}</div>
            <StarRow value={Math.round(summary.average)} />
          </div>
          <div className="text-sm text-muted-foreground">
            จากสมาชิก <span className="font-bold text-foreground">{summary.count.toLocaleString()}</span> รีวิว
          </div>
        </CardContent>
      </Card>

      {/* Write/edit my review */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{mine ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}</h3>
            {mine && !mine.isPublished && <Badge variant="secondary">รอตรวจสอบ</Badge>}
          </div>
          <StarRow value={rating} size="lg" onChange={setRating} />
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} placeholder="เล่าประสบการณ์ของคุณกับ Aqua Rich..." />
          <Button onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : mine ? "อัปเดตรีวิว" : "ส่งรีวิว"}</Button>
        </CardContent>
      </Card>

      {/* Published reviews */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวเลย!</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                    {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : (r.reviewer?.[0] || "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.reviewer}</div>
                    <StarRow value={r.rating} size="sm" />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleDateString("th-TH")}</span>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                {r.reply && (
                  <div className="ml-4 mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
                    <div className="flex items-center gap-1 text-xs font-bold text-primary mb-1"><Quote className="w-3 h-3" />ตอบกลับจากทีมงาน</div>
                    {r.reply}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
