import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, DownloadCloud, UploadCloud, GitBranch, CheckCircle2,
  AlertTriangle, Github, ScanLine, FolderGit2, Link2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
const token = () => localStorage.getItem("pool_token");
const REPO_URL = "https://github.com/masboonnak-oss/AQRpool";

type FileChange = { status: string; file: string };
type GitStatus = {
  remoteOk: boolean;
  remoteUrl: string;
  allowedRemote: string;
  branch: string;
  folder: string;
  ahead: number;
  behind: number;
  localChanges: FileChange[];
  incoming: FileChange[];
  lastCommit: string;
  fetchError: string | null;
};

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
  const [busy, setBusy] = useState<null | "push" | "pull" | "remote">(null);
  const [folder, setFolder] = useState(""); // "" = whole repo
  const [gitUrl, setGitUrl] = useState(REPO_URL);

  const authHeaders = { Authorization: `Bearer ${token()}` };

  const { data: folderData } = useQuery<{ folders: string[] }>({
    queryKey: ["git-folders"],
    queryFn: async () => {
      const r = await fetch(`${baseUrl}/api/update/folders`, { headers: authHeaders });
      if (!r.ok) return { folders: [] };
      return r.json();
    },
    retry: false,
  });

  const { data, isLoading, refetch, isFetching } = useQuery<GitStatus>({
    queryKey: ["git-status", folder],
    queryFn: async () => {
      const qs = folder ? `?path=${encodeURIComponent(folder)}` : "";
      const r = await fetch(`${baseUrl}/api/update/status${qs}`, { headers: authHeaders });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "โหลดสถานะไม่สำเร็จ");
      }
      return r.json();
    },
    refetchInterval: false,
    retry: false,
  });

  useEffect(() => {
    if (data?.remoteUrl) setGitUrl(data.remoteUrl.replace(/\.git$/, ""));
  }, [data?.remoteUrl]);

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
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: action === "push" ? JSON.stringify({ folder }) : undefined,
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

  const connectRepo = async () => {
    setBusy("remote");
    try {
      const r = await fetch(`${baseUrl}/api/update/set-remote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: gitUrl }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || "เชื่อมต่อไม่สำเร็จ");
      toast({ title: "เชื่อมต่อ repo สำเร็จ", description: body.remoteUrl });
      await refetch();
    } catch (e) {
      toast({ title: "เชื่อมต่อไม่สำเร็จ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const folders = folderData?.folders ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="อัพเดทระบบ (DEV)"
        subtitle="สแกนไฟล์อัตโนมัติ แล้วรับ–ส่งแพตช์ผ่าน GitHub — เฉพาะโรล Dev"
        icon={GitBranch}
        gradient="from-slate-700 to-cyan-600"
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <ScanLine className={cn("w-4 h-4", isFetching && "animate-spin")} /> สแกนใหม่
          </Button>
        }
      />

      {/* Repo link + connect */}
      <Card className="glass border-none shadow-lg">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Github className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">ลิงค์ Git (เชื่อมกับ AQRpool เท่านั้น)</span>
            {data && (data.remoteOk
              ? <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 className="w-3 h-3" />เชื่อมต่อแล้ว</Badge>
              : <Badge className="bg-red-500 text-white gap-1"><AlertTriangle className="w-3 h-3" />ยังไม่เชื่อม</Badge>)}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} className="pl-9 font-mono text-xs" placeholder={REPO_URL} />
            </div>
            <Button variant="outline" onClick={connectRepo} disabled={busy !== null} className="gap-2 shrink-0">
              {busy === "remote" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              เชื่อมต่อ
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> branch: <b className="text-foreground">{data?.branch || "—"}</b></span>
            {data?.lastCommit && <span>ล่าสุด: {data.lastCommit}</span>}
          </div>
          {data?.fetchError && <p className="text-xs text-amber-600">เตือน: เชื่อมต่อ GitHub ไม่สำเร็จ ({data.fetchError})</p>}
        </CardContent>
      </Card>

      {/* Folder scan picker */}
      <Card className="glass border-none shadow-lg">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderGit2 className="w-4 h-4 text-cyan-600" /> เลือกโฟลเดอร์ที่จะสแกน
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">ทั้งระบบ (ทั้ง repo)</option>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
              <ScanLine className="w-4 h-4" /> สแกนโฟลเดอร์นี้
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {folder ? `สแกน/อัปเฉพาะโฟลเดอร์: ${folder}` : "สแกนและอัปทั้งระบบ"}
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">กำลังสแกน...</div>
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
                {behind > 0 ? `มีไฟล์ใหม่/อัปเดต ${incoming.length} ไฟล์ที่ยังไม่มีในเครื่องนี้` : "เครื่องนี้ใช้โค้ดล่าสุดอยู่แล้ว"}
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
                  ? `ตรวจพบการแก้ไข ${localChanges.length} ไฟล์${folder ? ` ในโฟลเดอร์ ${folder}` : ""}`
                  : ahead > 0 ? `มี ${ahead} commit ที่ยังไม่ได้ส่งขึ้น` : "ไม่มีการแก้ไขใหม่"}
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
        ข้อความ commit สร้างอัตโนมัติจากไฟล์ที่เปลี่ยน · หลังดึงแพตช์ที่มีโค้ดเปลี่ยน ต้อง build + รีสตาร์ท (หรือใช้ update.ps1)
      </p>
    </div>
  );
}
