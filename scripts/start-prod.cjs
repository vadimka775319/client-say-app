/**
 * Production start: подгружает .env до Next.js (PM2/SSH часто не передают все переменные).
 * Порядок файлов как у Next.js (последний побеждает).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { config } = require("dotenv");

const root = path.resolve(__dirname, "..");

for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    config({ path: p, override: true });
  }
}

function normalizeDatabaseUrl() {
  const v = process.env.DATABASE_URL;
  if (!v) return;
  process.env.DATABASE_URL = String(v)
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\r/g, "")
    .replace(/^["']|["']$/g, "");
}
normalizeDatabaseUrl();

if (process.env.NODE_ENV === "production") {
  const s = process.env.AUTH_SECRET;
  if (!s || String(s).trim().length < 32) {
    console.error("[start-prod] Задайте в .env AUTH_SECRET не короче 32 символов.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
    console.error("[start-prod] Задайте в .env DATABASE_URL (PostgreSQL).");
    process.exit(1);
  }
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) {
  console.error("[start-prod] Не найден Next.js:", nextBin);
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, "start"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
