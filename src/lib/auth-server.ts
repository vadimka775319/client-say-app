import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth-session";
import type { Role, User } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
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

export function normalizeLogin(login: string): { email: string | null; phone: string | null } {
  const t = login.trim();
  if (!t) return { email: null, phone: null };
  if (t.includes("@")) return { email: t.toLowerCase(), phone: null };
  return { email: null, phone: t };
}

export async function findUserByLogin(login: string): Promise<User | null> {
  const { email, phone } = normalizeLogin(login);
  if (email) return prisma.user.findUnique({ where: { email } });
  if (phone) return prisma.user.findUnique({ where: { phone } });
  return null;
}
