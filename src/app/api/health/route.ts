import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Проверка доступности БД (для диагностики на сервере). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down", hint: "Проверьте DATABASE_URL и что PostgreSQL запущен." }, { status: 503 });
  }
}
