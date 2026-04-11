/**
 * VPS / локально: проверка подключения Prisma с той же цепочкой .env, что и start-prod.cjs.
 * Запуск: из корня репозитория `node scripts/vps-diag-prisma.cjs`
 */
const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");

const root = process.cwd();
for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    console.log("dotenv load:", name);
    config({ path: p, override: true });
  }
}

const url = process.env.DATABASE_URL?.trim() ?? "";
console.log("DATABASE_URL set:", Boolean(url));
if (!url) {
  console.error("prisma_connect: FAIL no DATABASE_URL after loading env files");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma
  .$queryRaw`SELECT 1 AS ok`
  .then(() => {
    console.log("prisma_connect: OK");
    process.exit(0);
  })
  .catch((e) => {
    console.error("prisma_connect: FAIL", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
