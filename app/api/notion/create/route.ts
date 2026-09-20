import { NextResponse } from "next/server";
import { requestIsAuthorized } from "@/app/lib/workos-auth";
import { createPage, DATA_SOURCES } from "@/app/lib/notion-live";

function title(value: string) {
  return { title: [{ text: { content: value } }] };
}
function select(value: string) {
  return { select: { name: value } };
}
function status(value: string) {
  return { status: { name: value } };
}

export async function POST(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const kind = body?.kind;
    const name = String(body?.name || "").trim();
    if (!name || (kind !== "task" && kind !== "project")) {
      return NextResponse.json({ error: "Missing or invalid kind/name" }, { status: 400 });
    }

    const properties = kind === "task"
      ? {
          Tarea: title(name),
          Status: status("Pendiente"),
          Prioridad: select("Media"),
        }
      : {
          Nombre: title(name),
          Estado: select("Brief"),
          Prioridad: select("Media"),
          "Tipo de Proyecto": select("Proyecto"),
        };

    const page = await createPage(kind === "task" ? DATA_SOURCES.tasks : DATA_SOURCES.projects, properties);
    return NextResponse.json({
      ok: true,
      kind,
      id: String(page.id || "").replace(/-/g, ""),
      url: page.url || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Notion create error";
    return NextResponse.json({ error: message }, { status: message === "NOTION_TOKEN_MISSING" ? 503 : 502 });
  }
}
