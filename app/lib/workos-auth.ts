export const WORKOS_SESSION_COOKIE = "workos_session";

function configuredPassword() {
  return process.env.WORKOS_PASSWORD
    || process.env.OGILVYOS_PASSWORD
    || process.env.APP_PASSWORD
    || process.env.SITE_PASSWORD
    || null;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isWorkOSAuthConfigured() {
  return Boolean(configuredPassword());
}

export async function workOSSessionValue() {
  const password = configuredPassword();
  if (!password) return null;
  return digest(`workos-session:v1:${password}`);
}

export async function passwordMatches(value: string) {
  const password = configuredPassword();
  if (!password) return false;
  const [candidate, expected] = await Promise.all([
    digest(`workos-password:v1:${value}`),
    digest(`workos-password:v1:${password}`),
  ]);
  if (candidate.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    mismatch |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function validSessionValue(value: string | undefined | null) {
  if (!value) return false;
  const expected = await workOSSessionValue();
  if (!expected || expected.length !== value.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ value.charCodeAt(index);
  }
  return mismatch === 0;
}

export function cookieFromRequest(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const entry of header.split(";")) {
    const [key, ...rest] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function requestIsAuthorized(request: Request) {
  return validSessionValue(cookieFromRequest(request, WORKOS_SESSION_COOKIE));
}
