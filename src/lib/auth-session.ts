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

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
