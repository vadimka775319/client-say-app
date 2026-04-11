/**
 * Единые проверки «готовности» для /api/health и скриптов — без дублирования разовых костылей.
 */

export type AuthSecretHealth = "ok" | "missing" | "short" | "dev_fallback";

/** Статус секрета для JWT: в production без нормального секрета вход/регистрация падают. */
export function authSecretHealth(): AuthSecretHealth {
  const raw = process.env.AUTH_SECRET;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) {
    return process.env.NODE_ENV === "production" ? "missing" : "dev_fallback";
  }
  if (s.length < 32) return "short";
  return "ok";
}

export function databaseUrlConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** В production приложение не должно выдавать себя за «здоровое», если сессии невозможны. */
export function authReadyForProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return authSecretHealth() === "ok";
}
