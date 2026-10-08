import { NextResponse } from "next/server";
import { lifeSession, lifeSelect, lifeInsert } from "@/app/lib/life-store";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/app/lib/supabase-auth";

type Board = { id: string; title: string; project_id: string | null; nodes: unknown[]; edges: unknown[]; updated_at: string };
const validArray = (v: unknown) => Array.isArray(v) && v.length <= 400 && JSON.stringify(v).length < 300000;

export async function GET(request: Request) {
 const session = await lifeSession(request);
 if (!session) return NextResponse.json({error:"Inicia sesión con tu cuenta de WorkOS para utilizar Creative Lab."},{status:401});
 try {
  const boards = await lifeSelect<Board>(session.accessToken,"creative_boards","select=id,title,project_id,nodes,edges,updated_at&order=updated_at.desc");
  return NextResponse.json({boards});
 } catch(e) { return NextResponse.json({error:String(e)},{status:500}); }
}
export async function POST(request: Request) {
 const session = await lifeSession(request);
 if (!session) return NextResponse.json({error:"Sin autorización"},{status:401});
 const body = await request.json().catch(()=>({}));
 const title = typeof body.title==="string" ? body.title.trim().slice(0,120) : "Nuevo mapa";
 try {
  const board = await lifeInsert<Board>(session.accessToken,"creative_boards",{owner_id:session.userId,title:title||"Nuevo mapa",project_id:typeof body.project_id==="string"?body.project_id.slice(0,160):null,nodes:[],edges:[]});
  return NextResponse.json({board},{status:201});
 } catch(e){return NextResponse.json({error:String(e)},{status:500});}
}
export async function PATCH(request: Request) {
 const session = await lifeSession(request);
 if (!session) return NextResponse.json({error:"Sin autorización"},{status:401});
 const body = await request.json().catch(()=>({}));
 if (!/^[0-9a-f-]{36}$/i.test(String(body.id||"")) || !validArray(body.nodes) || !validArray(body.edges)) return NextResponse.json({error:"Mapa no válido"},{status:400});
 const payload={nodes:body.nodes,edges:body.edges,title:typeof body.title==="string"?body.title.slice(0,120):"Mapa",project_id:typeof body.project_id==="string"?body.project_id.slice(0,160):null,updated_at:new Date().toISOString()};
 try {
  const response=await fetch(SUPABASE_URL+"/rest/v1/creative_boards?id=eq."+encodeURIComponent(body.id),{method:"PATCH",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(payload),cache:"no-store"});
  if (!response.ok) return NextResponse.json({error:await response.text()},{status:response.status});
  const rows=await response.json();if(!rows.length)return NextResponse.json({error:"Mapa no encontrado"},{status:404});
  return NextResponse.json({board:rows[0]});
 }catch(e){return NextResponse.json({error:String(e)},{status:500});}
}
export async function DELETE(request:Request){
 const session=await lifeSession(request);if(!session)return NextResponse.json({error:"Sin autorización"},{status:401});
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"ID incorrecto"},{status:400});
 const response=await fetch(SUPABASE_URL+"/rest/v1/creative_boards?id=eq."+encodeURIComponent(id),{method:"DELETE",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken},cache:"no-store"});
 return NextResponse.json({ok:response.ok},{status:response.ok?200:response.status});
}
