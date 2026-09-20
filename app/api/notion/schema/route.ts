import { NextResponse } from "next/server";
import { requestIsAuthorized } from "@/app/lib/workos-auth";
import {
  DATA_SOURCES,
  extractOptions,
  retrieveDataSource,
  schemaHealth,
  schemaProperty,
} from "@/app/lib/notion-live";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [accounts, projects, tasks, team, holidays, evaluations] = await Promise.all([
      retrieveDataSource(DATA_SOURCES.accounts),
      retrieveDataSource(DATA_SOURCES.projects),
      retrieveDataSource(DATA_SOURCES.tasks),
      retrieveDataSource(DATA_SOURCES.team),
      retrieveDataSource(DATA_SOURCES.holidays),
      retrieveDataSource(DATA_SOURCES.evaluations),
    ]);

    const payload = {
      source: "notion",
      loadedAt: new Date().toISOString(),
      accounts: {
        status: extractOptions(schemaProperty(accounts, "Estado")),
        priority: extractOptions(schemaProperty(accounts, "Prioridad")),
        contract: extractOptions(schemaProperty(accounts, "Contrato")),
      },
      projects: {
        status: extractOptions(schemaProperty(projects, "Estado")),
        priority: extractOptions(schemaProperty(projects, "Prioridad")),
        type: extractOptions(schemaProperty(projects, "Tipo de Proyecto")),
        complexity: extractOptions(schemaProperty(projects, "Complejidad")),
        rating: extractOptions(schemaProperty(projects, "Rating")),
      },
      tasks: {
        status: extractOptions(schemaProperty(tasks, "Status")),
        priority: extractOptions(schemaProperty(tasks, "Prioridad")),
        effort: extractOptions(schemaProperty(tasks, "Esfuerzo")),
        rating: extractOptions(schemaProperty(tasks, "Rating")),
      },
      team: {
        role: extractOptions(schemaProperty(team, "Rol")),
        rating: extractOptions(schemaProperty(team, "Rating")),
        assignment: extractOptions(schemaProperty(team, "Asignacion")),
        contract: extractOptions(schemaProperty(team, "Contrato")),
        skills: extractOptions(schemaProperty(team, "Skills")),
        weaknesses: extractOptions(schemaProperty(team, "Debilidades")),
      },
      holidays: {
        year: extractOptions(schemaProperty(holidays, "Año")),
        segment: extractOptions(schemaProperty(holidays, "Segmento")),
        absenceType: extractOptions(schemaProperty(holidays, "Tipo Ausencia")),
      },
      evaluations: {
        type: extractOptions(schemaProperty(evaluations, "Tipo")),
      },
      health: {
        accounts: schemaHealth(accounts, ["Nombre", "Estado", "Prioridad", "Contrato", "Proyectos", "Tareas"]),
        projects: schemaHealth(projects, ["Nombre", "Estado", "Prioridad", "Tipo de Proyecto", "Cuenta", "Personas", "Tareas", "Evaluaciones"]),
        tasks: schemaHealth(tasks, ["Tarea", "Status", "Prioridad", "Proyecto", "Cuentas", "Equipo", "Fecha", "Evaluaciones"]),
        team: schemaHealth(team, ["Nombre", "Rol", "Rating", "Asignacion", "Contrato", "Skills", "Debilidades", "Proyectos", "Tareas", "Evaluaciones"]),
        holidays: schemaHealth(holidays, ["Empleado", "Equipo", "Fechas", "Tipo Ausencia"]),
        evaluations: schemaHealth(evaluations, ["Evaluación", "Tipo", "Empleado", "Tarea", "Proyecto", "Nota general"]),
      },
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Notion error";
    return NextResponse.json(
      { source: "notion", error: message },
      { status: message === "NOTION_TOKEN_MISSING" ? 503 : 502 }
    );
  }
}
