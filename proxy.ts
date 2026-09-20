import { NextRequest, NextResponse } from "next/server";
import {
  isWorkOSAuthConfigured,
  validSessionValue,
  WORKOS_SESSION_COOKIE,
} from "@/app/lib/workos-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (!isWorkOSAuthConfigured()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?setup=1";
    return NextResponse.redirect(url);
  }

  const session = request.cookies.get(WORKOS_SESSION_COOKIE)?.value;
  if (await validSessionValue(session)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/accounts/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/team/:path*",
    "/calendar/:path*",
    "/holidays/:path*",
  ],
};
