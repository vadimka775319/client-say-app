import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { computeBriefPoints } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

const questionSchema = z.object({
  type: z.enum(["TEXT", "RATING", "CHOICE"]),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).max(20).optional(),
  order: z.number().int().min(0).max(99).optional(),
});

const patchBody = z.object({
  title: z.string().min(1).max(200),
  pointsOverride: z.number().int().min(0).max(50_000).nullable().optional(),
  questions: z.array(questionSchema).min(1).max(25),
});

function optionsFromJson(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  return [];
}

function serializeBrief(
  b: {
    id: string;
    title: string;
    pointsOverride: number | null;
    questions: { id: string; type: string; prompt: string; options: unknown; order: number }[];
    _count?: { responses: number };
  },
) {
  const pts = b.pointsOverride ?? computeBriefPoints(b.questions.length);
  return {
    id: b.id,
    title: b.title,
    pointsOverride: b.pointsOverride,
    pointsForComplete: pts,
    responseCount: b._count?.responses ?? 0,
    questions: b.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: optionsFromJson(q.options),
    })),
  };
}

async function briefOwnedByPartner(briefId: string, userId: string) {
  return prisma.brief.findFirst({
    where: { id: briefId, partner: { userId } },
    include: { questions: { orderBy: { order: "asc" } }, _count: { select: { responses: true } } },
  });
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
    return NextResponse.json({ error: { code: "validation", message: "Проверьте данные брифа" } }, { status: 400 });
  }

  const existing = await briefOwnedByPartner(id, session.id);
  if (!existing) {
    return NextResponse.json({ error: { code: "not_found", message: "Бриф не найден" } }, { status: 404 });
  }

  const { title, pointsOverride, questions } = parsed.data;

  for (const q of questions) {
    if (q.type === "CHOICE" && (!q.options || q.options.length < 2)) {
      return NextResponse.json(
        { error: { code: "validation", message: "Для вопроса «выбор» нужно минимум 2 варианта" } },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.briefQuestion.deleteMany({ where: { briefId: id } });
    return tx.brief.update({
      where: { id },
      data: {
        title: title.trim(),
        pointsOverride: pointsOverride ?? null,
        questions: {
          create: questions.map((q, i) => ({
            type: q.type,
            prompt: q.prompt.trim(),
            order: q.order ?? i,
            ...(q.type === "CHOICE" ? { options: q.options?.length ? q.options : [] } : {}),
          })),
        },
      },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { responses: true } },
      },
    });
  });

  return NextResponse.json({ brief: serializeBrief(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только партнёру" } }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.brief.findFirst({
    where: { id, partner: { userId: session.id } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "not_found", message: "Бриф не найден" } }, { status: 404 });
  }

  await prisma.brief.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
