import { getDb, hashPassword } from "@/lib/db";
import crypto from "crypto";

/**
 * Create or update a eSANGGUNI admin user.
 *
 * Usage:
 *   ADMIN_USERNAME=ecapino@bayanaihan.com ADMIN_PASSWORD='Admin-2026#' npx tsx scripts/create-admin.ts
 *
 * If the user already exists, the password and active status are updated.
 */

const username = process.env.ADMIN_USERNAME?.trim();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_DISPLAY_NAME || username;
const role = process.env.ADMIN_ROLE === "lgu_admin" ? "lgu_admin" : "super_admin";

if (!username || !password) {
  console.error("ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required.");
  process.exit(1);
}

const db = getDb();

const existing = db
  .prepare("SELECT id FROM admin_users WHERE username = ?")
  .get(username) as { id: string } | undefined;

if (existing) {
  db.prepare(
    `UPDATE admin_users
     SET password_hash = ?, display_name = ?, role = ?, is_active = 1, updated_at = datetime('now')
     WHERE id = ?`
  ).run(hashPassword(password), displayName, role, existing.id);
  console.log(`[create-admin] Updated admin user: ${username}`);
} else {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO admin_users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
  ).run(id, username, hashPassword(password), displayName, role);
  console.log(`[create-admin] Created admin user: ${username}`);
}
