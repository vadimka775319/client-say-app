import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { dbUnreachableUserMessage } from "@/lib/db-unreachable-message";
import { prisma } from "@/lib/prisma";

function readDeployMeta(): {
  gitShort: string | null;
  deployedAt: string | null;
  source: "file" | "env" | "none";
} {
  try {
    const p = join(process.cwd(), "public", "deploy-meta.json");
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf8")) as { gitShort?: string; deployedAt?: string };
      return {
        gitShort: j.gitShort ?? null,
        deployedAt: j.deployedAt ?? null,
        source: "file",
      };
    }
  } catch {
    // fallback: .env (если когда-то снова понадобится)
  }
  const gitShort = process.env.DEPLOY_GIT_SHA?.replace(/^"|"$/g, "") ?? null;
  const deployedAt = process.env.DEPLOYED_AT?.replace(/^"|"$/g, "") ?? null;
  if (gitShort || deployedAt) {
    return { gitShort, deployedAt, source: "env" };
  }
  return { gitShort: null, deployedAt: null, source: "none" };
}

/** Проверка доступности БД (для диагностики на сервере). */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const deploy = readDeployMeta();

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
