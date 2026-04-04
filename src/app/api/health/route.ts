import { NextResponse } from "next/server";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { prisma } from "@/lib/prisma";

/** Проверка доступности БД (для диагностики на сервере). */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        hint: dbUnreachableUserMessage(),
        vercel: process.env.VERCEL === "1",
        hasDatabaseUrl,
      },
      { status: 503 },
    );
  }
}
