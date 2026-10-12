import { NextResponse } from "next/server";
import { lifeSession, lifeSelect, lifeInsert } from "@/app/lib/life-store";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/app/lib/supabase-auth";

type Share={board_id:string;token:string;enabled:boolean};
const valid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
async function context(request:Request){
 const session=await lifeSession(request);
 if(!session)return null;
 return session;
}
export async function GET(request:Request){
 const session=await context(request);if(!session)return NextResponse.json({error:"Sin autorización"},{status:401});
 const id=new URL(request.url).searchParams.get("board")||"";
 if(!valid(id))return NextResponse.json({error:"Mapa no válido"},{status:400});
 const shares=await lifeSelect<Share>(session.accessToken,"creative_shares",`select=board_id,token,enabled&board_id=eq.${id}&owner_id=eq.${session.userId}`);
 return NextResponse.json({share:shares[0]||null});
}
export async function POST(request:Request){
 const session=await context(request);if(!session)return NextResponse.json({error:"Sin autorización"},{status:401});
 const body=await request.json().catch(()=>({}));
 const board=String(body.board||"");
 if(!valid(board))return NextResponse.json({error:"Mapa no válido"},{status:400});
 const own=await lifeSelect<{id:string}>(session.accessToken,"creative_boards",`select=id&id=eq.${board}&owner_id=eq.${session.userId}`);
 if(!own.length)return NextResponse.json({error:"No tienes permiso sobre este mapa"},{status:403});
 let rows=await lifeSelect<Share>(session.accessToken,"creative_shares",`select=board_id,token,enabled&board_id=eq.${board}`);
 if(!rows.length){
  const share=await lifeInsert<Share>(session.accessToken,"creative_shares",{board_id:board,owner_id:session.userId});
  return NextResponse.json({share});
 }
 if(!rows[0].enabled){
  const response=await fetch(SUPABASE_URL+"/rest/v1/creative_shares?board_id=eq."+board,{method:"PATCH",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({enabled:true})});
  if(!response.ok)return NextResponse.json({error:"No se pudo activar"},{status:500});
  rows=await response.json();
 }
 return NextResponse.json({share:rows[0]});
}
export async function DELETE(request:Request){
 const session=await context(request);if(!session)return NextResponse.json({error:"Sin autorización"},{status:401});
 const board=new URL(request.url).searchParams.get("board")||"";
 if(!valid(board))return NextResponse.json({error:"Mapa no válido"},{status:400});
 const response=await fetch(SUPABASE_URL+"/rest/v1/creative_shares?board_id=eq."+board+"&owner_id=eq."+session.userId,{method:"PATCH",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken,"Content-Type":"application/json"},body:JSON.stringify({enabled:false})});
 return NextResponse.json({ok:response.ok},{status:response.ok?200:500});
}
