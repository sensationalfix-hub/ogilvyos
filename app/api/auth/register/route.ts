import { NextResponse } from "next/server";
import { supabaseSignUp } from "@/app/lib/supabase-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/register?error=missing", request.url), 303);
  }

  if (password.length < 10) {
    return NextResponse.redirect(new URL("/register?error=weak", request.url), 303);
  }

  if (password !== confirm) {
    return NextResponse.redirect(new URL("/register?error=mismatch", request.url), 303);
  }

  const redirectTo = new URL("/login?confirmed=1", request.url).toString();
  const result = await supabaseSignUp(email, password, redirectTo);

  if (!result.ok) {
    const url = new URL("/register", request.url);
    url.searchParams.set("error", "signup");
    url.searchParams.set("message", result.error.slice(0, 180));
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/register?sent=1", request.url), 303);
}
