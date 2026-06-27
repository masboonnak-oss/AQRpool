import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, UploadCloud, GitBranch, CheckCircle2, AlertTriangle, Github,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
const token = () => localStorage.getItem("pool_token");

type FileChange = { status: string; file: string };
type GitStatus = {
  remoteOk: boolean;
  remoteUrl: string;
  allowedRemote: string;
  branch: string;
  ahead: number;
  localChanges: FileChange[];
  lastCommit: string;
  fetchError: string | null;
};

// Git porcelain letters -> Thai labels.
const statusLabel = (s: string) => {
  const c = s[0];
  if (c === "A" || s === "??") return { text: "เพิ่มใหม่", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
  if (c === "M") return { text: "แก้ไข", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
  if (c === "D") return { text: "ลบ", cls: "bg-red-500/10 text-red-700 border-red-500/20" };
  if (c === "R") return { text: "ย้าย/เปลี่ยนชื่อ", cls: "bg-sky-500/10 text-sky-700 border-sky-500/20" };
  return { text: s || "เปลี่ยน", cls: "bg-slate-500/10 text-slate-700 border-slate-500/20" };
};

export function AdminUpdate() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<GitStatus>({
    queryKey: ["git-status"],
    queryFn: async () => {
      const r = await fetch(`${baseUrl}/api/update/status`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "โหลดสถานะไม่สำเร็จ");
      }
      return r.json();
    },
    refetchInterval: false, // each refresh runs a real `git`, so check on demand / on focus
    retry: false,
  });

  const localChanges = data?.localChanges ?? [];
  const ahead = data?.ahead ?? 0;
  const nothingToPush = localChanges.length === 0 && ahead === 0;

  const pushNow = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${baseUrl}/api/update/push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || "อัปขึ้น Git ไม่สำเร็จ");
      toast({
        title: body.committed ? `อัปขึ้น Git สำเร็จ (${body.files?.length ?? 0} ไฟล์)` : "ไม่มีการแก้ไขใหม่ที่ต้องอัป",
        description: body.head ? `commit ${body.head}` : undefined,
      });
      await refetch();
    } catch (e) {
      toast({ title: "ไม่สำเร็จ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="อัพเดทระบบ"
        subtitle="ตรวจการแก้ไขในเครื่องนี้อัตโนมัติ แล้วอัปขึ้น GitHub — เฉพาะ Super admin"
        icon={GitBranch}
        gradient="from-slate-700 to-cyan-600"
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> ตรวจสอบใหม่
          </Button>
        }
      />

      {/* Repo / branch info */}
      <Card className="glass border-none shadow-lg">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Github className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-xs break-all">{data?.remoteUrl || "—"}</span>
            {data && (data.remoteOk
              ? <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 className="w-3 h-3" />repo ถูกต้อง</Badge>
              : <Badge className="bg-red-500 text-white gap-1"><AlertTriangle className="w-3 h-3" />remote ไม่ตรง</Badge>)}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> branch: <b className="text-foreground">{data?.branch || "—"}</b></span>
            {data?.lastCommit && <span>ล่าสุด: {data.lastCommit}</span>}
          </div>
          {data && !data.remoteOk && (
            <p className="text-xs text-red-600">remote ของเครื่องนี้ไม่ใช่ {data.allowedRemote} — ปิดปุ่มอัปเพื่อความปลอดภัย</p>
          )}
        </CardContent>
      </Card>

      {/* Detected changes + single upload button */}
      <Card className="glass border-none shadow-lg">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-fuchsia-600" />
            <h3 className="font-bold">การแก้ไขที่ตรวจพบ</h3>
            {!isLoading && (
              <Badge className={nothingToPush ? "bg-slate-400 text-white" : "bg-fuchsia-600 text-white"}>
                {localChanges.length > 0 ? `${localChanges.length} ไฟล์` : ahead > 0 ? `${ahead} commit รออัป` : "ไม่มี"}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-muted-foreground text-sm">กำลังตรวจสอบ...</div>
          ) : nothingToPush ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              ไม่มีการแก้ไขใหม่ในเครื่องนี้ — ตรงกับ GitHub แล้ว
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
              {localChanges.map((f, i) => {
                const lbl = statusLabel(f.status);
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]", lbl.cls)}>{lbl.text}</Badge>
                    <span className="font-mono text-xs truncate" title={f.file}>{f.file}</span>
                  </div>
                );
              })}
              {localChanges.length === 0 && ahead > 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">มี {ahead} commit ที่ commit ไว้แล้วแต่ยังไม่ได้อัปขึ้น</div>
              )}
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!data?.remoteOk || nothingToPush || busy}
            onClick={pushNow}
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            อัปขึ้น Git
          </Button>
          <p className="text-xs text-muted-foreground">
            ข้อความ commit ถูกสร้างให้อัตโนมัติจากไฟล์ที่เปลี่ยน · เครื่องเซิร์ฟเวอร์ดึงอัปเดตด้วยสคริปต์ update.ps1
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
