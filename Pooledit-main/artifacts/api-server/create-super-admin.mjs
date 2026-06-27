// Create (or upgrade) a super_admin account.
//
// Usage:
//   DATABASE_URL="postgres://..." node create-super-admin.mjs [username] [password]
//
// Defaults: username=admin  password=admin123
// Idempotent: if the username already exists it is upgraded to super_admin and
// its password is reset to the one given here.
//
// Run from this folder (artifacts/api-server) so `pg` and `bcryptjs` resolve.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// `bcryptjs` is a direct dep of api-server (resolves next to this file); `pg` is a
// transitive dep that lives under lib/db. Resolve each from a location that has it.
const reqHere = createRequire(import.meta.url);
const reqDb = createRequire(fileURLToPath(new URL("../../lib/db/package.json", import.meta.url)));
const bcrypt = reqHere("bcryptjs");
const pg = reqDb("pg");

const { Pool } = pg;

const username = process.argv[2] || "admin";
const password = process.argv[3] || "admin123";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Provide the Postgres connection string, e.g.:");
  console.error('  DATABASE_URL="postgres://user:pass@host:5432/db" node create-super-admin.mjs');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert a fresh super_admin, or if the username already exists, upgrade its
  // role and reset its password. Other profile fields are left untouched on update.
  const sql = `
    INSERT INTO users (first_name, last_name, phone, username, password_hash, role, branch_id)
    VALUES ($1, $2, $3, $4, $5, 'super_admin', 1)
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = 'super_admin'
    RETURNING id, username, role, created_at;
  `;
  const params = ["Super", "Admin", "-", username, passwordHash];

  const { rows } = await pool.query(sql, params);
  const u = rows[0];
  console.log("OK — super_admin ready:");
  console.log(`  id=${u.id}  username=${u.username}  role=${u.role}  created_at=${u.created_at.toISOString?.() ?? u.created_at}`);
  console.log(`  login password: ${password}`);
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
