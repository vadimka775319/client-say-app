import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin, prismaRoleToSessionRole, verifyPassword } from "@/lib/auth-server";
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

    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(password, user.passwordHash);
    } catch {
      return NextResponse.json(getPublicError("credentials", "Неверный логин или пароль"), { status: 401 });
    }
    if (!passwordOk) {
      return NextResponse.json(getPublicError("credentials", "Неверный логин или пароль"), { status: 401 });
    }

    if (expectedRole != null && user.role !== expectedRole) {
      return NextResponse.json(
        getPublicError("wrong_role", "Этот аккаунт не подходит для выбранного кабинета"),
        { status: 403 },
      );
    }

    let sessionRole: SessionRole;
    try {
      sessionRole = prismaRoleToSessionRole(user.role);
    } catch {
      return NextResponse.json(
        getPublicError("account", "Учётная запись повреждена. Обратитесь в поддержку."),
        { status: 500 },
      );
    }

    let token: string;
    try {
      token = await signSession(user.id, sessionRole);
    } catch (signErr) {
      const sm = signErr instanceof Error ? signErr.message : String(signErr);
      console.error("[auth/login] signSession failed:", signErr);
      if (sm.includes("AUTH_SECRET") || sm.includes("32 characters")) {
        return NextResponse.json(
          getPublicError("config", "На сервере не задан AUTH_SECRET (не менее 32 символов)."),
          { status: 503 },
        );
      }
      return NextResponse.json(
        getPublicError("session", "Не удалось создать сессию. Проверьте AUTH_SECRET на сервере."),
        { status: 503 },
      );
    }

    const res = NextResponse.json({ ok: true as const, role: sessionRole });
    res.headers.set("Cache-Control", "private, no-store, must-revalidate");
    try {
      res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
    } catch (ce) {
      console.error("[auth/login] set-cookie", ce);
      return NextResponse.json(
        getPublicError("session", "Не удалось сохранить сессию. Проверьте HTTPS и настройки cookie."),
        { status: 503 },
      );
    }
    return res;
  } catch (e: unknown) {
    console.error("[auth/login]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("AUTH_SECRET") || msg.includes("32 characters")) {
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
