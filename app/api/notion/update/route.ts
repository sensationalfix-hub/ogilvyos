import { NextResponse } from "next/server";
import { requestIsAuthorized } from "@/app/lib/workos-auth";
import { DATA_SOURCES, resolveRelation, updatePage } from "@/app/lib/notion-live";

type Kind = "task" | "project";

type Body = {
  kind?: Kind;
  id?: string;
  changes?: Record<string, unknown>;
};

function title(value: unknown) {
  return { title: [{ text: { content: String(value ?? "") } }] };
}

function select(value: unknown) {
  return value ? { select: { name: String(value) } } : { select: null };
}

function status(value: unknown) {
  return value ? { status: { name: String(value) } } : { status: null };
}

async function taskProperties(changes: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  if ("name" in changes) properties["Tarea"] = title(changes.name);
  if ("status" in changes) properties["Status"] = status(changes.status);
  if ("priority" in changes) properties["Prioridad"] = select(changes.priority);
  if ("rating" in changes) properties["Rating"] = select(changes.rating);

  if ("account" in changes) {
    const relation = await resolveRelation(DATA_SOURCES.accounts, "Nombre", changes.account ? [String(changes.account)] : []);
    properties["Cuentas"] = { relation };
  }

  if ("project" in changes) {
    const relation = await resolveRelation(DATA_SOURCES.projects, "Nombre", changes.project && changes.project !== "Por asignar" ? [String(changes.project)] : []);
    properties["Proyecto"] = { relation };
  }

  if ("people" in changes && Array.isArray(changes.people)) {
    const names = changes.people.map(String).filter((name) => name && name !== "Por asignar");
    const relation = await resolveRelation(DATA_SOURCES.team, "Nombre", names);
    properties["Equipo"] = { relation };
  }

  return properties;
}

async function projectProperties(changes: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  if ("name" in changes) properties["Nombre"] = title(changes.name);
  if ("status" in changes) properties["Estado"] = select(changes.status);
  if ("priority" in changes) properties["Prioridad"] = select(changes.priority);
  if ("type" in changes) properties["Tipo de Proyecto"] = select(changes.type);
  if ("complexity" in changes) properties["Complejidad"] = select(changes.complexity);
  if ("rating" in changes) properties["Rating"] = select(changes.rating);

  if ("account" in changes) {
    const relation = await resolveRelation(DATA_SOURCES.accounts, "Nombre", changes.account ? [String(changes.account)] : []);
    properties["Cuenta"] = { relation };
  }

  if ("people" in changes && Array.isArray(changes.people)) {
    const names = changes.people.map(String).filter((name) => name && name !== "Por asignar");
    const relation = await resolveRelation(DATA_SOURCES.team, "Nombre", names);
    properties["Personas"] = { relation };
  }

  return properties;
}

export async function PATCH(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Body;
    if (!body.id || !body.kind || !body.changes) {
      return NextResponse.json({ error: "Missing kind, id or changes" }, { status: 400 });
    }

    if (body.id.startsWith("local-")) {
      return NextResponse.json({ error: "Local drafts cannot be updated in Notion yet" }, { status: 409 });
    }

    const properties = body.kind === "task"
      ? await taskProperties(body.changes)
      : await projectProperties(body.changes);

    if (!Object.keys(properties).length) {
      return NextResponse.json({ error: "No supported changes" }, { status: 400 });
    }

    await updatePage(body.id, properties);
    return NextResponse.json({ ok: true, kind: body.kind, id: body.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Notion error";
    return NextResponse.json(
      { error: message },
      { status: message === "NOTION_TOKEN_MISSING" ? 503 : 502 }
    );
  }
}
