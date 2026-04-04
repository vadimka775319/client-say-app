import { SignJWT, jwtVerify } from "jose";
import { env, requireAuthSecret } from "@/lib/env";

/** Совпадает с Prisma enum `Role`; без импорта из `@prisma/client` — удобно для proxy/Edge. */
export type SessionRole = "USER" | "PARTNER" | "SUPER_ADMIN";

const COOKIE_NAME = "clientsay_session";

function getSecretBytes() {
  const secret = requireAuthSecret();
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string, role: SessionRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretBytes());
}

export async function verifySession(token: string): Promise<{ userId: string; role: SessionRole } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretBytes());
    const sub = payload.sub;
    const role = payload.role as SessionRole | undefined;
    if (!sub || !role) return null;
    if (role !== "USER" && role !== "PARTNER" && role !== "SUPER_ADMIN") return null;
    return { userId: sub, role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/**
 * За nginx без X-Forwarded-Proto сессия «не логинилась»: в production всегда ставился Secure=true,
 * а браузер по HTTP не сохраняет такую cookie. Учитываем заголовок прокси.
 */
export function sessionCookieOptions(req?: Request) {
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  if (env.NODE_ENV !== "production") {
    return { ...base, secure: false as const };
  }
  const proto = req?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "http") {
    return { ...base, secure: false as const };
  }
  return { ...base, secure: true as const };
}
