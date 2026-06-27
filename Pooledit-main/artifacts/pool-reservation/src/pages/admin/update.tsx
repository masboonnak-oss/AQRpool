import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, DownloadCloud, UploadCloud, GitBranch, CheckCircle2,
  AlertTriangle, Github, ScanLine, FolderGit2, Link2, LogOut,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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

// Fetch JSON with the auth header; throw a clear error (and flag a 403 so the UI can
// tell the user their token is stale and they must re-login as DEV).
async function api(pathAndQuery: string, init?: RequestInit) {
  const r = await fetch(`${baseUrl}/api/update${pathAndQuery}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token()}`, ...(init?.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 403) throw new Error("FORBIDDEN");
    throw new Error(body.message || body.error || `HTTP ${r.status}`);
  }
  return body;
}

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
  const { logout } = useAuth();
  const [busy, setBusy] = useState<null | "push" | "pull" | "remote">(null);
  const [folder, setFolder] = useState(""); // "" = whole repo
  const [gitUrl, setGitUrl] = useState(REPO_URL);

  const { data: folderData } = useQuery<{ folders: string[] }>({
    queryKey: ["git-folders"],
    queryFn: () => api("/folders"),
    retry: false,
  });

  const { data, isLoading, refetch, isFetching, error } = useQuery<GitStatus>({
    queryKey: ["git-status", folder],
    queryFn: () => api(`/status${folder ? `?path=${encodeURIComponent(folder)}` : ""}`),
    refetchInterval: false,
    retry: false,
  });

  useEffect(() => {
    if (data?.remoteUrl) setGitUrl(data.remoteUrl.replace(/\.git$/, ""));
  }, [data?.remoteUrl]);

  const forbidden = (error as Error | undefined)?.message === "FORBIDDEN";

  const localChanges = data?.localChanges ?? [];
  const incoming = data?.incoming ?? [];
  const ahead = data?.ahead ?? 0;
  const behind = data?.behind ?? 0;
  const nothingToPush = localChanges.length === 0 && ahead === 0;
  const folders = folderData?.folders ?? [];

  const showErr = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "FORBIDDEN") {
      toast({ title: "ไม่มีสิทธิ์ DEV", description: "token หมดสิทธิ์ — กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่", variant: "destructive" });
    } else {
      toast({ title: "ไม่สำเร็จ", description: msg, variant: "destructive" });
    }
  };

  const run = async (action: "push" | "pull") => {
    setBusy(action);
    try {
      const body = await api(`/${action}`, { method: "POST", body: action === "push" ? JSON.stringify({ folder }) : "{}" });
      if (action === "pull") {
        toast({ title: body.updated ? `ดึงอัปเดตสำเร็จ (${body.updatedFiles?.length ?? 0} ไฟล์)` : "อัปเดตล่าสุดอยู่แล้ว", description: body.updated ? `${body.before} → ${body.after}` : undefined });
      } else {
        toast({ title: body.committed ? `อัปขึ้น Git สำเร็จ (${body.files?.length ?? 0} ไฟล์)` : "ไม่มีการแก้ไขใหม่ที่ต้องอัป", description: body.head ? `commit ${body.head}` : undefined });
      }
      await refetch();
    } catch (e) { showErr(e); } finally { setBusy(null); }
  };

  const connectRepo = async () => {
    setBusy("remote");
    try {
      const body = await api("/set-remote", { method: "POST", body: JSON.stringify({ url: gitUrl }) });
      toast({ title: "เชื่อมต่อ repo สำเร็จ", description: body.remoteUrl });
      await refetch();
    } catch (e) { showErr(e); } finally { setBusy(null); }
  };

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

      {/* Stale-token / permission banner */}
      {forbidden && (
        <Card className="border-red-500/40 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-red-700 dark:text-red-300">token ไม่มีสิทธิ์ DEV</div>
              <div className="text-red-600/90 dark:text-red-300/80">บัญชีนี้เพิ่งถูกเปลี่ยนเป็น DEV — ต้องออกจากระบบแล้วเข้าใหม่เพื่อรับสิทธิ์</div>
            </div>
            <Button variant="destructive" onClick={logout} className="gap-2 shrink-0"><LogOut className="w-4 h-4" /> ออกจากระบบ</Button>
          </CardContent>
        </Card>
      )}

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
            <Button variant="ghost" onClick={() => setGitUrl(REPO_URL)} className="shrink-0 text-xs">ใส่ลิงค์ AQRpool</Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> branch: <b className="text-foreground">{data?.branch || "—"}</b></span>
            {data?.lastCommit && <span>ล่าสุด: {data.lastCommit}</span>}
          </div>
          {data?.fetchError && <p className="text-xs text-amber-600">เตือน: เชื่อมต่อ GitHub ไม่สำเร็จ ({data.fetchError})</p>}
        </CardContent>
      </Card>

      {/* Folder scan picker — type a path OR pick from the list */}
      <Card className="glass border-none shadow-lg">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderGit2 className="w-4 h-4 text-cyan-600" /> เลือก/พิมพ์โฟลเดอร์ที่จะสแกน
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="ว่าง = ทั้งระบบ เช่น Pooledit-main/artifacts/pool-reservation"
              className="flex-1 font-mono text-xs"
            />
            <Button onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
              {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />} สแกน
            </Button>
          </div>
          <select
            value={folders.includes(folder) ? folder : ""}
            onChange={(e) => setFolder(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">— เลือกจากรายการโฟลเดอร์ ({folders.length}) —</option>
            <option value="">ทั้งระบบ (ทั้ง repo)</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{folder ? `จะสแกน/อัปเฉพาะ: ${folder}` : "จะสแกน/อัปทั้งระบบ"}</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">กำลังสแกน...</div>
      ) : forbidden ? (
        <div className="p-8 text-center text-muted-foreground">— ออกจากระบบแล้วเข้าใหม่เพื่อใช้งาน —</div>
      ) : error ? (
        <Card className="border-red-500/40"><CardContent className="p-5 text-sm text-red-600">โหลดสถานะไม่สำเร็จ: {(error as Error).message}</CardContent></Card>
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
              <Button className="w-full gap-2" disabled={!data?.remoteOk || behind === 0 || busy !== null} onClick={() => run("pull")}>
                {busy === "pull" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />} ดึงลง (Pull)
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
              <Button variant="secondary" className="w-full gap-2" disabled={!data?.remoteOk || nothingToPush || busy !== null} onClick={() => run("push")}>
                {busy === "push" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} อัปขึ้น (Push)
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
