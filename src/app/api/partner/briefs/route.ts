import { NextResponse } from "next/server";
import { QuestionType } from "@prisma/client";
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

const createBody = z.object({
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
    questions: { id: string; type: QuestionType; prompt: string; options: unknown; order: number }[];
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

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только партнёру" } }, { status: 403 });
  }

  const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
  if (!partner) {
    return NextResponse.json({ briefs: [], registeredUsers: 0 });
  }

  const [briefRows, distinctUsers] = await Promise.all([
    prisma.brief.findMany({
      where: { partnerId: partner.id },
      orderBy: { updatedAt: "desc" },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { responses: true } },
      },
    }),
    prisma.briefResponse.findMany({
      where: { partnerId: partner.id },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  return NextResponse.json({
    briefs: briefRows.map(serializeBrief),
    registeredUsers: distinctUsers.length,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только партнёру" } }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело" } }, { status: 400 });
  }

  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Проверьте название и вопросы брифа" } }, { status: 400 });
  }

  const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
  if (!partner) {
    return NextResponse.json(
      { error: { code: "no_partner", message: "Сначала сохраните профиль компании" } },
      { status: 400 },
    );
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

  const created = await prisma.brief.create({
    data: {
      partnerId: partner.id,
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

  return NextResponse.json({ brief: serializeBrief(created) });
}
