import { NextResponse } from "next/server";
import { updatePage } from "@/app/lib/notion-live";

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

function taskProperties(changes: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  if ("name" in changes) properties["Tarea"] = title(changes.name);
  if ("status" in changes) properties["Status"] = status(changes.status);
  if ("priority" in changes) properties["Prioridad"] = select(changes.priority);
  if ("rating" in changes) properties["Rating"] = select(changes.rating);
  return properties;
}

function projectProperties(changes: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  if ("name" in changes) properties["Nombre"] = title(changes.name);
  if ("status" in changes) properties["Estado"] = select(changes.status);
  if ("priority" in changes) properties["Prioridad"] = select(changes.priority);
  if ("type" in changes) properties["Tipo de Proyecto"] = select(changes.type);
  if ("complexity" in changes) properties["Complejidad"] = select(changes.complexity);
  if ("rating" in changes) properties["Rating"] = select(changes.rating);
  return properties;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.id || !body.kind || !body.changes) {
      return NextResponse.json({ error: "Missing kind, id or changes" }, { status: 400 });
    }

    const properties = body.kind === "task"
      ? taskProperties(body.changes)
      : projectProperties(body.changes);

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
