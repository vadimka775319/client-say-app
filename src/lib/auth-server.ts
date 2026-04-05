import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySession, type SessionRole } from "@/lib/auth-session";
import type { Role, User } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  city: string;
  points: number;
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== payload.role) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    city: user.city ?? "",
    points: user.points,
  };
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session || !allowed.includes(session.role)) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plain, hash);
}

/** Единый вид телефона РФ в БД: +7XXXXXXXXXX (10 цифр после кода страны). */
export function canonicalPhoneRu(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+${d}`;
  if (d.length === 10) return `+7${d}`;
  return input.trim();
}

export function prismaRoleToSessionRole(r: Role): SessionRole {
  switch (r) {
    case "USER":
      return "USER";
    case "PARTNER":
      return "PARTNER";
    case "SUPER_ADMIN":
      return "SUPER_ADMIN";
    default:
      throw new Error(`Unsupported role for session: ${String(r)}`);
  }
}

export function normalizeLogin(login: string): { email: string | null; phone: string | null } {
  const t = login.trim();
  if (!t) return { email: null, phone: null };
  if (t.includes("@")) return { email: t.toLowerCase(), phone: null };
  return { email: null, phone: canonicalPhoneRu(t) };
}

export async function findUserByLogin(login: string): Promise<User | null> {
  const t = login.trim();
  if (!t) return null;
  if (t.includes("@")) {
    return prisma.user.findUnique({ where: { email: t.toLowerCase() } });
  }
  const d = t.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(t);
  variants.add(canonicalPhoneRu(t));
  if (d) variants.add(d);
  if (d.length === 11 && d.startsWith("8")) {
    variants.add(`+7${d.slice(1)}`);
    variants.add(`7${d.slice(1)}`);
  }
  if (d.length === 11 && d.startsWith("7")) {
    variants.add(`+${d}`);
    variants.add(`8${d.slice(1)}`);
  }
  if (d.length === 10) {
    variants.add(`+7${d}`);
    variants.add(`8${d}`);
    variants.add(`7${d}`);
  }
  for (const p of variants) {
    if (!p) continue;
    const u = await prisma.user.findUnique({ where: { phone: p } });
    if (u) return u;
  }
  return null;
}
