import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Публичный список партнёров для кабинета пользователя (без QR и секретов). */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  try {
    const rows = await prisma.partner.findMany({
      where: city
        ? {
            city: {
              equals: city,
              mode: "insensitive",
            },
          }
        : undefined,
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        companyName: true,
        city: true,
        addressLine: true,
        locations: true,
        _count: { select: { briefs: true } },
        briefs: {
          take: 5,
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true },
        },
      },
    });
    const partners = rows.map(({ _count, briefs, ...p }) => ({
      ...p,
      briefCount: _count.briefs,
      briefs,
    }));
    return NextResponse.json({ partners });
  } catch {
    return NextResponse.json({ partners: [] as unknown[] });
  }
}
