import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Публичная витрина призов для лендинга (без авторизации). */
export async function GET() {
  const now = new Date();
  const rows = await prisma.reward.findMany({
    where: {
      stockLeft: { gt: 0 },
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: "asc" },
    take: 24,
  });

  const rewards = rows.map((r) => ({
    id: r.id,
    partnerId: r.partnerId,
    fundedByPlatform: r.fundedByPlatform,
    title: r.title,
    description: r.description,
    termsText: r.termsText || "",
    rulesText: r.rulesText || "",
    imageUrl: r.imageUrl,
    pointsCost: r.pointsCost,
    totalStock: r.totalStock,
    stockLeft: r.stockLeft,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));

  const res = NextResponse.json({ rewards });
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  return res;
}
