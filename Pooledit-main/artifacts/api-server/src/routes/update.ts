import { Router } from "express";
import { authenticate, requireDev } from "../middlewares/auth.js";
import { getStatus, pushChanges, pullChanges } from "../lib/git.js";
import { logger } from "../lib/logger.js";

// System update panel — pull/push patches via GitHub. Developer (dev) role only.
const router = Router();
router.use(authenticate, requireDev);

// GET /update/status — branch, remote, local changes, and incoming updates.
router.get("/status", async (_req, res) => {
  try {
    return res.json(await getStatus());
  } catch (err) {
    logger.error({ err }, "git status failed");
    return res.status(500).json({ error: "git_status_failed", message: err instanceof Error ? err.message : "ตรวจสถานะไม่สำเร็จ" });
  }
});

// POST /update/push — auto-detect changes, commit with an auto message, push to GitHub.
router.post("/push", async (_req, res) => {
  try {
    const result = await pushChanges();
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
