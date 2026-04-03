import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export async function POST() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true as const });
}
