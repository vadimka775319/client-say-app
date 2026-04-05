import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSession, type SessionRole } from "@/lib/auth-session";

const noStore = { "Cache-Control": "private, no-store, must-revalidate" } as const;

export function authJsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStore });
}

/** Успех + JWT в httpOnly cookie (единая точка для login/register). */
export async function authJsonSuccessWithCookie(
  req: Request,
  userId: string,
  role: SessionRole,
  body: Record<string, unknown>,
) {
  let token: string;
  try {
    token = await signSession(userId, role);
  } catch (e) {
    const sm = e instanceof Error ? e.message : String(e);
    console.error("[auth] signSession", e);
    if (sm.includes("AUTH_SECRET") || sm.includes("32 characters")) {
      return authJsonError(503, "config", "На сервере не задан AUTH_SECRET (не менее 32 символов).");
    }
    return authJsonError(503, "session", "Не удалось создать сессию. Проверьте AUTH_SECRET на сервере.");
  }

  try {
    const res = NextResponse.json(body, { headers: noStore });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
    return res;
  } catch (e) {
    console.error("[auth] set-cookie", e);
    return authJsonError(503, "session", "Не удалось сохранить сессию (cookie). Проверьте HTTPS и настройки прокси.");
  }
}
