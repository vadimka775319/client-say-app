/**
 * Нормализация логина (email / телефон РФ) — без Prisma, можно импортировать в client components.
 */

/** Единый вид телефона РФ в БД: +7 и ровно 10 цифр после кода страны. */
export function canonicalPhoneRu(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+${d}`;
  if (d.length === 10) return `+7${d}`;
  return input.trim();
}

export function isStoredRuPhone(phone: string): boolean {
  return /^\+7\d{10}$/.test(phone);
}

export function normalizeLogin(login: string): { email: string | null; phone: string | null } {
  const t = login.trim();
  if (!t) return { email: null, phone: null };
  if (t.includes("@")) return { email: t.toLowerCase(), phone: null };
  return { email: null, phone: canonicalPhoneRu(t) };
}
