import { NextResponse } from "next/server";
import { WORKOS_SESSION_COOKIE } from "@/app/lib/workos-auth";
import { SUPABASE_ACCESS_COOKIE, SUPABASE_REFRESH_COOKIE } from "@/app/lib/supabase-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  for (const name of [WORKOS_SESSION_COOKIE, SUPABASE_ACCESS_COOKIE, SUPABASE_REFRESH_COOKIE]) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
