/**
 * Вся бизнес-логика регистрации/входа без привязки к NextResponse (легко тестировать и отлаживать).
 */

import { Prisma, Role } from "@prisma/client";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { findUserByLogin, hashPassword, prismaRoleToSessionRole, verifyPassword } from "@/lib/auth-server";
import { isPrismaConnectionError, prisma } from "@/lib/prisma";
import { isStoredRuPhone, normalizeLogin } from "@/lib/login-identity";
import type { SessionRole } from "@/lib/auth-session";

export type RegisterPayload =
  | {
      role: "USER";
      login: string;
      password: string;
      firstName: string;
      lastName: string;
    }
  | {
      role: "PARTNER";
      login: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName: string;
      city: string;
    };

export type AuthFailure = { ok: false; status: number; code: string; message: string };
export type AuthRegisterSuccess = { ok: true; userId: string; role: SessionRole };
export type AuthLoginSuccess = { ok: true; userId: string; role: SessionRole };

function fail(status: number, code: string, message: string): AuthFailure {
  return { ok: false, status, code, message };
}

/** Разбор тела POST /api/auth/register без discriminatedUnion (стабильно при любой версии zod). */
export function parseRegisterRequest(input: unknown): { ok: true; data: RegisterPayload } | AuthFailure {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "bad_request", "Некорректное тело запроса.");
  }
  const o = input as Record<string, unknown>;
  const role = o.role;
  const login = typeof o.login === "string" ? o.login.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";

  if (role !== "USER" && role !== "PARTNER") {
    return fail(400, "validation", "Укажите role: USER или PARTNER.");
  }
  if (!login) {
    return fail(400, "validation", "Укажите email или телефон.");
  }
  if (!password || password.length < 6) {
    return fail(400, "validation", "Пароль: не меньше 6 символов.");
  }

  if (role === "USER") {
    const firstName = typeof o.firstName === "string" ? o.firstName.trim() : "";
    const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
    if (!firstName) {
      return fail(400, "validation", "Укажите имя.");
    }
    return { ok: true, data: { role: "USER", login, password, firstName, lastName } };
  }

  const companyName = typeof o.companyName === "string" ? o.companyName.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const firstNameRaw = typeof o.firstName === "string" ? o.firstName.trim() : "";
  const firstName = firstNameRaw || "Партнёр";
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";

  if (!companyName || companyName.length < 2) {
    return fail(400, "validation", "Укажите название компании (минимум 2 символа).");
  }
  if (!city) {
    return fail(400, "validation", "Укажите город.");
  }
  if (city.length > 120) {
    return fail(400, "validation", "Название города не длиннее 120 символов.");
  }

  return {
    ok: true,
    data: { role: "PARTNER", login, password, firstName, lastName, companyName, city },
  };
}

/** Email и/или телефон так же, как в БД. */
export function resolveRegisterCredentials(login: string): { ok: true; email: string | null; phone: string | null } | AuthFailure {
  const t = login.trim();
  if (t.includes("@")) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
    if (!ok) return fail(400, "validation", "Некорректный email.");
    return { ok: true, email: t.toLowerCase(), phone: null };
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10) {
    return fail(400, "validation", "Телефон: не меньше 10 цифр или укажите email с символом @.");
  }
  const { email, phone } = normalizeLogin(t);
  if (!email && (!phone || !isStoredRuPhone(phone))) {
    return fail(
      400,
      "validation",
      "Телефон: укажите российский номер (10 цифр), например 9161234567 или 89563654789.",
    );
  }
  return { ok: true, email, phone };
}

function duplicateMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const raw = e.meta?.target;
    const fields = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : [];
    if (fields.some((f) => f === "phone")) {
      return "Этот телефон уже зарегистрирован. Войдите или укажите другой номер.";
    }
    if (fields.some((f) => f === "email")) {
      return "Этот email уже занят. Войдите или укажите другой адрес.";
    }
  }
  return "Такой email или телефон уже зарегистрирован.";
}

/** Внешние route handlers: любой необработанный выброс (например findUserByLogin при падении БД). */
export function authFailureFromUnknown(e: unknown, context: "register" | "login"): AuthFailure {
  return mapDbError(e, context);
}

function mapDbError(e: unknown, context: "register" | "login"): AuthFailure {
  console.error(`[auth-service] ${context}`, e);
  const msg = e instanceof Error ? e.message : String(e);

  if (msg.includes("AUTH_SECRET") || msg.includes("32 characters")) {
    return fail(503, "config", "На сервере не задан AUTH_SECRET (не менее 32 символов).");
  }
  if (isPrismaConnectionError(e) || msg.includes("DATABASE_URL")) {
    return fail(503, "db_unreachable", dbUnreachableUserMessage());
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return fail(409, "duplicate", duplicateMessage(e));
    }
    if (e.code === "P2021" || e.code === "P2022") {
      return fail(503, "db_schema_outdated", "База не совпадает со схемой. На сервере выполните: npx prisma db push");
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return fail(400, "validation", "Проверьте формат полей (email, телефон, компания, город).");
  }

  if (process.env.NODE_ENV === "development") {
    return fail(500, "internal", `${context} (dev): ${msg || String(e)}`);
  }
  return fail(
    500,
    "internal",
    "Серверная ошибка. Откройте /api/health (db: up), проверьте DATABASE_URL и AUTH_SECRET.",
  );
}

export async function persistRegisteredUser(
  data: RegisterPayload,
  email: string | null,
  phone: string | null,
  passwordHash: string,
): Promise<AuthRegisterSuccess | AuthFailure> {
  try {
    if (data.role === "USER") {
      const user = await prisma.user.create({
        data: {
          email,
          phone,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: Role.USER,
        },
      });
      return { ok: true, userId: user.id, role: prismaRoleToSessionRole(user.role) };
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
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
    return { ok: true, userId: user.id, role: prismaRoleToSessionRole(user.role) };
  } catch (e: unknown) {
    return mapDbError(e, "register");
  }
}

export function parseLoginRequest(input: unknown): { ok: true; login: string; password: string; expectedRole?: SessionRole } | AuthFailure {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "bad_request", "Некорректное тело запроса.");
  }
  const o = input as Record<string, unknown>;
  const login = typeof o.login === "string" ? o.login.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  const er = o.expectedRole;
  let expectedRole: SessionRole | undefined;
  if (er === "USER" || er === "PARTNER" || er === "SUPER_ADMIN") {
    expectedRole = er;
  } else if (er != null && er !== "") {
    return fail(400, "validation", "Некорректное значение expectedRole.");
  }

  if (!login || !password) {
    return fail(400, "validation", "Введите логин и пароль.");
  }
  return { ok: true, login, password, expectedRole };
}

export async function performLogin(
  login: string,
  password: string,
  expectedRole?: SessionRole,
): Promise<AuthLoginSuccess | AuthFailure> {
  try {
    const user = await findUserByLogin(login);
    if (!user) {
      return fail(401, "credentials", "Неверный логин или пароль.");
    }

    let ok = false;
    try {
      ok = verifyPassword(password, user.passwordHash);
    } catch {
      return fail(401, "credentials", "Неверный логин или пароль.");
    }
    if (!ok) {
      return fail(401, "credentials", "Неверный логин или пароль.");
    }

    let role: SessionRole;
    try {
      role = prismaRoleToSessionRole(user.role);
    } catch {
      return fail(500, "account", "Учётная запись повреждена. Обратитесь в поддержку.");
    }

    if (expectedRole != null && role !== expectedRole) {
      return fail(403, "wrong_role", "Этот аккаунт не подходит для выбранного кабинета.");
    }

    if (role === "PARTNER") {
      try {
        const existing = await prisma.partner.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (!existing) {
          await prisma.partner.create({
            data: {
              userId: user.id,
              companyName: "Компания",
              city: "",
              locations: 0,
            },
          });
        }
      } catch (e) {
        console.error("[auth-service] performLogin partner row", e);
      }
    }

    return { ok: true, userId: user.id, role };
  } catch (e: unknown) {
    return mapDbError(e, "login");
  }
}

/** Синхронный хеш — обёртка в auth-server. */
export function hashPasswordForRegister(plain: string): { ok: true; hash: string } | AuthFailure {
  try {
    return { ok: true, hash: hashPassword(plain) };
  } catch (e: unknown) {
    console.error("[auth-service] hashPassword", e);
    return fail(500, "internal", "Не удалось обработать пароль. Попробуйте другой пароль.");
  }
}
