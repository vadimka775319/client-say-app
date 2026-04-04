import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return res;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return noStore(NextResponse.json({ error: { code: "unauthorized", message: "Нет сессии" } }, { status: 401 }));
  }

  if (session.role === "PARTNER") {
    const partner = await prisma.partner.findUnique({ where: { userId: session.id } });
    return noStore(NextResponse.json({
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
      stats: null as { briefsCompleted: number } | null,
    }));
  }

  if (session.role === "USER") {
    const briefsCompleted = await prisma.briefResponse.count({ where: { userId: session.id } });
    return noStore(NextResponse.json({
      user: session,
      partner: null,
      stats: { briefsCompleted },
    }));
  }

  return noStore(NextResponse.json({ user: session, partner: null, stats: null }));
}
