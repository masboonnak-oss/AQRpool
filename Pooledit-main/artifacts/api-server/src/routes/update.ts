import { Router } from "express";
import { authenticate, requireDev } from "../middlewares/auth.js";
import { getStatus, pushChanges, pullChanges, listFolders, setRemote } from "../lib/git.js";
import { logger } from "../lib/logger.js";

// System update panel — pull/push patches via GitHub. Developer (dev) role only.
const router = Router();
router.use(authenticate, requireDev);

// GET /update/folders — repo folders to offer as a "scan this folder" picker.
router.get("/folders", async (_req, res) => {
  try {
    return res.json({ folders: await listFolders() });
  } catch (err) {
    logger.error({ err }, "git folders failed");
    return res.status(500).json({ error: "git_folders_failed", message: err instanceof Error ? err.message : "อ่านโฟลเดอร์ไม่สำเร็จ" });
  }
});

// POST /update/set-remote — connect origin to the git link (locked to AQRpool).
router.post("/set-remote", async (req, res) => {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    return res.json({ ok: true, ...(await setRemote(url)) });
  } catch (err) {
    logger.error({ err }, "git set-remote failed");
    return res.status(400).json({ error: "git_set_remote_failed", message: err instanceof Error ? err.message : "เชื่อมต่อ repo ไม่สำเร็จ" });
  }
});

// GET /update/status?path= — branch, remote, local changes, and incoming updates (optionally scoped to a folder).
router.get("/status", async (req, res) => {
  try {
    const folder = typeof req.query.path === "string" ? req.query.path : "";
    return res.json(await getStatus(folder));
  } catch (err) {
    logger.error({ err }, "git status failed");
    return res.status(500).json({ error: "git_status_failed", message: err instanceof Error ? err.message : "ตรวจสถานะไม่สำเร็จ" });
  }
});

// POST /update/push — auto-detect changes (optionally only within { folder }), commit with an auto message, push.
router.post("/push", async (req, res) => {
  try {
    const folder = typeof req.body?.folder === "string" ? req.body.folder : "";
    const result = await pushChanges(folder);
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "git push failed");
    return res.status(500).json({ error: "git_push_failed", message: err instanceof Error ? err.message : "อัปขึ้น Git ไม่สำเร็จ" });
  }
});

// POST /update/pull — fast-forward pull the latest patch from GitHub.
router.post("/pull", async (_req, res) => {
  try {
    return res.json({ ok: true, ...(await pullChanges()) });
  } catch (err) {
    logger.error({ err }, "git pull failed");
    return res.status(500).json({ error: "git_pull_failed", message: err instanceof Error ? err.message : "ดึงอัปเดตไม่สำเร็จ" });
  }
});

export default router;
