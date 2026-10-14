import { NextResponse } from "next/server";
import { requestCanWrite } from "@/app/lib/workos-auth";
import { DATA_SOURCES, notionRequest, retrieveDataSource, schemaProperty, updatePage } from "@/app/lib/notion-live";

export const dynamic = "force-dynamic";

const ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SELECTS: Record<string,string> = { role: "Rol", assignment: "Asignacion", contract: "Contrato", tier: "Rating" };
const MULTIS: Record<string,string> = { skills: "Skills", growth: "Debilidades" };
const NUMBERS: Record<string,string> = {
  salary: "Sueldo", base: "Base", convenio: "Convenio",
  puentes: "Puentes", semanaSanta: "Semana Santa", navidad: "Navidad",
};
const VALID_KEYS = new Set(["name", "email", "joined", ...Object.keys(SELECTS), ...Object.keys(MULTIS), ...Object.keys(NUMBERS)]);

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function numberOrNull(value: unknown, key: string): number | null {
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    throw new Error("Valor numérico no válido: " + key);
  }
  if (key !== "salary" && !Number.isInteger(value)) throw new Error("Los días deben ser enteros");
  return value;
}
function validDate(value: unknown) {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function schemaOptions(schema: any, property: string): Set<string> {
  const field = schemaProperty(schema, property) as any;
  const options: Array<{ name?: string }> = field?.select?.options || field?.multi_select?.options || field?.options || [];
  return new Set(options.map(option => String(option.name || "")));
}

export async function PATCH(request: Request) {
  if (!(await requestCanWrite(request))) return bad("Sin permiso para editar", 403);
  try {
    const body = await request.json();
    const id: unknown = body?.id;
    const changes = body?.changes;
    if (typeof id !== "string" || !ID.test(id) || !changes || typeof changes !== "object" || Array.isArray(changes)) {
      return bad("Identificador o cambios no válidos");
    }
    const keys = Object.keys(changes);
    if (!keys.length || keys.some(key => !VALID_KEYS.has(key))) return bad("Propiedades no permitidas");
    const page = await notionRequest("/pages/" + id);
    if (String(page?.parent?.data_source_id || "").replace(/-/g, "") !== DATA_SOURCES.team.replace(/-/g, "") || page.in_trash) {
      return bad("El registro no pertenece a Equipo");
    }

    const schema = await retrieveDataSource(DATA_SOURCES.team);
    const properties: Record<string,unknown> = {};
    if ("name" in changes) {
      const value = String(changes.name ?? "").trim();
      if (!value || value.length > 200) throw new Error("Nombre no válido");
      properties["Nombre"] = { title: [{ text: { content: value } }] };
    }
    if ("email" in changes) {
      const value = String(changes.email ?? "").trim();
      if (value.length > 254 || (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error("Email no válido");
      properties["Email"] = { email: value || null };
    }
    if ("joined" in changes) {
      if (!validDate(changes.joined)) throw new Error("Fecha de incorporación no válida");
      properties["Incorporación"] = { date: changes.joined ? { start: changes.joined } : null };
    }
    for (const [key, prop] of Object.entries(NUMBERS)) {
      if (!(key in changes)) continue;
      properties[prop] = { number: numberOrNull(changes[key], key) };
    }
    for (const [key, prop] of Object.entries(SELECTS)) {
      if (!(key in changes)) continue;
      const value = changes[key] == null ? "" : String(changes[key]);
      if (value && !schemaOptions(schema, prop).has(value)) throw new Error("Opción no válida para " + prop);
      properties[prop] = { select: value ? { name: value } : null };
    }
    for (const [key, prop] of Object.entries(MULTIS)) {
      if (!(key in changes)) continue;
      const values = changes[key];
      if (!Array.isArray(values) || values.length > 35 || values.some(v => typeof v !== "string")) {
        throw new Error("Opciones no válidas para " + prop);
      }
      const allowed = schemaOptions(schema, prop);
      if (values.some(v => !allowed.has(v))) throw new Error("Opción desconocida para " + prop);
      properties[prop] = { multi_select: [...new Set(values)].map(name => ({ name })) };
    }

    await updatePage(id, properties);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar Equipo";
    const upstream = /^Notion |NOTION_TOKEN_MISSING/.test(message);
    return bad(upstream ? "Notion no ha podido guardar los datos: " + message : message, upstream ? 502 : 400);
  }
}
