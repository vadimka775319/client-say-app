import { NextResponse } from "next/server";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { prisma } from "@/lib/prisma";

/** Проверка доступности БД (для диагностики на сервере). */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const deploy = {
    /** Короткий SHA последнего деплоя (пишется на VPS в .env скриптом deploy) */
    gitShort: process.env.DEPLOY_GIT_SHA?.replace(/^"|"$/g, "") ?? null,
    deployedAt: process.env.DEPLOYED_AT?.replace(/^"|"$/g, "") ?? null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    const res = NextResponse.json({ ok: true, db: "up", deploy });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch {
    const res = NextResponse.json(
      {
        ok: false,
        db: "down",
        deploy,
        hint: dbUnreachableUserMessage(),
        vercel: process.env.VERCEL === "1",
        hasDatabaseUrl,
      },
      { status: 503 },
    );
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }
}
