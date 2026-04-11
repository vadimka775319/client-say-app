/**
 * Абсолютный URL страницы брифа для QR и ссылок.
 * На клиенте — origin текущего сайта; на сервере — NEXT_PUBLIC_APP_URL или VERCEL_URL.
 */
export function getPublicSiteOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "";
}

export function publicBriefUrl(briefId: string): string {
  const base = getPublicSiteOrigin();
  if (!base) return `/brief/${briefId}`;
  return `${base}/brief/${briefId}`;
}
