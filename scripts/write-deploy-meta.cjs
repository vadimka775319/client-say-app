/**
 * Пишет public/deploy-meta.json перед production build на VPS.
 * Так версия деплоя не зависит от попадания DEPLOY_* в env процесса PM2.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const pub = path.join(root, "public");
const out = path.join(pub, "deploy-meta.json");

fs.mkdirSync(pub, { recursive: true });

let gitShort = "unknown";
try {
  gitShort = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {
  // no git (редко)
}

const payload = {
  gitShort,
  deployedAt: new Date().toISOString(),
};

fs.writeFileSync(out, JSON.stringify(payload), "utf8");
process.stdout.write(`[write-deploy-meta] ${out} -> ${JSON.stringify(payload)}\n`);
