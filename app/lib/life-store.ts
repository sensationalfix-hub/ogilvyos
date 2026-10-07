import {
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_REFRESH_COOKIE,
  SUPABASE_URL,
  resolveSupabaseIdentity,
  supabaseRefresh,
} from "@/app/lib/supabase-auth";
import { cookieFromRequest } from "@/app/lib/workos-auth";

export type LifeSession = {
  accessToken: string;
  userId: string;
};

export async function lifeSession(request: Request): Promise<LifeSession | null> {
  const accessToken = cookieFromRequest(request, SUPABASE_ACCESS_COOKIE);
  if (accessToken) {
    const identity = await resolveSupabaseIdentity(accessToken);
    if (identity) return { accessToken, userId: identity.user.id };
  }

  const refreshToken = cookieFromRequest(request, SUPABASE_REFRESH_COOKIE);
  if (!refreshToken) return null;

  const refreshed = await supabaseRefresh(refreshToken);
  if (!refreshed?.access_token) return null;

  const identity = await resolveSupabaseIdentity(refreshed.access_token);
  if (!identity) return null;

  return { accessToken: refreshed.access_token, userId: identity.user.id };
}

function lifeHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + accessToken,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

export async function lifeSelect<T>(
  accessToken: string,
  table: string,
  query: string,
): Promise<T[]> {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + query, {
    headers: lifeHeaders(accessToken),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Supabase " + response.status + ": " + (detail || table));
  }
  return response.json() as Promise<T[]>;
}

export async function lifeInsert<T>(
  accessToken: string,
  table: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: lifeHeaders(accessToken, { Prefer: "return=representation" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Supabase " + response.status + ": " + (detail || table));
  }
  const rows = await response.json() as T[];
  if (!rows[0]) throw new Error("Supabase no devolvió el registro creado");
  return rows[0];
}
