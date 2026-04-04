import { NextResponse } from "next/server";
import { Prisma, QuestionType } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { computeBriefPoints, economyRules } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
});

function optionsFromJson(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  return [];
}

export async function POST(req: Request, ctx: { params: Promise<{ briefId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "USER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Войдите как пользователь, чтобы отправить бриф" } }, { status: 403 });
  }

  const { briefId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело" } }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Передайте ответы" } }, { status: 400 });
  }

  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!brief) {
    return NextResponse.json({ error: { code: "not_found", message: "Бриф не найден" } }, { status: 404 });
  }

  const last = await prisma.briefResponse.findFirst({
    where: { userId: session.id, partnerId: brief.partnerId },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const days = (Date.now() - last.createdAt.getTime()) / 86_400_000;
    if (days < economyRules.minDaysBetweenSamePartnerBrief) {
      const left = Math.ceil(economyRules.minDaysBetweenSamePartnerBrief - days);
      return NextResponse.json(
        {
          error: {
            code: "cooldown",
            message: `У этой компании бриф уже проходили. Следующий раз через ~${left} дн.`,
          },
        },
        { status: 409 },
      );
    }
  }

  const answersIn = parsed.data.answers;
  const answersOut: Record<string, unknown> = {};

  for (const q of brief.questions) {
    const raw = answersIn[q.id];
    if (raw === undefined) {
      return NextResponse.json({ error: { code: "validation", message: "Ответьте на все вопросы" } }, { status: 400 });
    }

    if (q.type === QuestionType.TEXT) {
      if (typeof raw !== "string" || !raw.trim()) {
        return NextResponse.json({ error: { code: "validation", message: "Текстовый ответ не может быть пустым" } }, { status: 400 });
      }
      answersOut[q.id] = raw.trim();
      continue;
    }

    if (q.type === QuestionType.RATING) {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) {
        return NextResponse.json({ error: { code: "validation", message: "Оценка должна быть целым числом 1–5" } }, { status: 400 });
      }
      answersOut[q.id] = n;
      continue;
    }

    if (q.type === QuestionType.CHOICE) {
      const s = typeof raw === "string" ? raw.trim() : String(raw);
      const opts = optionsFromJson(q.options);
      if (opts.length < 2) {
        return NextResponse.json({ error: { code: "validation", message: "Бриф настроен некорректно" } }, { status: 400 });
      }
      if (!opts.includes(s)) {
        return NextResponse.json({ error: { code: "validation", message: "Выберите вариант из списка" } }, { status: 400 });
      }
      answersOut[q.id] = s;
    }
  }

  const pointsAwarded = brief.pointsOverride ?? computeBriefPoints(brief.questions.length);

  await prisma.$transaction(async (tx) => {
    await tx.briefResponse.create({
      data: {
        briefId: brief.id,
        userId: session.id,
        partnerId: brief.partnerId,
        answers: answersOut as Prisma.InputJsonValue,
        pointsAwarded,
      },
    });
    await tx.user.update({
      where: { id: session.id },
      data: { points: { increment: pointsAwarded } },
    });
  });

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { points: true } });
  return NextResponse.json({ ok: true, pointsAwarded, points: user?.points ?? 0 });
}
