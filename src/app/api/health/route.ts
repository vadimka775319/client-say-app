import { NextResponse } from "next/server";
import { getDeployInfo } from "@/lib/deploy-info";
import { dbUnreachableUserMessage, dbUnreachableUserMessageEn } from "@/lib/db-unreachable-message";
import {
  authReadyForProduction,
  authSecretHealth,
  databaseUrlConfigured,
} from "@/lib/health-checks";
import { prisma } from "@/lib/prisma";

const noStore = { "Cache-Control": "no-store, must-revalidate" } as const;

function authHint(authSecret: ReturnType<typeof authSecretHealth>): string | undefined {
  if (authSecret === "ok" || authSecret === "dev_fallback") return undefined;
  if (authSecret === "missing") {
    return "В production задайте AUTH_SECRET не короче 32 символов в .env на сервере и перезапустите процесс.";
  }
  return "AUTH_SECRET слишком короткий (нужно ≥ 32 символов). Исправьте .env и перезапустите приложение.";
}

function authHintEn(authSecret: ReturnType<typeof authSecretHealth>): string | undefined {
  if (authSecret === "ok" || authSecret === "dev_fallback") return undefined;
  if (authSecret === "missing") {
    return "Set AUTH_SECRET (32+ random chars) in production .env and restart the app.";
  }
  return "AUTH_SECRET is too short; use at least 32 characters in .env and restart.";
}

/** Проверка БД + обязательных настроек для входа/регистрации (одна точка правды для мониторинга). */
export async function GET() {
  const deploy = getDeployInfo();
  const databaseUrlSet = databaseUrlConfigured();
  const authSecret = authSecretHealth();
  const authReady = authReadyForProduction();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    const res = NextResponse.json(
      {
        ok: false,
        db: "down",
        errorCode: "db_unreachable",
        deploy,
        databaseUrlSet,
        hasDatabaseUrl: databaseUrlSet,
        authSecret,
        authReady: false,
        hint: dbUnreachableUserMessage(),
        hintEn: dbUnreachableUserMessageEn(),
        vercel: process.env.VERCEL === "1",
      },
      { status: 503, headers: noStore },
    );
    return res;
  }

  if (process.env.NODE_ENV === "production" && !authReady) {
    const res = NextResponse.json(
      {
        ok: false,
        db: "up",
        errorCode: "auth_secret_invalid",
        deploy,
        databaseUrlSet,
        hasDatabaseUrl: databaseUrlSet,
        authSecret,
        authReady: false,
        hint: authHint(authSecret),
        hintEn: authHintEn(authSecret),
      },
      { status: 503, headers: noStore },
    );
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    db: "up",
    deploy,
    databaseUrlSet,
    hasDatabaseUrl: databaseUrlSet,
    authSecret,
    authReady,
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
