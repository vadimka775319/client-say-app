import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export async function POST() {
  const res = NextResponse.json({ ok: true as const });
  res.headers.set("Cache-Control", "private, no-store, must-revalidate");
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
