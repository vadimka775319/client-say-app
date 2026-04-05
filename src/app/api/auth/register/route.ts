import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { isPrismaConnectionError, prisma } from "@/lib/prisma";
import { findUserByLogin, hashPassword, normalizeLogin, prismaRoleToSessionRole } from "@/lib/auth-server";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSession, type SessionRole } from "@/lib/auth-session";

const registerBody = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("USER"),
    login: z.string().min(1),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().optional().default(""),
  }),
  z.object({
    role: z.literal("PARTNER"),
    login: z.string().min(1),
    password: z.string().min(6),
    companyName: z.string().min(1),
    city: z.string().min(1).max(120),
    firstName: z.string().optional().default("Партнёр"),
    lastName: z.string().optional().default(""),
  }),
]);

function duplicateRegisterMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const raw = e.meta?.target;
    const fields = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : [];
    if (fields.some((f) => f === "phone")) {
      return "Этот телефон уже зарегистрирован в системе. Войдите с тем же паролем или укажите другой номер.";
    }
    if (fields.some((f) => f === "email")) {
      return "Этот email уже занят. Войдите или укажите другой адрес.";
    }
  }
  return "Такой email или телефон уже зарегистрирован.";
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело запроса" } }, { status: 400 });
  }

  const parsed = registerBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Заполните все поля корректно" } }, { status: 400 });
  }

  const data = parsed.data;
  const loginTrim = data.login.trim();
  if (loginTrim.includes("@")) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginTrim);
    if (!emailOk) {
      return NextResponse.json(
        { error: { code: "validation", message: "Некорректный email" } },
        { status: 400 },
      );
    }
  } else {
    const digits = loginTrim.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json(
        {
          error: {
            code: "validation",
            message: "Укажите email (с символом @) или номер телефона (не меньше 10 цифр).",
          },
        },
        { status: 400 },
      );
    }
  }

  const existing = await findUserByLogin(data.login);
  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: "duplicate",
          message: "Этот email или телефон уже зарегистрирован. Войдите с тем же паролем.",
        },
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(data.password);

  try {
    if (data.role === "USER") {
      const { email, phone } = normalizeLogin(data.login);
      if (!email && !phone) {
        return NextResponse.json(
          { error: { code: "validation", message: "Укажите email или телефон" } },
          { status: 400 },
        );
      }

      const user = await prisma.user.create({
        data: {
          email,
          phone,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          role: Role.USER,
        },
      });
      const sr = prismaRoleToSessionRole(user.role);
      return jsonWithSession(req, user.id, sr, { ok: true as const, role: sr });
    }

    const { email, phone } = normalizeLogin(data.login);
    if (!email && !phone) {
      return NextResponse.json(
        { error: { code: "validation", message: "Укажите email или телефон" } },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        firstName: data.firstName ?? "Партнёр",
        lastName: data.lastName ?? "",
        role: Role.PARTNER,
        partner: {
          create: {
            companyName: data.companyName,
            city: data.city,
            locations: 0,
          },
        },
      },
    });

    const sr = prismaRoleToSessionRole(user.role);
    return jsonWithSession(req, user.id, sr, { ok: true as const, role: sr });
  } catch (e: unknown) {
    console.error("[auth/register]", e);
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return NextResponse.json(
        { error: { code: "duplicate", message: duplicateRegisterMessage(e) } },
        { status: 409 },
      );
    }
    if (isPrismaConnectionError(e)) {
      return NextResponse.json(
        { error: { code: "db_unreachable", message: dbUnreachableUserMessage() } },
        { status: 503 },
      );
    }
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { error: { code: "db_schema_outdated", message: "Сервер обновляется. Повторите регистрацию через 1-2 минуты." } },
        { status: 503 },
      );
    }
    if (e instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        {
          error: {
            code: "validation",
            message: "Проверьте поля: email или телефон, название компании, город.",
          },
        },
        { status: 400 },
      );
    }
    const em = e instanceof Error ? e.message : String(e);
    if (em.includes("AUTH_SECRET") || em.includes("32 characters")) {
      return NextResponse.json(
        { error: { code: "config", message: "На сервере не задан AUTH_SECRET (не менее 32 символов)." } },
        { status: 503 },
      );
    }
    const msg =
      process.env.NODE_ENV === "development"
        ? `Ошибка сервера: ${em}`
        : "Ошибка регистрации. Попробуйте снова или укажите другой email/телефон.";
    return NextResponse.json({ error: { code: "internal", message: msg } }, { status: 500 });
  }
}

async function jsonWithSession(req: Request, userId: string, role: SessionRole, body: Record<string, unknown>) {
  let token: string;
  try {
    token = await signSession(userId, role);
  } catch (signErr) {
    const sm = signErr instanceof Error ? signErr.message : String(signErr);
    console.error("[auth/register] signSession", signErr);
    if (sm.includes("AUTH_SECRET") || sm.includes("32 characters")) {
      return NextResponse.json(
        { error: { code: "config", message: "На сервере не задан AUTH_SECRET (не менее 32 символов)." } },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "session",
          message: "Аккаунт создан, но сессия не установилась. Проверьте AUTH_SECRET на сервере и повторите вход.",
        },
      },
      { status: 503 },
    );
  }
  try {
    const res = NextResponse.json(body);
    res.headers.set("Cache-Control", "private, no-store, must-revalidate");
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
    return res;
  } catch (cookieErr) {
    console.error("[auth/register] set-cookie", cookieErr);
    return NextResponse.json(
      { error: { code: "session", message: "Не удалось сохранить сессию в браузере. Попробуйте войти вручную." } },
      { status: 503 },
    );
  }
}
