/**
 * Дополнение к npm run lint / typecheck: шаблон .env, Prisma, опционально удалённый /api/health.
 *
 * Полная цепочка: npm run verify:release
 * С проверкой прода: VERIFY_SITE_URL=https://example.com npm run verify:release
 * Или: npm run verify:release -- https://example.com
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function fail(msg) {
  console.error(`[verify-release] ${msg}`);
  process.exit(1);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

const examplePath = path.join(root, ".env.example");
if (!fs.existsSync(examplePath)) fail(".env.example не найден.");
const example = read(examplePath);
for (const key of ["DATABASE_URL", "AUTH_SECRET"]) {
  if (!example.includes(key)) fail(`.env.example должен упоминать ${key}.`);
}
if (!example.includes("NEXT_PUBLIC_APP_URL")) {
  console.warn("[verify-release] В .env.example нет NEXT_PUBLIC_APP_URL — для QR/абсолютных ссылок лучше добавить.");
}

const schema = path.join(root, "prisma", "schema.prisma");
if (!fs.existsSync(schema)) fail("prisma/schema.prisma не найден.");

const healthRoute = path.join(root, "src", "app", "api", "health", "route.ts");
if (!fs.existsSync(healthRoute)) fail("src/app/api/health/route.ts не найден.");

const siteArg = process.argv[2]?.trim();
const siteEnv = (process.env.VERIFY_SITE_URL || "").trim();
const site = siteArg || siteEnv;

async function remoteHealth() {
  const base = site.replace(/\/$/, "");
  const url = `${base}/api/health`;
  let res;
  let text;
  try {
    res = await fetch(url, { redirect: "follow" });
    text = await res.text();
  } catch (e) {
    fail(`Запрос health не удался: ${e instanceof Error ? e.message : String(e)}`);
  }
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    fail(`Удалённый health не JSON (HTTP ${res.status}). Первые 200 символов:\n${text.slice(0, 200)}`);
  }
  if (!j.ok) {
    fail(
      `Удалённый health: ok=false (HTTP ${res.status}). db=${j.db} authSecret=${j.authSecret} code=${j.errorCode || ""} hint=${j.hintEn || j.hint || ""}`,
    );
  }
  if (j.db !== "up") fail(`Удалённый health: db=${j.db} (ожидалось up).`);
  if (j.authReady !== true) fail(`Удалённый health: authReady=false (вход/регистрация на проде сломаны).`);
  console.log(`[verify-release] Удалённый health OK: ${url}`);
}

(async function main() {
  if (site) {
    await remoteHealth();
  } else {
    console.log("[verify-release] Статические проверки пройдены (без VERIFY_SITE_URL / аргумента URL).");
    console.log("[verify-release] С прода: VERIFY_SITE_URL=https://… npm run verify:release");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
