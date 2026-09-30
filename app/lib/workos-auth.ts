import {
  resolveSupabaseIdentity,
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_REFRESH_COOKIE,
  supabaseRefresh,
} from "@/app/lib/supabase-auth";

export const WORKOS_SESSION_COOKIE = "workos_session";

export type WorkOSRole = "editor" | "viewer" | "employee";

export type WorkOSIdentity = {
  role: WorkOSRole;
  name: string;
  initials: string;
  employeeName: string | null;
  source: "legacy" | "supabase";
  refreshedAccessToken?: string;
  refreshedRefreshToken?: string;
};

function configuredPassword() {
  return process.env.APP_ACCESS_PASSWORD
    || process.env.WORKOS_PASSWORD
    || process.env.OGILVYOS_PASSWORD
    || process.env.APP_PASSWORD
    || process.env.SITE_PASSWORD
    || null;
}

function configuredViewerPassword() {
  return process.env.RAMIRO_ACCESS_PASSWORD
    || process.env.WORKOS_VIEWER_PASSWORD
    || null;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isWorkOSAuthConfigured() {
  return Boolean(configuredPassword());
}

export function isViewerAuthConfigured() {
  return Boolean(configuredViewerPassword());
}

export async function workOSSessionValue(role: "editor" | "viewer" = "editor") {
  const password = role === "viewer" ? configuredViewerPassword() : configuredPassword();
  if (!password) return null;
  return digest(`workos-session:v2:${role}:${password}`);
}

export async function passwordRole(value: string): Promise<"editor" | "viewer" | null> {
  const editorPassword = configuredPassword();
  const viewerPassword = configuredViewerPassword();

  if (editorPassword) {
    const [candidate, expected] = await Promise.all([
      digest(`workos-password:v1:${value}`),
      digest(`workos-password:v1:${editorPassword}`),
    ]);
    if (await safeEqual(candidate, expected)) return "editor";
  }

  if (viewerPassword) {
    const [candidate, expected] = await Promise.all([
      digest(`workos-password:v1:${value}`),
      digest(`workos-password:v1:${viewerPassword}`),
    ]);
    if (await safeEqual(candidate, expected)) return "viewer";
  }

  return null;
}

export async function sessionRoleFromValue(value: string | undefined | null): Promise<"editor" | "viewer" | null> {
  if (!value) return null;

  const editor = await workOSSessionValue("editor");
  if (editor && await safeEqual(editor, value)) return "editor";

  const viewer = await workOSSessionValue("viewer");
  if (viewer && await safeEqual(viewer, value)) return "viewer";

  return null;
}

export async function validSessionValue(value: string | undefined | null) {
  return Boolean(await sessionRoleFromValue(value));
}

export function cookieFromRequest(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const entry of header.split(";")) {
    const [key, ...rest] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function mapSupabaseRole(role: string): WorkOSRole {
  if (role === "admin") return "editor";
  if (role === "viewer_global") return "viewer";
  return "employee";
}

export async function requestIdentity(request: Request): Promise<WorkOSIdentity | null> {
  const accessToken = cookieFromRequest(request, SUPABASE_ACCESS_COOKIE);
  if (accessToken) {
    const identity = await resolveSupabaseIdentity(accessToken);
    if (identity) {
      return {
        role: mapSupabaseRole(identity.profile.role),
        name: identity.profile.full_name || identity.user.email || "WorkOS",
        initials: identity.profile.initials || (identity.profile.full_name || identity.user.email || "WO").slice(0, 2).toUpperCase(),
        employeeName: identity.profile.employee_name,
        source: "supabase",
      };
    }
  }

  const refreshToken = cookieFromRequest(request, SUPABASE_REFRESH_COOKIE);
  if (refreshToken) {
    const refreshed = await supabaseRefresh(refreshToken);
    if (refreshed?.access_token) {
      const identity = await resolveSupabaseIdentity(refreshed.access_token);
      if (identity) {
        return {
          role: mapSupabaseRole(identity.profile.role),
          name: identity.profile.full_name || identity.user.email || "WorkOS",
          initials: identity.profile.initials || (identity.profile.full_name || identity.user.email || "WO").slice(0, 2).toUpperCase(),
          employeeName: identity.profile.employee_name,
          source: "supabase",
          refreshedAccessToken: refreshed.access_token,
          refreshedRefreshToken: refreshed.refresh_token,
        };
      }
    }
  }

  const legacyRole = await sessionRoleFromValue(cookieFromRequest(request, WORKOS_SESSION_COOKIE));
  if (!legacyRole) return null;

  return {
    role: legacyRole,
    name: legacyRole === "viewer" ? "Ramiro" : "Jorge",
    initials: legacyRole === "viewer" ? "RM" : "JC",
    employeeName: null,
    source: "legacy",
  };
}

export async function requestRole(request: Request) {
  return (await requestIdentity(request))?.role ?? null;
}

export async function requestIsAuthorized(request: Request) {
  return Boolean(await requestIdentity(request));
}

export async function requestCanWrite(request: Request) {
  return (await requestRole(request)) === "editor";
}
