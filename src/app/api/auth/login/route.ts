import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin, verifyPassword } from "@/lib/auth-server";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { isPrismaConnectionError } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSession } from "@/lib/auth-session";
import type { SessionRole } from "@/lib/auth-session";

const bodySchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  expectedRole: z.enum(["USER", "PARTNER", "SUPER_ADMIN"]).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(getPublicError("bad_request", "Некорректное тело запроса"), { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(getPublicError("validation", "Проверьте логин и пароль"), { status: 400 });
  }

  const { login, password, expectedRole } = parsed.data;

  try {
    const user = await findUserByLogin(login);
    if (!user) {
      return NextResponse.json(getPublicError("credentials", "Неверный логин или пароль"), { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(getPublicError("credentials", "Неверный логин или пароль"), { status: 401 });
    }

    if (expectedRole != null && user.role !== expectedRole) {
      return NextResponse.json(
        getPublicError("wrong_role", "Этот аккаунт не подходит для выбранного кабинета"),
        { status: 403 },
      );
    }

    const token = await signSession(user.id, user.role as SessionRole);
    const res = NextResponse.json({ ok: true as const, role: user.role as SessionRole });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("AUTH_SECRET")) {
      return NextResponse.json(
        getPublicError("config", "На сервере не задан AUTH_SECRET (≥32 символов). Обратитесь к администратору."),
        { status: 503 },
      );
    }
    if (isPrismaConnectionError(e) || msg.includes("DATABASE_URL")) {
      return NextResponse.json(getPublicError("db_unreachable", dbUnreachableUserMessage()), { status: 503 });
    }
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        getPublicError("internal", `Ошибка входа (dev): ${msg || String(e)}`),
        { status: 500 },
      );
    }
    return NextResponse.json(getPublicError("internal", "Ошибка сервера при входе. Попробуйте позже."), { status: 500 });
  }
}

function getPublicError(code: string, message: string) {
  return { error: { code, message } };
}
