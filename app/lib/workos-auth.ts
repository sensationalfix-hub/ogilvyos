export const WORKOS_SESSION_COOKIE = "workos_session";

export type WorkOSRole = "editor" | "viewer";

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

export async function workOSSessionValue(role: WorkOSRole = "editor") {
  const password = role === "viewer" ? configuredViewerPassword() : configuredPassword();
  if (!password) return null;
  return digest(`workos-session:v2:${role}:${password}`);
}

export async function passwordRole(value: string): Promise<WorkOSRole | null> {
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

export async function passwordMatches(value: string) {
  return (await passwordRole(value)) === "editor";
}

export async function sessionRoleFromValue(value: string | undefined | null): Promise<WorkOSRole | null> {
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

export async function requestRole(request: Request) {
  return sessionRoleFromValue(cookieFromRequest(request, WORKOS_SESSION_COOKIE));
}

export async function requestIsAuthorized(request: Request) {
  return Boolean(await requestRole(request));
}

export async function requestCanWrite(request: Request) {
  return (await requestRole(request)) === "editor";
}
