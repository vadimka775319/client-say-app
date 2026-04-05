import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth-session";
import { requiredRoleForPath } from "@/lib/auth-routes";

/** Next.js 16: нельзя держать middleware.ts рядом с proxy.ts — заголовки против кэша HTML здесь. */
const SIGN_IN_NO_STORE =
  "private, no-store, no-cache, must-revalidate, max-age=0";

function nextWithSignInCacheHeaders() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", SIGN_IN_NO_STORE);
  res.headers.set("Pragma", "no-cache");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vary", "Cookie, Accept-Encoding");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) {
    return nextWithSignInCacheHeaders();
  }

  const required = requiredRoleForPath(pathname);
  if (!required) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/sign-in";
  signInUrl.searchParams.set("next", pathname);
  signInUrl.searchParams.set("role", required);

  if (!token) {
    return NextResponse.redirect(signInUrl);
  }

  const payload = await verifySession(token);
  if (!payload) {
    const res = NextResponse.redirect(signInUrl);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  if (payload.role !== required) {
    const res = NextResponse.redirect(signInUrl);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  /** Явно включаем /user и /partner (без хвоста), иначе часть версий Next не защищает корень кабинета */
  matcher: [
    "/sign-in",
    "/sign-in/:path*",
    "/admin/:path*",
    "/partner",
    "/partner/:path*",
    "/user",
    "/user/:path*",
  ],
};
