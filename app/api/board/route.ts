import { NextResponse } from "next/server";
import { cookieFromRequest, requestIdentity } from "@/app/lib/workos-auth";
import {
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseUser,
} from "@/app/lib/supabase-auth";

function dbRole(role: "editor" | "viewer" | "employee") {
  return role === "editor" ? "admin" : role === "viewer" ? "viewer_global" : "employee";
}

async function context(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity || identity.source !== "supabase") return null;
  const accessToken = identity.refreshedAccessToken || cookieFromRequest(request, SUPABASE_ACCESS_COOKIE);
  if (!accessToken) return null;
  const user = await supabaseUser(accessToken);
  if (!user) return null;
  return { identity, accessToken, user };
}

function headers(accessToken: string, extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(accessToken),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const [presenceResponse, announcementsResponse, requestsResponse] = await Promise.all([
    rest(ctx.accessToken, `presence?select=user_id,display_name,role,last_seen&last_seen=gte.${encodeURIComponent(cutoff)}&order=last_seen.desc`),
    rest(ctx.accessToken, "announcements?select=id,title,body,priority,pinned,created_by_name,created_at,updated_at&order=pinned.desc,created_at.desc&limit=50"),
    rest(ctx.accessToken, "requests?select=id,author_name,subject,kind,message,status,admin_reply,created_at,updated_at&order=created_at.desc&limit=100"),
  ]);

  if (!presenceResponse.ok || !announcementsResponse.ok || !requestsResponse.ok) {
    return NextResponse.json({ error: "Board unavailable" }, { status: 502 });
  }

  const [presence, announcements, requests] = await Promise.all([
    presenceResponse.json(),
    announcementsResponse.json(),
    requestsResponse.json(),
  ]);

  return NextResponse.json({
    presence,
    announcements,
    requests,
    role: ctx.identity.role,
    viewerName: ctx.identity.role === "employee" && ctx.identity.employeeName ? ctx.identity.employeeName : ctx.identity.name,
  });
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as any;
  if (!body?.action) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const displayName = ctx.identity.role === "employee" && ctx.identity.employeeName
    ? ctx.identity.employeeName
    : ctx.identity.name;

  if (body.action === "heartbeat") {
    const response = await rest(ctx.accessToken, "presence?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: ctx.user.id,
        display_name: displayName,
        role: dbRole(ctx.identity.role),
        last_seen: new Date().toISOString(),
      }),
    });
    return response.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Presence update failed" }, { status: response.status });
  }

  if (body.action === "announcement") {
    if (ctx.identity.role !== "editor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    if (!title || !message) return NextResponse.json({ error: "Completa título y comunicado" }, { status: 400 });

    const response = await rest(ctx.accessToken, "announcements", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        title,
        body: message,
        priority: body.priority === "important" ? "important" : "normal",
        pinned: Boolean(body.pinned),
        created_by: ctx.user.id,
        created_by_name: displayName,
      }),
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? NextResponse.json({ announcement: Array.isArray(data) ? data[0] : data })
      : NextResponse.json(data || { error: "Could not create announcement" }, { status: response.status });
  }

  if (body.action === "request") {
    if (ctx.identity.role === "editor") return NextResponse.json({ error: "Admins do not create requests here" }, { status: 400 });
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const allowedKinds = new Set(["Petición","Bloqueo","Necesito decisión","Acceso","Otro"]);
    const kind = allowedKinds.has(String(body.kind)) ? String(body.kind) : "Petición";
    if (!subject || !message) return NextResponse.json({ error: "Completa asunto y mensaje" }, { status: 400 });

    const response = await rest(ctx.accessToken, "requests", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        author_id: ctx.user.id,
        author_name: displayName,
        subject,
        kind,
        message,
      }),
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? NextResponse.json({ request: Array.isArray(data) ? data[0] : data })
      : NextResponse.json(data || { error: "Could not create request" }, { status: response.status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (!ctx || ctx.identity.role !== "editor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as any;
  const id = String(body?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const allowedStatus = new Set(["Nueva","Revisando","Resuelta"]);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (allowedStatus.has(String(body.status))) payload.status = String(body.status);
  if (typeof body.adminReply === "string") payload.admin_reply = body.adminReply.trim() || null;

  const response = await rest(ctx.accessToken, `requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  return response.ok
    ? NextResponse.json({ request: Array.isArray(data) ? data[0] : data })
    : NextResponse.json(data || { error: "Could not update request" }, { status: response.status });
}


export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = String(url.searchParams.get("id") || "");

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const table = kind === "announcement"
    ? "announcements"
    : kind === "request"
      ? "requests"
      : null;

  if (kind === "announcement" && ctx.identity.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!table) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const response = await rest(ctx.accessToken, `${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  return response.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Could not delete item" }, { status: response.status });
}
