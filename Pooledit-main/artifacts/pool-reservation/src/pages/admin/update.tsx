import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, DownloadCloud, UploadCloud, GitBranch, CheckCircle2,
  AlertTriangle, Github, ScanLine,
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
  behind: number;
  localChanges: FileChange[];
  incoming: FileChange[];
  lastCommit: string;
  fetchError: string | null;
};

// Git porcelain/name-status letters -> Thai labels.
const statusLabel = (s: string) => {
  const c = s[0];
  if (c === "A" || s === "??") return { text: "ไฟล์ใหม่", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
  if (c === "M") return { text: "แก้ไข", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
  if (c === "D") return { text: "ลบ", cls: "bg-red-500/10 text-red-700 border-red-500/20" };
  if (c === "R") return { text: "ย้าย/เปลี่ยนชื่อ", cls: "bg-sky-500/10 text-sky-700 border-sky-500/20" };
  return { text: s || "เปลี่ยน", cls: "bg-slate-500/10 text-slate-700 border-slate-500/20" };
};

function FileList({ files, empty }: { files: FileChange[]; empty: string }) {
  if (!files.length) return <div className="py-5 text-center text-muted-foreground text-sm">{empty}</div>;
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
      {files.map((f, i) => {
        const lbl = statusLabel(f.status);
        return (
          <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", lbl.cls)}>{lbl.text}</Badge>
            <span className="font-mono text-xs truncate" title={f.file}>{f.file}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminUpdate() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | "push" | "pull">(null);

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
    refetchInterval: false, // a refresh runs a real `git fetch` over the whole repo — on demand
    retry: false,
  });

  const localChanges = data?.localChanges ?? [];
  const incoming = data?.incoming ?? [];
  const ahead = data?.ahead ?? 0;
  const behind = data?.behind ?? 0;
  const nothingToPush = localChanges.length === 0 && ahead === 0;

  const run = async (action: "push" | "pull") => {
    setBusy(action);
    try {
      const r = await fetch(`${baseUrl}/api/update/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || "ทำรายการไม่สำเร็จ");
      if (action === "pull") {
        toast({
          title: body.updated ? `ดึงอัปเดตสำเร็จ (${body.updatedFiles?.length ?? 0} ไฟล์)` : "อัปเดตล่าสุดอยู่แล้ว",
          description: body.updated ? `${body.before} → ${body.after}` : undefined,
        });
      } else {
        toast({
          title: body.committed ? `อัปขึ้น Git สำเร็จ (${body.files?.length ?? 0} ไฟล์)` : "ไม่มีการแก้ไขใหม่ที่ต้องอัป",
          description: body.head ? `commit ${body.head}` : undefined,
        });
      }
      await refetch();
    } catch (e) {
      toast({ title: "ไม่สำเร็จ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="อัพเดทระบบ (DEV)"
        subtitle="สแกนทั้งระบบอัตโนมัติ แล้วรับ–ส่งแพตช์ผ่าน GitHub — เฉพาะโรล Dev"
        icon={GitBranch}
        gradient="from-slate-700 to-cyan-600"
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <ScanLine className={cn("w-4 h-4", isFetching && "animate-spin")} /> สแกนใหม่
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
            <p className="text-xs text-red-600">remote ของเครื่องนี้ไม่ใช่ {data.allowedRemote} — ปิดปุ่มเพื่อความปลอดภัย</p>
          )}
          {data?.fetchError && (
            <p className="text-xs text-amber-600">เตือน: เชื่อมต่อ GitHub เพื่อตรวจอัปเดตไม่สำเร็จ ({data.fetchError})</p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">กำลังสแกนทั้งระบบ...</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Pull updates FROM GitHub */}
          <Card className="glass border-none shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold">ดึงแพตช์จาก GitHub</h3>
                {behind > 0 && <Badge className="bg-cyan-600 text-white">{behind} แพตช์ใหม่</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {behind > 0
                  ? `มีไฟล์ใหม่/อัปเดต ${incoming.length} ไฟล์ที่ยังไม่มีในเครื่องนี้`
                  : "เครื่องนี้ใช้โค้ดล่าสุดอยู่แล้ว"}
              </p>
              <FileList files={incoming} empty="ไม่มีไฟล์ใหม่จาก GitHub" />
              <Button
                className="w-full gap-2"
                disabled={!data?.remoteOk || behind === 0 || busy !== null}
                onClick={() => run("pull")}
              >
                {busy === "pull" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                ดึงลง (Pull)
              </Button>
            </CardContent>
          </Card>

          {/* Push local changes TO GitHub */}
          <Card className="glass border-none shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-fuchsia-600" />
                <h3 className="font-bold">ส่งแพตช์ขึ้น GitHub</h3>
                {(localChanges.length > 0 || ahead > 0) && (
                  <Badge className="bg-fuchsia-600 text-white">{localChanges.length > 0 ? `${localChanges.length} ไฟล์` : `${ahead} commit`}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {localChanges.length > 0
                  ? `ตรวจพบการแก้ไขในเครื่อง ${localChanges.length} ไฟล์`
                  : ahead > 0
                    ? `มี ${ahead} commit ที่ยังไม่ได้ส่งขึ้น`
                    : "ไม่มีการแก้ไขใหม่ในเครื่องนี้"}
              </p>
              <FileList files={localChanges} empty="ไม่มีการแก้ไขใหม่ — ตรงกับ GitHub แล้ว" />
              <Button
                variant="secondary"
                className="w-full gap-2"
                disabled={!data?.remoteOk || nothingToPush || busy !== null}
                onClick={() => run("push")}
              >
                {busy === "push" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                อัปขึ้น (Push)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        สแกนครอบคลุมทั้ง repo · ข้อความ commit ถูกสร้างอัตโนมัติจากไฟล์ที่เปลี่ยน · หลังดึงแพตช์ที่มีโค้ดเปลี่ยน ต้อง build + รีสตาร์ท (หรือใช้ update.ps1)
      </p>
    </div>
  );
}
