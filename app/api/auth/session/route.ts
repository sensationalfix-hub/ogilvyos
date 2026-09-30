import { NextResponse } from "next/server";
import { requestRole } from "@/app/lib/workos-auth";

export async function GET(request: Request) {
  const role = await requestRole(request);
  if (!role) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    role,
    name: role === "viewer" ? "Ramiro" : "Jorge",
  });
}
