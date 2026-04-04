import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth-session";
import { requiredRoleForPath } from "@/lib/auth-routes";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    signInUrl.searchParams.set("reason", "wrong_role");
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  /** Явно включаем /user и /partner (без хвоста), иначе часть версий Next не защищает корень кабинета */
  matcher: ["/admin/:path*", "/partner", "/partner/:path*", "/user", "/user/:path*"],
};
