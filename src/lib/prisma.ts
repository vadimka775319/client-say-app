import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

/** Один клиент на инстанс (Vercel/serverless и долгоживущий Node). */
globalForPrisma.prisma = client;
export const prisma = client;

/** Соединение с PostgreSQL недоступно (для единообразных ответов login/register). */
export function isPrismaConnectionError(e: unknown): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
  if (["P1000", "P1001", "P1012", "P1017", "P2024"].includes(code)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("Environment variable not found: DATABASE_URL") ||
    lower.includes("connection refused") ||
    lower.includes("econnrefused") ||
    lower.includes("connect econnrefused") ||
    lower.includes("the connection timed out") ||
    lower.includes("server has closed the connection")
  );
}
