import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Нет сессии" } }, { status: 401 });
  }

  if (session.role === "PARTNER") {
    const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
    return NextResponse.json({
      user: session,
      partner: partner
        ? {
            id: partner.id,
            companyName: partner.companyName,
            city: partner.city,
            addressLine: partner.addressLine,
            locations: partner.locations,
          }
        : null,
    });
  }

  return NextResponse.json({ user: session, partner: null });
}
