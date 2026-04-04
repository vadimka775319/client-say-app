import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { isPrismaConnectionError, prisma } from "@/lib/prisma";
import { hashPassword, normalizeLogin } from "@/lib/auth-server";
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
      return jsonWithSession(req, user.id, "USER", { ok: true as const, role: "USER" as const });
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

    return jsonWithSession(req, user.id, "PARTNER", { ok: true as const, role: "PARTNER" as const });
  } catch (e: unknown) {
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
    return NextResponse.json(
      { error: { code: "internal", message: "Ошибка регистрации. Попробуйте снова." } },
      { status: 500 },
    );
  }
}

async function jsonWithSession(req: Request, userId: string, role: SessionRole, body: Record<string, unknown>) {
  const token = await signSession(userId, role);
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "private, no-store, must-revalidate");
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
  return res;
}
