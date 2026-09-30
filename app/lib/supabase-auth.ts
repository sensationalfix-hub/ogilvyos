export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://lpjiilefslxlgnupaacz.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_mATu3ZkITNszykDr2nw9DQ_W5MW0GNh";

export const SUPABASE_ACCESS_COOKIE = "workos_sb_access";
export const SUPABASE_REFRESH_COOKIE = "workos_sb_refresh";

export type SupabaseRole = "admin" | "viewer_global" | "employee";

export type WorkOSProfile = {
  id: string;
  email: string | null;
  full_name: string;
  initials: string;
  role: SupabaseRole;
  employee_name: string | null;
  active: boolean;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: AuthUser;
};

function headers(accessToken?: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function supabaseSignIn(email: string, password: string): Promise<AuthSession | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSession>;
}

export async function supabaseRefresh(refreshToken: string): Promise<AuthSession | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSession>;
}

export async function supabaseUser(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(accessToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthUser>;
}

export async function supabaseProfile(accessToken: string, userId: string): Promise<WorkOSProfile | null> {
  const params = new URLSearchParams({
    select: "id,email,full_name,initials,role,employee_name,active",
    id: `eq.${userId}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as WorkOSProfile[];
  return rows[0] ?? null;
}

export async function resolveSupabaseIdentity(accessToken: string) {
  const user = await supabaseUser(accessToken);
  if (!user) return null;
  const profile = await supabaseProfile(accessToken, user.id);
  if (!profile || !profile.active) return null;
  return { user, profile };
}


export async function supabaseSignUp(email: string, password: string, redirectTo: string) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    }
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: String(body?.msg || body?.message || body?.error_description || "No se pudo crear el acceso"),
    };
  }

  return {
    ok: true as const,
    user: body?.user ?? null,
    session: body?.access_token ? body : null,
  };
}
