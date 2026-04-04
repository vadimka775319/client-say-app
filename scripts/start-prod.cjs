/**
 * Production start: подгружает .env до Next.js (PM2/SSH часто не передают все переменные).
 * Порядок файлов как у Next.js (последний побеждает).
 */
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { config } = require("dotenv");

const root = path.resolve(__dirname, "..");
const DEFAULT_PG_URL = "postgresql://postgres:postgres@127.0.0.1:5432/client_say?schema=public";

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

function portOpen(host, port, ms) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port }, () => {
      sock.end();
      resolve(true);
    });
    sock.setTimeout(ms, () => {
      sock.destroy();
      resolve(false);
    });
    sock.on("error", () => resolve(false));
  });
}

async function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return;
  const ok = await portOpen("127.0.0.1", 5432, 2500);
  if (ok) {
    process.env.DATABASE_URL = DEFAULT_PG_URL;
    console.warn("[start-prod] DATABASE_URL не задан — порт 5432 открыт, использую URL как в docker-compose.");
    try {
      const envPath = path.join(root, ".env");
      const line = `DATABASE_URL="${DEFAULT_PG_URL}"\n`;
      if (fs.existsSync(envPath)) {
        let body = fs.readFileSync(envPath, "utf8");
        if (/^DATABASE_URL=/m.test(body)) {
          body = body.replace(/^DATABASE_URL=.*$/m, line.trimEnd());
        } else {
          body += (body.endsWith("\n") ? "" : "\n") + line;
        }
        fs.writeFileSync(envPath, body, "utf8");
      } else {
        fs.writeFileSync(envPath, line, { mode: 0o600 });
      }
    } catch (e) {
      console.warn("[start-prod] Не удалось записать .env:", e.message);
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    const s = process.env.AUTH_SECRET;
    if (!s || String(s).trim().length < 32) {
      console.error("[start-prod] Задайте в .env AUTH_SECRET не короче 32 символов.");
      process.exit(1);
    }
    await ensureDatabaseUrl();
    if (!process.env.DATABASE_URL?.trim()) {
      console.error(
        "[start-prod] Нет DATABASE_URL и недоступен 127.0.0.1:5432 — задайте PostgreSQL в .env или выполните: docker compose up -d db",
      );
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
}

main().catch((e) => {
  console.error("[start-prod]", e);
  process.exit(1);
});
