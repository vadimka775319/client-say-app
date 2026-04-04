import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().default(""),
  email: z.string().max(120).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  city: z.string().max(120).optional().default(""),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "USER") {
    return NextResponse.json({ error: { code: "forbidden", message: "Доступно только пользователю" } }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Некорректное тело" } }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Проверьте имя и контакты" } }, { status: 400 });
  }

  const { firstName, lastName, email, phone, city } = parsed.data;
  const emailTrim = email.trim();
  const emailNorm =
    emailTrim === ""
      ? null
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)
        ? emailTrim.toLowerCase()
        : null;
  if (emailTrim !== "" && emailNorm === null) {
    return NextResponse.json({ error: { code: "validation", message: "Некорректный email" } }, { status: 400 });
  }
  const phoneNorm = phone.trim() === "" ? null : phone.trim();

  try {
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        firstName: firstName.trim(),
        lastName: (lastName ?? "").trim(),
        city: city.trim(),
        email: emailNorm,
        phone: phoneNorm,
      },
    });
    return NextResponse.json({
      user: {
        id: updated.id,
        role: updated.role,
        email: updated.email,
        phone: updated.phone,
        firstName: updated.firstName,
        lastName: updated.lastName,
        city: updated.city,
        points: updated.points,
      },
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return NextResponse.json(
        { error: { code: "duplicate", message: "Такой email или телефон уже занят" } },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: { code: "internal", message: "Не удалось сохранить" } }, { status: 500 });
  }
}
