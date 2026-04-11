/**
 * Запуск PowerShell-скрипта из ./scripts по абсолютному пути (npm иногда даёт cwd не корень пакета).
 * Использование: node scripts/run-ps1.cjs <имя.ps1> [...аргументы для ps1]
 */
const { spawnSync } = require("child_process");
const path = require("path");

const name = process.argv[2];
if (!name || !name.endsWith(".ps1")) {
  console.error("Usage: node scripts/run-ps1.cjs <script.ps1> [args for script...]");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const ps1 = path.join(__dirname, path.basename(name));
const psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, ...process.argv.slice(3)];

const r = spawnSync("powershell.exe", psArgs, {
  stdio: "inherit",
  cwd: root,
  windowsHide: false,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
