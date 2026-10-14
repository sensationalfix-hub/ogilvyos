import { NextResponse } from "next/server";
import { requestCanWrite } from "@/app/lib/workos-auth";
import { createPage, DATA_SOURCES, notionRequest, resolvePageIdByTitle, updatePage } from "@/app/lib/notion-live";

export const dynamic = "force-dynamic";

const TYPES = new Set(["Libres", "Convenio", "Puente", "Semana Santa", "Navidad", "Mudanza", "Enfermedad", "Pendientes"]);
const idRegex = /^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown) {
  if (typeof value !== "string" || !dateRegex.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateInput(body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "";
  const start = body?.start;
  const end = body?.end || body?.start;
  if (!name || name.length > 200 || !TYPES.has(type) || !validDate(start) || !validDate(end) || end < start) {
    throw new Error("Selecciona una persona, un tipo y unas fechas válidas.");
  }
  const days = (Date.parse(end + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000;
  if (days > 366) throw new Error("El periodo no puede superar un año.");
  return { name, type, start: start as string, end: end as string };
}

async function propertiesFor(body: any) {
  const data = validateInput(body);
  const teamId = await resolvePageIdByTitle(DATA_SOURCES.team, "Nombre", data.name);
  if (!teamId) throw new Error("La persona ya no existe en Equipo.");
  const relation = { relation: [{ id: teamId }] };
  return {
    Empleado: { title: [{ text: { content: data.name } }] },
    Segmento: { select: { name: "Persona" } },
    "Tipo Ausencia": { select: { name: data.type } },
    Fechas: { date: { start: data.start, ...(data.end !== data.start ? { end: data.end } : {}) } },
    Año: { select: { name: data.start.slice(0, 4) } },
    // Conservamos las relaciones activas que ya utiliza la base de Equipo.
    Equipo: relation,
    "Vacaciones Relacion": relation,
  };
}

async function validatedAbsence(id: unknown) {
  if (typeof id !== "string" || !idRegex.test(id)) throw new Error("Registro no válido.");
  const page = await notionRequest("/pages/" + id);
  const dataSource = String(page?.parent?.data_source_id || "").replace(/-/g, "");
  if (dataSource !== DATA_SOURCES.holidays.replace(/-/g, "") || page?.in_trash) {
    throw new Error("La ausencia no pertenece a Vacaciones.");
  }
  if (page?.properties?.Segmento?.select?.name === "Festivo") {
    throw new Error("Los festivos comunes no se editan desde este formulario.");
  }
  return page;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudieron guardar las vacaciones.";
  const validation = /Selecciona|periodo|persona|Registro|pertenece|festivos/i.test(message);
  return NextResponse.json({ error: message }, { status: message === "NOTION_TOKEN_MISSING" ? 503 : validation ? 400 : 502 });
}

export async function POST(request: Request) {
  if (!(await requestCanWrite(request))) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  try {
    const properties = await propertiesFor(await request.json());
    const page = await createPage(DATA_SOURCES.holidays, properties);
    return NextResponse.json({ ok: true, id: page.id });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  if (!(await requestCanWrite(request))) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  try {
    const body = await request.json();
    await validatedAbsence(body?.id);
    await updatePage(body.id, await propertiesFor(body));
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  if (!(await requestCanWrite(request))) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  try {
    const body = await request.json();
    await validatedAbsence(body?.id);
    const updated = await notionRequest("/pages/" + body.id, { method: "PATCH", body: JSON.stringify({ in_trash: true }) });
    if (updated?.in_trash !== true) throw new Error("Notion no confirmó la eliminación de la ausencia.");
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
