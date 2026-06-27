import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";

// Auto-apply DB migrations on server startup so a deploy (git pull + build + restart)
// updates the schema in one step — no manual SQL. Every migration file is idempotent
// (IF NOT EXISTS / ADD VALUE IF NOT EXISTS), and a `_migrations` table records what
// ran so each file is applied at most once.

async function findMigrationsDir(): Promise<string | null> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "../../lib/db/migrations"),   // cwd = artifacts/api-server
    path.resolve(here, "../../../lib/db/migrations"),         // bundled at artifacts/api-server/dist
    path.resolve(process.cwd(), "lib/db/migrations"),
  ];
  for (const dir of candidates) {
    try {
      const entries = await readdir(dir);
      if (entries.some((f) => f.endsWith(".sql"))) return dir;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function runMigrations(): Promise<void> {
  const dir = await findMigrationsDir();
  if (!dir) {
    logger.warn("Auto-migrate: no migrations directory found — skipping");
    return;
  }

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  } catch (err) {
    logger.error({ err }, "Auto-migrate: could not ensure _migrations table");
    return;
  }

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await pool.query<{ name: string }>(`SELECT name FROM _migrations`)).rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      // Each file is run as one simple query. Files are single-statement where the
      // statement can't run in a transaction (e.g. ALTER TYPE ... ADD VALUE).
      await pool.query(sql);
      await pool.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [file]);
      logger.info({ file }, "Auto-migrate: applied");
    } catch (err) {
      // Don't crash the API over one migration — log and move on (idempotent files are safe to retry next boot).
      logger.error({ err, file }, "Auto-migrate: migration failed");
    }
  }
}
