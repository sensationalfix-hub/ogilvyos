import { NextResponse } from "next/server";
import { requestIdentity } from "@/app/lib/workos-auth";

export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return NextResponse.json({ authenticated: false }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    role: identity.role,
    name: identity.name,
    initials: identity.initials,
    employeeName: identity.employeeName,
    source: identity.source,
  });
}
