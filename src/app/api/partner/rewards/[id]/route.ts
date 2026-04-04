import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const patchBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  termsText: z.string().max(5000).optional().default(""),
  rulesText: z.string().max(5000).optional().default(""),
  imageUrl: z.string().max(4000).optional().default(""),
  pointsCost: z.number().int().min(0).max(1_000_000),
  totalStock: z.number().int().min(1).max(1_000_000),
  stockLeft: z.number().int().min(0).max(1_000_000),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

function mapReward(r: {
  id: string;
  partnerId: string | null;
  fundedByPlatform: boolean;
  title: string;
  description: string;
  termsText: string;
  rulesText: string;
  imageUrl: string;
  pointsCost: number;
  totalStock: number;
  stockLeft: number;
  startsAt: Date;
  endsAt: Date;
}) {
  return {
    id: r.id,
    partnerId: r.partnerId,
    fundedByPlatform: r.fundedByPlatform,
    title: r.title,
    description: r.description,
    termsText: r.termsText,
    rulesText: r.rulesText,
    imageUrl: r.imageUrl,
    pointsCost: r.pointsCost,
    totalStock: r.totalStock,
    stockLeft: r.stockLeft,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только партнёру" } }, { status: 403 });
  }

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело" } }, { status: 400 });
  }

  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Проверьте поля приза" } }, { status: 400 });
  }

  const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
  if (!partner) {
    return NextResponse.json({ error: { code: "no_partner", message: "Компания не найдена" } }, { status: 400 });
  }

  const existing = await prisma.reward.findFirst({
    where: { id, partnerId: partner.id },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "not_found", message: "Приз не найден" } }, { status: 404 });
  }

  const d = parsed.data;
  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = new Date(d.startsAt);
    endsAt = new Date(d.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("bad");
  } catch {
    return NextResponse.json({ error: { code: "validation", message: "Некорректные даты" } }, { status: 400 });
  }

  const total = d.totalStock;
  const left = Math.min(d.stockLeft, total);

  const updated = await prisma.reward.update({
    where: { id },
    data: {
      title: d.title.trim(),
      description: d.description.trim(),
      termsText: d.termsText.trim(),
      rulesText: d.rulesText.trim(),
      imageUrl: d.imageUrl.trim() || existing.imageUrl,
      pointsCost: d.pointsCost,
      totalStock: total,
      stockLeft: left,
      startsAt,
      endsAt,
    },
  });

  return NextResponse.json({ reward: mapReward(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только партнёру" } }, { status: 403 });
  }

  const { id } = await ctx.params;
  const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
  if (!partner) {
    return NextResponse.json({ error: { code: "no_partner", message: "Компания не найдена" } }, { status: 400 });
  }

  const existing = await prisma.reward.findFirst({
    where: { id, partnerId: partner.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "not_found", message: "Приз не найден" } }, { status: 404 });
  }

  await prisma.reward.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
