/**
 * Сообщение пользователю при недоступности БД (Vercel и VPS настраиваются по-разному).
 */
export function dbUnreachableUserMessage(): string {
  const onVercel = process.env.VERCEL === "1";
  const url = process.env.DATABASE_URL?.trim() ?? "";

  if (onVercel) {
    if (!url) {
      return "Сайт на Vercel: в Project → Settings → Environment Variables добавьте DATABASE_URL от облачного PostgreSQL (Neon, Supabase, Railway) и сделайте Redeploy. Локальный адрес 127.0.0.1 с Vercel недоступен.";
    }
    if (url.includes("127.0.0.1") || url.includes("localhost")) {
      return "DATABASE_URL указывает на этот компьютер (localhost) — с Vercel так не работает. Создайте БД в облаке (Neon/Supabase и т.д.), вставьте выданный URL в Environment Variables и Redeploy.";
    }
    return "Не удаётся подключиться к PostgreSQL. В Vercel проверьте DATABASE_URL, SSL (часто ?sslmode=require), что задан AUTH_SECRET ≥32 символов и что схема применена к этой БД (npx prisma db push).";
  }

  if (!url) {
    return "На сервере не задан DATABASE_URL в .env — укажите строку подключения к PostgreSQL и перезапустите приложение.";
  }
  return "База данных недоступна. Проверьте DATABASE_URL в .env, что PostgreSQL запущен (docker compose up -d db) и выполнен prisma db push.";
}

/** То же для /api/health и логов: только ASCII, чтобы Windows PowerShell и curl не ломали кириллицу. */
export function dbUnreachableUserMessageEn(): string {
  const onVercel = process.env.VERCEL === "1";
  const url = process.env.DATABASE_URL?.trim() ?? "";

  if (onVercel) {
    if (!url) {
      return "Vercel: add DATABASE_URL (cloud Postgres) in Project Settings > Environment Variables, then redeploy.";
    }
    if (url.includes("127.0.0.1") || url.includes("localhost")) {
      return "DATABASE_URL points to localhost; from Vercel use a cloud database (Neon, Supabase, etc.).";
    }
    return "Cannot connect to PostgreSQL. Check DATABASE_URL, sslmode=require, AUTH_SECRET (32+ chars), prisma db push on this DB.";
  }

  if (!url) {
    return "DATABASE_URL is missing in server .env; set PostgreSQL connection string and restart the app.";
  }
  return "Database unreachable. Check DATABASE_URL, PostgreSQL is running (e.g. docker compose up -d db), run prisma db push.";
}
