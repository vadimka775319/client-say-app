import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin, verifyPassword } from "@/lib/auth-server";
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
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  return NextResponse.json({ ok: true as const, role: user.role as SessionRole });
}

function getPublicError(code: string, message: string) {
  return { error: { code, message } };
}
