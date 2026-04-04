import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyName: z.string().min(1).max(200),
  city: z.string().max(120).optional().default(""),
  addressLine: z.string().max(500).optional().default(""),
  locations: z.number().int().min(0).max(9999).optional().default(0),
});

export async function PATCH(req: Request) {
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation", message: "Проверьте данные компании" } }, { status: 400 });
  }

  const { companyName, city, addressLine, locations } = parsed.data;

  const partner = await prisma.partner.upsert({
    where: { userId: session.id },
    update: {
      companyName: companyName.trim(),
      city: city.trim(),
      addressLine: addressLine.trim(),
      locations,
    },
    create: {
      userId: session.id,
      companyName: companyName.trim(),
      city: city.trim(),
      addressLine: addressLine.trim(),
      locations,
    },
  });

  return NextResponse.json({
    partner: {
      id: partner.id,
      companyName: partner.companyName,
      city: partner.city,
      addressLine: partner.addressLine,
      locations: partner.locations,
    },
  });
}
