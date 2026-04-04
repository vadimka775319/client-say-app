import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "USER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Нужен вход как пользователь" } }, { status: 403 });
  }

  const now = new Date();
  const rows = await prisma.reward.findMany({
    where: {
      stockLeft: { gt: 0 },
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: "asc" },
  });

  const rewards = rows.map((r) => ({
    id: r.id,
    partnerId: r.partnerId,
    fundedByPlatform: r.fundedByPlatform,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    pointsCost: r.pointsCost,
    totalStock: r.totalStock,
    stockLeft: r.stockLeft,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));

  return NextResponse.json({ rewards });
}
