import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/app/lib/workos-auth";
import {
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_REFRESH_COOKIE,
} from "@/app/lib/supabase-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const identity = await requestIdentity(request);
  if (identity) {
    const response = NextResponse.next();

    if (identity.refreshedAccessToken) {
      response.cookies.set({
        name: SUPABASE_ACCESS_COOKIE,
        value: identity.refreshedAccessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60,
      });
    }

    if (identity.refreshedRefreshToken) {
      response.cookies.set({
        name: SUPABASE_REFRESH_COOKIE,
        value: identity.refreshedRefreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  }

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
