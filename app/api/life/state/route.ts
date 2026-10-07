import { NextResponse } from "next/server";
import { lifeSelect, lifeSession } from "@/app/lib/life-store";

type Area = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  accent: string | null;
  position: number;
};

type Goal = {
  id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  progress: number;
};

type Project = {
  id: string;
  area_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  progress: number;
};

type Task = {
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

export async function GET(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [areas, goals, projects, tasks] = await Promise.all([
      lifeSelect<Area>(session.accessToken, "life_areas", "select=id,name,slug,icon,accent,position&archived=eq.false&order=position.asc"),
      lifeSelect<Goal>(session.accessToken, "life_goals", "select=id,area_id,title,description,status,priority,target_date,progress&status=not.in.(completed,cancelled)&order=created_at.desc"),
      lifeSelect<Project>(session.accessToken, "life_projects", "select=id,area_id,goal_id,title,description,status,priority,target_date,progress&status=not.in.(completed,cancelled)&order=updated_at.desc"),
      lifeSelect<Task>(session.accessToken, "life_tasks", "select=id,area_id,project_id,goal_id,title,status,priority,starts_at,ends_at,due_date,estimated_minutes,energy&status=not.in.(completed,cancelled)&order=created_at.desc"),
    ]);

    return NextResponse.json({
      source: "supabase",
      areas,
      goals,
      projects,
      tasks,
      counts: {
        areas: areas.length,
        goals: goals.length,
        projects: projects.length,
        tasks: tasks.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar LifeOS" },
      { status: 500 },
    );
  }
}
