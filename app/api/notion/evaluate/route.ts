import { NextResponse } from "next/server";
import { requestIsAuthorized } from "@/app/lib/workos-auth";
import { createPage, DATA_SOURCES, resolvePageIdByTitle, updatePage } from "@/app/lib/notion-live";

function title(value: string) { return { title: [{ text: { content: value } }] }; }
function text(value: string) { return { rich_text: value ? [{ text: { content: value } }] : [] }; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? { number: value } : { number: null }; }
function select(value: string) { return { select: { name: value } }; }
function stars(value: number) { return "★".repeat(Math.max(1, Math.min(5, Math.round(value)))); }

export async function POST(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const kind = body?.kind === "project" ? "project" : body?.kind === "task" ? "task" : null;
    const id = String(body?.id || "");
    const name = String(body?.name || "").trim();
    const people = Array.isArray(body?.people) ? body.people.map(String).filter((v: string) => v && v !== "Por asignar") : [];
    const score = Number(body?.score || 0);

    if (!kind || !id || !name || score < 1 || score > 5) {
      return NextResponse.json({ error: "Invalid evaluation payload" }, { status: 400 });
    }

    const targetId = id;
    await updatePage(targetId, kind === "task"
      ? { Status: { status: { name: "Terminado" } }, Rating: select(stars(score)) }
      : { Estado: select("Completado"), Rating: select(stars(score)) });

    const created = [];
    for (const person of people) {
      const employeeId = await resolvePageIdByTitle(DATA_SOURCES.team, "Nombre", person);
      if (!employeeId) continue;
      const individualScore = Number(body?.individualScores?.[person] || score);

      const properties: Record<string, unknown> = {
        "Evaluación": title(`${kind === "task" ? "Tarea" : "Proyecto"} · ${name} · ${person}`),
        "Tipo": select(kind === "task" ? "Tarea" : "Proyecto"),
        "Empleado": { relation: [{ id: employeeId }] },
        "Nota general": number(individualScore),
        "Calidad": number(body?.dimensions?.quality),
        "Timing": number(body?.dimensions?.timing),
        "Colaboración": number(body?.dimensions?.collaboration),
        "Autonomía": number(kind === "task" ? body?.dimensions?.autonomy : null),
        "Impacto": number(kind === "project" ? body?.dimensions?.impact : null),
        "Comentario": text(String(body?.note || "")),
        "Fricciones": text(Array.isArray(body?.frictions) ? body.frictions.join(", ") : ""),
        "Señales positivas": text(Array.isArray(body?.strengths) ? body.strengths.join(", ") : ""),
        "OgilvyOS ID": text(`workos:${kind}:${id}:${employeeId}`),
        ...(kind === "task" ? { Tarea: { relation: [{ id: targetId }] } } : { Proyecto: { relation: [{ id: targetId }] } }),
      };

      const page = await createPage(DATA_SOURCES.evaluations, properties);
      created.push(page?.id);
    }

    return NextResponse.json({ ok: true, created: created.length, closed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown evaluation error";
    return NextResponse.json({ error: message }, { status: message === "NOTION_TOKEN_MISSING" ? 503 : 502 });
  }
}
