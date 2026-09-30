import { NextResponse } from "next/server";
import {
  isWorkOSAuthConfigured,
  passwordRole,
  WORKOS_SESSION_COOKIE,
  workOSSessionValue,
} from "@/app/lib/workos-auth";
import {
  resolveSupabaseIdentity,
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_REFRESH_COOKIE,
  supabaseSignIn,
} from "@/app/lib/supabase-auth";

function setSupabaseCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set({
    name: SUPABASE_ACCESS_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60,
  });
  response.cookies.set({
    name: SUPABASE_REFRESH_COOKIE,
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (email) {
    const session = await supabaseSignIn(email, password);
    if (!session?.access_token || !session.refresh_token) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    }

    const identity = await resolveSupabaseIdentity(session.access_token);
    if (!identity) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    }

    const response = NextResponse.redirect(new URL("/", request.url), 303);
    setSupabaseCookies(response, session.access_token, session.refresh_token);
    response.cookies.set({
      name: WORKOS_SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (!isWorkOSAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?setup=1", request.url), 303);
  }

  const role = await passwordRole(password);
  if (!role) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const session = await workOSSessionValue(role);
  if (!session) {
    return NextResponse.redirect(new URL("/login?setup=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set({
    name: WORKOS_SESSION_COOKIE,
    value: session,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
