import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Публичный список партнёров для кабинета пользователя (без QR и секретов). */
export async function GET() {
  try {
    const rows = await prisma.partner.findMany({
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        companyName: true,
        city: true,
        addressLine: true,
        locations: true,
      },
    });
    return NextResponse.json({ partners: rows });
  } catch {
    return NextResponse.json({ partners: [] as unknown[] });
  }
}
