import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authCookie = req.cookies.get("escape_auth");

  // Protect /play and /clear from unauthenticated direct URL access
  if (pathname.startsWith("/play") || pathname.startsWith("/clear")) {
    if (!authCookie || !authCookie.value || authCookie.value.trim().length === 0) {
      // Redirect unauthenticated visitors back to the home page
      const homeUrl = new URL("/", req.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/play/:path*", "/clear/:path*"],
};
