/* Создаёт .env из .env.example, если .env ещё нет (Windows/macOS/Linux). */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (fs.existsSync(envPath)) {
  console.log(".env уже существует — не перезаписываю. Убедитесь, что в нём задан DATABASE_URL.");
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error("Не найден .env.example в корне проекта.");
  process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.log("Создан файл .env из .env.example.");
console.log("Откройте .env и при необходимости поправьте DATABASE_URL под ваш PostgreSQL и AUTH_SECRET (≥32 символов в проде).");
