import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Чтобы nginx/Cloudflare не отдавали старый HTML страницы входа вместе со старыми чанками. */
const NO_STORE =
  "private, no-store, no-cache, must-revalidate, max-age=0";

export function middleware(request: NextRequest) {
  void request.nextUrl.pathname;
  const res = NextResponse.next();
  res.headers.set("Cache-Control", NO_STORE);
  res.headers.set("Pragma", "no-cache");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vary", "Cookie, Accept-Encoding");
  return res;
}

export const config = {
  matcher: ["/sign-in", "/sign-in/:path*"],
};
