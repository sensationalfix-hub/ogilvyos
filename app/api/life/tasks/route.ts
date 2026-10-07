import { NextResponse } from "next/server";
import { lifeInsert, lifeSession } from "@/app/lib/life-store";

type CreatedTask = {
  id: string;
  area_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  title: string;
  status: string;
  priority: string;
  starts_at: string | null;
  ends_at: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  energy: string | null;
};

export async function POST(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 });

  try {
    const task = await lifeInsert<CreatedTask>(session.accessToken, "life_tasks", {
      user_id: session.userId,
      title,
      status: "backlog",
      priority: "medium",
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la tarea" },
      { status: 500 },
    );
  }
}
