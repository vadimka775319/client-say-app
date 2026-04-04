import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  /** Положительное — начисление демо-брифа; отрицательное — откат сценария в блоке «Демо». */
  delta: z.number().int().min(-500).max(500),
});

/** Демо: начисление баллов за «прохождение брифа» в кабинете (только USER). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "USER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Нужен вход как пользователь" } }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело" } }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Некорректная сумма" } }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) {
    return NextResponse.json({ error: { code: "not_found", message: "Пользователь не найден" } }, { status: 404 });
  }
  const next = user.points + parsed.data.delta;
  if (next < 0) {
    return NextResponse.json({ error: { code: "validation", message: "Баллов недостаточно для отката" } }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: { points: next },
  });

  return NextResponse.json({ points: updated.points });
}
