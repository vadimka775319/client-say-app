import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  rewardId: z.string().min(1),
});

function newRedemptionCode() {
  const a = randomBytes(4).toString("hex").toUpperCase();
  const b = randomBytes(3).toString("hex").toUpperCase();
  return `PRZ-${a}-${b}`;
}

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
    return NextResponse.json({ error: { code: "validation", message: "Укажите приз" } }, { status: 400 });
  }

  const { rewardId } = parsed.data;
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || reward.stockLeft <= 0) {
        throw new Error("NO_STOCK");
      }
      if (reward.startsAt > now || reward.endsAt < now) {
        throw new Error("INACTIVE");
      }

      const user = await tx.user.findUnique({ where: { id: session.id } });
      if (!user || user.points < reward.pointsCost) {
        throw new Error("NO_POINTS");
      }

      let code = newRedemptionCode();
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          await tx.redemption.create({
            data: {
              userId: session.id,
              rewardId: reward.id,
              code,
            },
          });
          break;
        } catch (e: unknown) {
          const c = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
          if (c === "P2002") {
            code = newRedemptionCode();
            continue;
          }
          throw e;
        }
      }

      await tx.reward.update({
        where: { id: reward.id },
        data: { stockLeft: { decrement: 1 } },
      });

      const updatedUser = await tx.user.update({
        where: { id: session.id },
        data: { points: { decrement: reward.pointsCost } },
      });

      return { code, points: updatedUser.points };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_STOCK") {
      return NextResponse.json({ error: { code: "no_stock", message: "Приз закончился" } }, { status: 409 });
    }
    if (msg === "INACTIVE") {
      return NextResponse.json({ error: { code: "inactive", message: "Акция неактивна" } }, { status: 409 });
    }
    if (msg === "NO_POINTS") {
      return NextResponse.json({ error: { code: "no_points", message: "Недостаточно баллов" } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: "internal", message: "Не удалось оформить обмен" } }, { status: 500 });
  }
}
