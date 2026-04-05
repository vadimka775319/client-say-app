import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";

/** Лёгкая проверка сессии для клиента (без лишних JOIN). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false as const }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json(
    { ok: true as const, role: session.role },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
