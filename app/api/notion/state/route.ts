import { NextResponse } from "next/server";
import { requestIsAuthorized } from "@/app/lib/workos-auth";
import { DATA_SOURCES, queryDataSource } from "@/app/lib/notion-live";

export const dynamic = "force-dynamic";

type PageRow = {
  object?: string;
  id: string;
  url?: string;
  properties?: Record<string, any>;
};

const tones = ["pink", "violet", "orange", "green", "blue", "yellow", "cyan", "red"];
const accountColors = ["#8fe94f", "#f97382", "#52c988", "#f2ca52", "#ff8d43", "#ac8cff", "#7e8b86", "#70d6ff", "#ef8ea0", "#ff9f43"];

function compactId(value: string | undefined | null) {
  return String(value || "").replace(/-/g, "");
}

function prop(page: PageRow, name: string) {
  return page.properties?.[name];
}

function plain(parts: any[] | undefined) {
  return Array.isArray(parts)
    ? parts.map((part) => part?.plain_text ?? part?.text?.content ?? "").join("")
    : "";
}

function title(page: PageRow, name: string) {
  const value = prop(page, name);
  return plain(value?.title);
}

function select(page: PageRow, name: string) {
  return prop(page, name)?.select?.name ?? null;
}

function status(page: PageRow, name: string) {
  return prop(page, name)?.status?.name ?? null;
}

function multiSelect(page: PageRow, name: string) {
  const values = prop(page, name)?.multi_select;
  return Array.isArray(values) ? values.map((item: any) => item?.name).filter(Boolean) : [];
}

function relation(page: PageRow, name: string) {
  const values = prop(page, name)?.relation;
  return Array.isArray(values) ? values.map((item: any) => compactId(item?.id)).filter(Boolean) : [];
}

function dateValue(page: PageRow, name: string) {
  const value = prop(page, name)?.date;
  return value ? { start: value.start ?? null, end: value.end ?? value.start ?? null } : null;
}

function numeric(page: PageRow, name: string): number | null {
  const value = prop(page, name);
  if (typeof value?.number === "number") return value.number;
  if (typeof value?.formula?.number === "number") return value.formula.number;
  if (typeof value?.rollup?.number === "number") return value.rollup.number;
  if (typeof value?.rollup?.function === "string" && typeof value?.rollup?.number === "number") return value.rollup.number;
  return null;
}

function starNumber(value: string | null) {
  return value ? (value.match(/★/g) || []).length || null : null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

function stableIndex(value: string, max: number) {
  let hash = 0;
  for (const ch of value) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % max;
}

const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function dateLabel(value: string | null | undefined) {
  if (!value) return "SIN FECHA";
  const date = new Date(value.includes("T") ? value : value + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "SIN FECHA";
  return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]}`;
}

function rangeLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "SIN FECHA";
  if (!end || end === start) return dateLabel(start);
  return `${dateLabel(start)} — ${dateLabel(end)}`;
}

async function queryAll(dataSourceId: string) {
  const results: PageRow[] = [];
  let cursor: string | undefined;
  do {
    const response = await queryDataSource(dataSourceId, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const rows = Array.isArray(response?.results) ? response.results : [];
    for (const row of rows) {
      if (row?.object === "page" && row?.id && row?.properties) results.push(row as PageRow);
    }
    cursor = response?.has_more && response?.next_cursor ? response.next_cursor : undefined;
  } while (cursor);
  return results;
}

function relationNames(ids: string[], names: Map<string, string>) {
  const values = ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
  return values.length ? values : ["Por asignar"];
}

function evaluationAverage(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export async function GET(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Sequential on purpose: Notion's API is rate-limited and the task data source paginates.
    const accountPages = await queryAll(DATA_SOURCES.accounts);
    const teamPages = await queryAll(DATA_SOURCES.team);
    const projectPages = await queryAll(DATA_SOURCES.projects);
    const taskPages = await queryAll(DATA_SOURCES.tasks);
    const holidayPages = await queryAll(DATA_SOURCES.holidays);
    const evaluationPages = await queryAll(DATA_SOURCES.evaluations);

    const accountNames = new Map(accountPages.map((page) => [compactId(page.id), title(page, "Nombre")]));
    const teamNames = new Map(teamPages.map((page) => [compactId(page.id), title(page, "Nombre")]));
    const projectNames = new Map(projectPages.map((page) => [compactId(page.id), title(page, "Nombre")]));

    const projects = projectPages.map((page) => {
      const timing = dateValue(page, "Timming");
      return {
        id: compactId(page.id),
        name: title(page, "Nombre") || "Proyecto sin nombre",
        status: select(page, "Estado") || "Sin estado",
        account: relation(page, "Cuenta").map((id) => accountNames.get(id)).find(Boolean) || "Sin cuenta",
        timing: timing ? rangeLabel(timing.start, timing.end) : "SIN FECHA",
        timingStart: timing?.start ?? null,
        timingEnd: timing?.end ?? null,
        type: select(page, "Tipo de Proyecto") || "Proyecto",
        people: relationNames(relation(page, "Personas"), teamNames),
        priority: select(page, "Prioridad") || "Sin prioridad",
        url: page.url || `https://www.notion.so/${compactId(page.id)}`,
        rating: starNumber(select(page, "Rating")),
        complexity: select(page, "Complejidad"),
      };
    });

    const tasks = taskPages.map((page) => {
      const taskDate = dateValue(page, "Fecha");
      return {
        id: compactId(page.id),
        name: title(page, "Tarea") || "Tarea sin nombre",
        status: status(page, "Status") || "Pendiente",
        priority: select(page, "Prioridad") || "Sin prioridad",
        project: relation(page, "Proyecto").map((id) => projectNames.get(id)).find(Boolean) || "Por asignar",
        account: relation(page, "Cuentas").map((id) => accountNames.get(id)).find(Boolean) || "Sin cuenta",
        date: dateLabel(taskDate?.start),
        dateStart: taskDate?.start ?? null,
        people: relationNames(relation(page, "Equipo"), teamNames),
        url: page.url || `https://www.notion.so/${compactId(page.id)}`,
        rating: starNumber(select(page, "Rating")),
        effort: select(page, "Esfuerzo"),
      };
    });

    const activeProjects = projects.filter((project) => !["Completado", "Cancelado", "Parado"].includes(project.status));
    const activeTasks = tasks.filter((task) => !["Terminado", "Cancelado"].includes(task.status));

    const evaluations = evaluationPages.map((page) => ({
      id: compactId(page.id),
      type: select(page, "Tipo"),
      employees: relation(page, "Empleado"),
      taskIds: relation(page, "Tarea"),
      projectIds: relation(page, "Proyecto"),
      score: numeric(page, "Nota general"),
      quality: numeric(page, "Calidad"),
      timing: numeric(page, "Timing"),
      collaboration: numeric(page, "Colaboración"),
      autonomy: numeric(page, "Autonomía"),
      impact: numeric(page, "Impacto"),
    }));

    const team = teamPages
      .filter((page) => select(page, "Contrato") !== "Rescindido")
      .map((page, index) => {
        const id = compactId(page.id);
        const name = title(page, "Nombre") || "Sin nombre";
        const personTasks = tasks.filter((task) => relation(taskPages.find((row) => compactId(row.id) === task.id)!, "Equipo").includes(id));
        const personProjects = projects.filter((project) => relation(projectPages.find((row) => compactId(row.id) === project.id)!, "Personas").includes(id));
        const activePersonTasks = personTasks.filter((task) => !["Terminado", "Cancelado"].includes(task.status));
        const activePersonProjects = personProjects.filter((project) => !["Completado", "Cancelado", "Parado"].includes(project.status));
        const personEvaluations = evaluations.filter((evaluation) => evaluation.employees.includes(id));
        const generalScores = personEvaluations.map((evaluation) => evaluation.score).filter((value): value is number => typeof value === "number");
        const taskScores = personEvaluations.filter((evaluation) => evaluation.type === "Tarea").map((evaluation) => evaluation.score).filter((value): value is number => typeof value === "number");
        const projectScores = personEvaluations.filter((evaluation) => evaluation.type === "Proyecto").map((evaluation) => evaluation.score).filter((value): value is number => typeof value === "number");
        const score = evaluationAverage(generalScores);
        const values = (key: "quality" | "timing" | "collaboration" | "autonomy" | "impact") =>
          personEvaluations.map((evaluation) => evaluation[key]).filter((value): value is number => typeof value === "number");
        const joined = dateValue(page, "Incorporación")?.start ?? null;
        const load = Math.min(100, activePersonTasks.length * 8 + activePersonProjects.length * 12);
        const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
        for (const value of generalScores) {
          const rounded = Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
          distribution[String(rounded) as keyof typeof distribution] += 1;
        }
        return {
          id,
          url: page.url || `https://www.notion.so/${id}`,
          name,
          role: select(page, "Rol") || "Sin rol",
          assignment: select(page, "Asignacion") || "Equipo",
          tier: select(page, "Rating"),
          skills: multiSelect(page, "Skills"),
          growth: multiSelect(page, "Debilidades"),
          joined,
          initials: initials(name),
          tone: tones[index % tones.length],
          load,
          activeTasks: activePersonTasks.length,
          activeProjects: activePersonProjects.length,
          projects: activePersonProjects.length,
          completedTasks: personTasks.filter((task) => task.status === "Terminado").length,
          completedProjects: personProjects.filter((project) => project.status === "Completado").length,
          score,
          taskScore: evaluationAverage(taskScores),
          projectScore: evaluationAverage(projectScores),
          evaluations: generalScores.length,
          ratio: score == null ? null : Math.round(score * 20),
          distribution,
          dimensions: {
            quality: evaluationAverage(values("quality")) ?? numeric(page, "Calidad hist."),
            timing: evaluationAverage(values("timing")) ?? numeric(page, "Timing hist."),
            collaboration: evaluationAverage(values("collaboration")) ?? numeric(page, "Colaboración hist."),
            autonomy: evaluationAverage(values("autonomy")) ?? numeric(page, "Autonomía hist."),
            impact: evaluationAverage(values("impact")) ?? numeric(page, "Impacto hist."),
          },
        };
      });

    const accounts = accountPages.map((page) => {
      const name = title(page, "Nombre") || "Cuenta sin nombre";
      const accountProjectIds = relation(page, "Proyectos");
      const accountTaskIds = relation(page, "Tareas");
      const activeProjectCount = activeProjects.filter((project) => project.account === name).length;
      const activeTaskCount = activeTasks.filter((task) => task.account === name).length;
      return {
        id: compactId(page.id),
        name,
        status: select(page, "Estado") || "Inactiva",
        priority: select(page, "Prioridad") || "Sin prioridad",
        contract: select(page, "Contrato") || "Otro",
        color: accountColors[stableIndex(name, accountColors.length)],
        projects: accountProjectIds.length,
        tasks: accountTaskIds.length,
        activeProjects: activeProjectCount,
        activeTasks: activeTaskCount,
        activity: Math.min(100, activeTaskCount * 4 + activeProjectCount * 12),
        pulse: Math.min(100, activeTaskCount * 4 + activeProjectCount * 12),
        url: page.url || `https://www.notion.so/${compactId(page.id)}`,
      };
    });

    const today = Date.now();
    const holidayWindowStart = today - 1000 * 60 * 60 * 24 * 30;
    const holidays = holidayPages
      .map((page) => {
        const dates = dateValue(page, "Fechas");
        const name = relation(page, "Equipo").map((id) => teamNames.get(id)).find(Boolean) || title(page, "Empleado") || "Sin asignar";
        const start = dates?.start ?? null;
        const end = dates?.end ?? dates?.start ?? null;
        return {
          id: compactId(page.id),
          name,
          type: select(page, "Tipo Ausencia") || "Ausencia",
          start,
          end,
          label: rangeLabel(start, end),
          color: accountColors[stableIndex(name, accountColors.length)],
          url: page.url || `https://www.notion.so/${compactId(page.id)}`,
        };
      })
      .filter((holiday) => holiday.end && new Date(holiday.end).getTime() >= holidayWindowStart)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));

    return NextResponse.json({
      source: "notion",
      loadedAt: new Date().toISOString(),
      counts: {
        accounts: accounts.length,
        projects: projects.length,
        activeProjects: activeProjects.length,
        tasks: tasks.length,
        activeTasks: activeTasks.length,
        team: team.length,
        holidays: holidays.length,
        evaluations: evaluations.length,
        ratedTasks: tasks.filter((task) => task.rating != null).length,
        ratedProjects: projects.filter((project) => project.rating != null).length,
      },
      accounts,
      projects: activeProjects,
      tasks: activeTasks,
      team,
      holidays,
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Notion state error";
    return NextResponse.json(
      { source: "notion", error: message },
      { status: message === "NOTION_TOKEN_MISSING" ? 503 : 502 }
    );
  }
}
