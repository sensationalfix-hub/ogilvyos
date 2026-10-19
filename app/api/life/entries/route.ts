import { NextResponse } from "next/server";
import { lifeInsert, lifeSelect, lifeSession } from "@/app/lib/life-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/lib/supabase-auth";

const kinds = new Set(["journal", "finance", "subscription", "salary", "media", "health", "plan"]);
type Entry = {
  id: string; kind: string; title: string; note: string; entry_date: string;
  amount: number | null; category: string | null; status: string | null;
  billing_day: number | null; metadata: Record<string, unknown>; created_at: string;
};
const safeDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T12:00:00"));
const cleanText = (v: unknown, limit: number) => typeof v === "string" ? v.trim().slice(0, limit) : "";
function headers(token: string, extras?: Record<string,string>) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", ...extras };
}
function normalize(input: Record<string, unknown>, partial = false) {
  const value: Record<string, unknown> = {};
  if (!partial || "kind" in input) {
    if (!kinds.has(input.kind as string)) throw new Error("Tipo de registro no válido");
    value.kind = input.kind;
  }
  if (!partial || "title" in input) {
    const title = cleanText(input.title, 180);
    if (!title && input.kind !== "journal" && !partial) throw new Error("Añade un título");
    value.title = title;
  }
  if (!partial || "note" in input) value.note = cleanText(input.note, 6000);
  if (!partial || "entry_date" in input) {
    if (!safeDate(input.entry_date)) throw new Error("Fecha no válida");
    value.entry_date = input.entry_date;
  }
  if ("amount" in input) {
    if (input.amount === null || input.amount === "") value.amount = null;
    else {
      const n = Number(input.amount);
      if (!Number.isFinite(n) || Math.abs(n) > 1000000000) throw new Error("Importe no válido");
      value.amount = Math.round(n * 100) / 100;
    }
  }
  if ("category" in input) value.category = cleanText(input.category, 60) || null;
  if ("status" in input) value.status = cleanText(input.status, 40) || null;
  if ("billing_day" in input) {
    const n = Number(input.billing_day);
    if (input.billing_day === null || input.billing_day === "") value.billing_day = null;
    else if (Number.isInteger(n) && n >= 1 && n <= 31) value.billing_day = n;
    else throw new Error("Día de cobro no válido");
  }
  if ("metadata" in input) {
    const meta = input.metadata;
    if (!meta || Array.isArray(meta) || typeof meta !== "object" || JSON.stringify(meta).length > 3000) throw new Error("Datos adicionales no válidos");
    value.metadata = meta;
  }
  return value;
}
function replyError(err: unknown) {
  return NextResponse.json({error: err instanceof Error ? err.message : "Operación fallida"}, {status: 400});
}
export async function GET(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({error:"Unauthorized"}, {status:401});
  try {
    const rows = await lifeSelect<Entry>(session.accessToken,"life_entries",
      "select=id,kind,title,note,entry_date,amount,category,status,billing_day,metadata,created_at&order=entry_date.desc,created_at.desc&limit=1500");
    return NextResponse.json({entries: rows});
  } catch(e) { return NextResponse.json({error: e instanceof Error ? e.message : "Error al cargar"}, {status:500}); }
}
export async function POST(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({error:"Unauthorized"}, {status:401});
  try {
    const body = await request.json() as Record<string, unknown>;
    const entry = await lifeInsert<Entry>(session.accessToken,"life_entries",{...normalize(body),user_id:session.userId});
    return NextResponse.json({entry}, {status:201});
  } catch(e) { return replyError(e); }
}
export async function PATCH(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({error:"Unauthorized"}, {status:401});
  try {
    const body = await request.json() as Record<string,unknown>;
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new Error("Identificador no válido");
    const {id, ...rest} = body;
    const changes = normalize(rest,true);
    delete changes.kind;
    if (!Object.keys(changes).length) throw new Error("Sin cambios");
    const response = await fetch(SUPABASE_URL + "/rest/v1/life_entries?id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(session.userId),{
      method:"PATCH",headers:headers(session.accessToken,{"Prefer":"return=representation"}),
      body:JSON.stringify({...changes,updated_at:new Date().toISOString()}),cache:"no-store"
    });
    if (!response.ok) throw new Error("No se pudo actualizar: " + await response.text());
    const [entry] = await response.json() as Entry[];
    if (!entry) return NextResponse.json({error:"Registro no encontrado"},{status:404});
    return NextResponse.json({entry});
  } catch(e) {return replyError(e);}
}
export async function DELETE(request: Request) {
  const session = await lifeSession(request);
  if (!session) return NextResponse.json({error:"Unauthorized"}, {status:401});
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Identificador no válido"}, {status:400});
  try {
    const response = await fetch(SUPABASE_URL+"/rest/v1/life_entries?id=eq."+encodeURIComponent(id)+"&user_id=eq."+encodeURIComponent(session.userId),{
      method:"DELETE", headers:headers(session.accessToken,{"Prefer":"return=representation"}),cache:"no-store"
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json() as Entry[];
    if (!rows.length) return NextResponse.json({error:"Registro no encontrado"},{status:404});
    return NextResponse.json({ok:true});
  } catch(e) {return replyError(e);}
}