import { NextResponse } from "next/server";
import { lifeSession, lifeSelect } from "@/app/lib/life-store";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/app/lib/supabase-auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL="paraphrase-multilingual-MiniLM-L12-v2-q8";
const headers=(token:string,prefer="")=>({apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})});
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
type Embedding={reference_id:string;source_hash:string;embedding:number[];model:string};
export async function GET(request:Request){
 const user=await lifeSession(request);if(!user)return fail("Sin sesión",401);
 try{
  const [vectors,proposals]=await Promise.all([
   lifeSelect<Embedding>(user.accessToken,"reference_local_embeddings","select=reference_id,source_hash,embedding,model&limit=500"),
   lifeSelect<{id:string;source_id:string;target_id:string;status:string;relation:string;explanation:string;distance:number;model:string}>(user.accessToken,"reference_ai_suggestions","select=id,source_id,target_id,status,relation,explanation,distance,model&limit=1200")
  ]);
  return NextResponse.json({vectors,proposals});
 }catch(e){return fail(e instanceof Error?e.message:"Error al recuperar vectores",500)}
}
export async function POST(request:Request){
 const user=await lifeSession(request);if(!user)return fail("Sin sesión",401);
 const data=await request.json().catch(()=>({}));
 try{
  if(data.action==="embeddings"){
   if(!Array.isArray(data.vectors)||data.vectors.length<1||data.vectors.length>30)return fail("Lote de vectores incorrecto.");
   const ids=data.vectors.map((v:{reference_id?:string})=>v.reference_id);
   if(ids.some((id:unknown)=>typeof id!=="string"||!UUID.test(id)))return fail("ID no válido");
   const owned=await lifeSelect<{id:string}>(user.accessToken,"reference_items","select=id&id=in.("+ids.join(",")+")&limit=30");
   if(owned.length!==new Set(ids).size)return fail("Referencias fuera de tu biblioteca",403);
   const rows=data.vectors.map((v:{reference_id:string;source_hash:string;embedding:number[]})=>{
    if(typeof v.source_hash!=="string"||!/^[a-f0-9]{8}$/.test(v.source_hash))throw Error("Huella incorrecta");
    if(!Array.isArray(v.embedding)||v.embedding.length!==384||v.embedding.some((n:unknown)=>typeof n!=="number"||!Number.isFinite(n)||Math.abs(n)>1.001))throw Error("Vector incorrecto");
    return {reference_id:v.reference_id,owner_id:user.userId,source_hash:v.source_hash,embedding:v.embedding.map(x=>Number(x.toFixed(6))),model:MODEL,updated_at:new Date().toISOString()};
   });
   const response=await fetch(SUPABASE_URL+"/rest/v1/reference_local_embeddings?on_conflict=reference_id",{method:"POST",headers:headers(user.accessToken,"resolution=merge-duplicates,return=minimal"),body:JSON.stringify(rows),cache:"no-store"});
   if(!response.ok)return fail("No se pudieron guardar los vectores: "+(await response.text()).slice(0,160),500);
   return NextResponse.json({saved:rows.length});
  }
  if(data.action==="suggestions"){
   const id=String(data.source_id||"");
   if(!UUID.test(id)||!Array.isArray(data.proposals)||data.proposals.length>8)return fail("Propuestas inválidas");
   const all=await lifeSelect<{id:string}>(user.accessToken,"reference_items","select=id&limit=500");
   const allowed=new Set(all.map(x=>x.id));
   if(!allowed.has(id))return fail("Referencia no encontrada",404);
   const previous=await lifeSelect<{target_id:string;status:string}>(user.accessToken,"reference_ai_suggestions","select=target_id,status&source_id=eq."+id+"&limit=250");
   const existing=new Set(previous.map(x=>x.target_id));
   const accepted:{id:string;source_id:string;target_id:string;relation:string;explanation:string;distance:number;model:string;status:string}[]=[];
   for(const value of data.proposals){
    if(!value||typeof value!=="object"||!UUID.test(String(value.target_id))||!allowed.has(value.target_id)||value.target_id===id||existing.has(value.target_id))continue;
    const relation=String(value.relation||"Afinidad semántica").slice(0,90);
    const explanation=String(value.explanation||"").slice(0,390);
    if(!explanation)continue;
    accepted.push({id:crypto.randomUUID(),source_id:id,target_id:value.target_id,relation,explanation,distance:Math.max(0,Math.min(100,Number(value.distance)||50)),model:"local-multilingual-embeddings",status:"pending"});
   }
   if(!accepted.length)return NextResponse.json({saved:0});
   const rows=accepted.map(x=>({...x,owner_id:user.userId}));
   const response=await fetch(SUPABASE_URL+"/rest/v1/reference_ai_suggestions",{method:"POST",headers:headers(user.accessToken,"return=minimal"),body:JSON.stringify(rows),cache:"no-store"});
   if(!response.ok)return fail("Error al guardar sugerencias: "+(await response.text()).slice(0,170),500);
   return NextResponse.json({saved:rows.length});
  }
  return fail("Acción no reconocida");
 }catch(e){return fail(e instanceof Error?e.message:"Error de análisis local",500)}
}
