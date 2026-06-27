// Git helper for the admin "Update" panel.
//
// SECURITY:
// - All git calls go through execFile with an argv array (NO shell), so nothing
//   the caller passes can be interpreted as a shell command.
// - Push/pull refuse to run unless `origin` is exactly the allowed repo, so this
//   can never be repointed to push the code somewhere else.
// - Routes that call this are already gated to super_admin.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// The ONLY repository this panel may pull from / push to.
const ALLOWED_REMOTE = "https://github.com/masboonnak-oss/AQRpool";

let cachedRoot: string | null = null;

function normalizeRemote(url: string): string {
  return url.trim().replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
}

export type FileChange = { status: string; file: string };

async function repoRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    windowsHide: true,
  });
  cachedRoot = stdout.toString().trim();
  return cachedRoot;
}

async function git(args: string[]): Promise<string> {
  const cwd = await repoRoot();
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.toString().trim();
}

async function getRemoteUrl(): Promise<string> {
  try {
    return await git(["remote", "get-url", "origin"]);
  } catch {
    return "";
  }
}

async function assertAllowedRemote(): Promise<void> {
  const url = await getRemoteUrl();
  if (normalizeRemote(url) !== normalizeRemote(ALLOWED_REMOTE)) {
    throw new Error(`origin remote is "${url || "(none)"}", expected ${ALLOWED_REMOTE} — refusing to continue.`);
  }
}

function parsePorcelain(out: string): FileChange[] {
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2).trim(), file: line.slice(3).trim() }));
}

function parseNameStatus(out: string): FileChange[] {
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) return { status: line.trim(), file: "" };
      return { status: line.slice(0, tab).trim(), file: line.slice(tab + 1).trim() };
    });
}

// Build the commit message automatically from the detected changes, so it always
// accurately reflects what is actually being uploaded (no manual typing).
function autoCommitMessage(files: FileChange[]): string {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const c = f.status === "??" ? "A" : (f.status[0] || "M");
    counts[c] = (counts[c] || 0) + 1;
  }
  const order: [string, string][] = [["A", "added"], ["M", "modified"], ["D", "deleted"], ["R", "renamed"]];
  const summary = order.filter(([k]) => counts[k]).map(([k, label]) => `${counts[k]} ${label}`).join(", ") || `${files.length} changed`;
  const subject = `Admin update: ${summary} (${files.length} files)`;
  const body = files.map((f) => `${f.status} ${f.file}`).join("\n");
  return `${subject}\n\n${body}`;
}

// Use a fallback identity only when the box has none configured, so we never
// override a real configured author.
async function commitArgs(message: string): Promise<string[]> {
  const email = await git(["config", "user.email"]).catch(() => "");
  const ident = email ? [] : ["-c", "user.name=Aquarich Admin", "-c", "user.email=admin@aquarich.local"];
  return [...ident, "commit", "-m", message];
}

export async function getStatus() {
  const remoteUrl = await getRemoteUrl();
  const remoteOk = normalizeRemote(remoteUrl) === normalizeRemote(ALLOWED_REMOTE);
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);

  // Refresh remote tracking (read-only). Network failures are reported, not thrown.
  let fetchError: string | null = null;
  if (remoteOk) {
    try {
      await git(["fetch", "origin", branch]);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "fetch failed";
    }
  }

  const localChanges = parsePorcelain(await git(["status", "--porcelain"]));

  let ahead = 0;
  let behind = 0;
  let incoming: FileChange[] = [];
  try {
    const counts = await git(["rev-list", "--left-right", "--count", `origin/${branch}...HEAD`]);
    const [b, a] = counts.split(/\s+/).map((n) => parseInt(n, 10) || 0);
    behind = b;
    ahead = a;
    if (behind > 0) incoming = parseNameStatus(await git(["diff", "--name-status", `HEAD..origin/${branch}`]));
  } catch {
    // origin/<branch> may not exist yet — leave counts at 0.
  }

  const lastCommit = await git(["log", "-1", "--pretty=%h · %an · %ad · %s", "--date=format:%Y-%m-%d %H:%M"]).catch(() => "");

  return { remoteOk, remoteUrl, allowedRemote: ALLOWED_REMOTE, branch, ahead, behind, localChanges, incoming, lastCommit, fetchError };
}

export async function pushChanges() {
  await assertAllowedRemote();
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);

  await git(["add", "-A"]);
  const staged = parsePorcelain(await git(["status", "--porcelain"]));

  let committed = false;
  if (staged.length > 0) {
    // Message is generated automatically from the detected changes — accurate, no manual input.
    await git(await commitArgs(autoCommitMessage(staged)));
    committed = true;
  }

  // Pushes the new commit plus any earlier unpushed commits.
  const pushOut = await git(["push", "origin", branch]);
  const head = await git(["rev-parse", "--short", "HEAD"]);
  return { committed, branch, head, files: staged, pushOut };
}

export async function pullChanges() {
  await assertAllowedRemote();
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const before = await git(["rev-parse", "HEAD"]);
  const pullOut = await git(["pull", "--ff-only", "origin", branch]);
  const after = await git(["rev-parse", "HEAD"]);
  const updatedFiles = before === after ? [] : parseNameStatus(await git(["diff", "--name-status", `${before}..${after}`]));
  return { updated: before !== after, before: before.slice(0, 7), after: after.slice(0, 7), updatedFiles, pullOut };
}
