// Create (or upgrade) a super_admin account.
//
// Usage:
//   DATABASE_URL="postgres://..." SUPER_ADMIN_PASSWORD="..." node create-super-admin.mjs [username] [role]
//
// Defaults: username=admin, role=super_admin. Password must come from
// SUPER_ADMIN_PASSWORD or an interactive secret prompt.
// Idempotent: if the username already exists it is upgraded to super_admin and
// its password is reset to the one given here.
//
// Run from this folder (artifacts/api-server) so `pg` and `bcryptjs` resolve.

import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

// `bcryptjs` is a direct dep of api-server (resolves next to this file); `pg` is a
// transitive dep that lives under lib/db. Resolve each from a location that has it.
const reqHere = createRequire(import.meta.url);
const reqDb = createRequire(fileURLToPath(new URL("../../lib/db/package.json", import.meta.url)));
const bcrypt = reqHere("bcryptjs");
const pg = reqDb("pg");

const { Pool } = pg;

const username = process.argv[2] || "admin";
// 3rd arg = role (super_admin | dev | admin | ...). Defaults to super_admin.
const role = process.argv[3] || "super_admin";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Provide the Postgres connection string, e.g.:");
  console.error('  DATABASE_URL="postgres://user:pass@host:5432/db" node create-super-admin.mjs');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function readPassword() {
  if (process.env.SUPER_ADMIN_PASSWORD) return process.env.SUPER_ADMIN_PASSWORD;
  if (!process.stdin.isTTY) {
    throw new Error("SUPER_ADMIN_PASSWORD is required when stdin is not interactive.");
  }

  const rl = createInterface({ input, output });
  try {
    return await rl.question("New super-admin password: ");
  } finally {
    rl.close();
  }
}

async function main() {
  const password = await readPassword();
  if (password.length < 12) {
    throw new Error("Super-admin password must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Insert a fresh account, or if the username already exists, upgrade its role
  // and reset its password. Other profile fields are left untouched on update.
  const sql = `
    INSERT INTO users (first_name, last_name, phone, username, password_hash, role, branch_id)
    VALUES ($1, $2, $3, $4, $5, $6::user_role, 1)
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = EXCLUDED.role
    RETURNING id, username, role, created_at;
  `;
  const params = ["Super", "Admin", "-", username, passwordHash, role];

  const { rows } = await pool.query(sql, params);
  const u = rows[0];
  console.log(`OK — ${u.role} ready:`);
  console.log(`  id=${u.id}  username=${u.username}  role=${u.role}  created_at=${u.created_at.toISOString?.() ?? u.created_at}`);
  console.log("  password: set from secret input (not printed)");
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
