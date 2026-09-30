import { NextResponse } from "next/server";
import {
  isWorkOSAuthConfigured,
  passwordRole,
  WORKOS_SESSION_COOKIE,
  workOSSessionValue,
} from "@/app/lib/workos-auth";

export async function POST(request: Request) {
  if (!isWorkOSAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?setup=1", request.url), 303);
  }

  const form = await request.formData();
  const password = String(form.get("password") || "");
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
