import { NextResponse } from "next/server";
import { cookieFromRequest, requestIdentity } from "@/app/lib/workos-auth";
import {
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/app/lib/supabase-auth";

async function adminToken(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity || identity.role !== "editor") return null;
  return identity.refreshedAccessToken || cookieFromRequest(request, SUPABASE_ACCESS_COOKIE);
}

async function rpc(request: Request, fn: string, body?: unknown) {
  const token = await adminToken(request);
  if (!token) return { ok: false, status: 403, data: { error: "Forbidden" } };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export async function GET(request: Request) {
  const result = await rpc(request, "admin_list_allowed_accounts");
  return NextResponse.json(result.ok ? { accounts: result.data } : result.data, { status: result.status });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as any;
  if (!input) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const result = await rpc(request, "admin_upsert_allowed_account", {
    p_email: String(input.email || "").trim().toLowerCase(),
    p_full_name: String(input.fullName || "").trim(),
    p_initials: String(input.initials || "").trim(),
    p_role: String(input.role || ""),
    p_employee_name: input.employeeName ? String(input.employeeName).trim() : null,
    p_active: input.active !== false,
  });

  if (!result.ok) return NextResponse.json(result.data || { error: "Could not save access" }, { status: result.status });
  return NextResponse.json({ ok: true });
}
