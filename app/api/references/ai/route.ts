import { NextResponse } from "next/server";
import { lifeSession,lifeSelect,lifeInsert } from "@/app/lib/life-store";
import { SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY } from "@/app/lib/supabase-auth";

export const runtime="nodejs";
export const maxDuration=60;
type Item={id:string;title:string;url:string|null;image_url:string|null;media_path:string|null;kind:string;site:string|null;notes:string;auto_tags:string[];project_id:string|null};
type Suggestion={id:string;source_id:string;target_id:string;relation:string;explanation:string;status:string;distance:number};
type Insight={reference_id:string;themes:string[];visual_language:string[];narrative:string;creative_mechanism:string;summary:string;analyzed_at:string};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const headers=(token:string,more:Record<string,string>={})=>({apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json",...more});
const message=(error:string,status:number)=>NextResponse.json({error},{status});
const bounded=(input:unknown,n:number)=>typeof input==="string"?input.trim().slice(0,n):"";
const shortArray=(x:unknown)=>Array.isArray(x)?x.filter((s):s is string=>typeof s==="string").map(x=>x.trim().slice(0,90)).filter(Boolean).slice(0,8):[];
const publicImage=(value:string|null)=>{if(!value)return null;try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.port||u.hostname==="localhost"||!u.hostname.includes(".")||u.hostname.includes(":"))return null;return u.href}catch{return null}};
async function upsert(token:string,table:string,payload:Record<string,unknown>,conflict:string){
 const url=SUPABASE_URL+"/rest/v1/"+table+"?on_conflict="+encodeURIComponent(conflict);
 const r=await fetch(url,{method:"POST",headers:headers(token,{Prefer:"resolution=merge-duplicates,return=representation"}),body:JSON.stringify(payload),cache:"no-store"});
 if(!r.ok)throw new Error("Error de persistencia: "+(await r.text()).slice(0,220));
 const rows=await r.json();return rows[0]||null;
}
async function patch(token:string,table:string,id:string,payload:Record<string,unknown>){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+table+"?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:headers(token,{Prefer:"return=representation"}),body:JSON.stringify(payload),cache:"no-store"});
 if(!r.ok)throw Error("Error al guardar decisión");const rows=await r.json();return rows[0];
}
export async function GET(request:Request){
 const user=await lifeSession(request);if(!user)return message("Inicia sesión con Supabase",401);
 try{
 const [insights,suggestions]=await Promise.all([
 lifeSelect<Insight>(user.accessToken,"reference_ai_insights","select=reference_id,themes,visual_language,narrative,creative_mechanism,summary,analyzed_at&limit=500"),
 lifeSelect<Suggestion>(user.accessToken,"reference_ai_suggestions","select=id,source_id,target_id,relation,explanation,status,distance&limit=1000")
 ]);
 return NextResponse.json({insights,suggestions,enabled:process.env.REFERENCE_AI_PAID_CALLS_ALLOWED==="YES_I_ACCEPT_CHARGES"});
 }catch(e){return message(String(e),500)}
}
export async function PATCH(request:Request){
 const user=await lifeSession(request);if(!user)return message("No autorizado",401);
 const data=await request.json().catch(()=>({}));
 if(!UUID.test(String(data.id||""))||!["accepted","rejected"].includes(data.status))return message("Decisión no válida",400);
 try{
  const rows=await lifeSelect<Suggestion>(user.accessToken,"reference_ai_suggestions","select=id,source_id,target_id,relation,explanation,status,distance&id=eq."+data.id+"&limit=1");
  const item=rows[0];if(!item)return message("Sugerencia no encontrada",404);
  const suggestion=await patch(user.accessToken,"reference_ai_suggestions",item.id,{status:data.status,updated_at:new Date().toISOString()});
  if(data.status==="accepted"){
   const existing=await lifeSelect<{id:string}>(user.accessToken,"reference_connections","select=id&source_id=eq."+item.source_id+"&target_id=eq."+item.target_id+"&limit=1");
   if(!existing.length)await lifeInsert(user.accessToken,"reference_connections",{owner_id:user.userId,source_id:item.source_id,target_id:item.target_id,relation:item.relation,explanation:item.explanation});
  }
  return NextResponse.json({suggestion});
 }catch(e){return message(String(e),500)}
}
export async function POST(request:Request){
 // Fail closed: never initiate paid inference without an explicit production opt-in.
 if(process.env.REFERENCE_AI_PAID_CALLS_ALLOWED!=="YES_I_ACCEPT_CHARGES"){
  return NextResponse.json({error:"IA en pausa para evitar cargos de Vercel. El archivo, las búsquedas y las conexiones manuales siguen disponibles.",billing_disabled:true},{status:503});
 }

 const user=await lifeSession(request);if(!user)return message("No autorizado",401);
 const data=await request.json().catch(()=>({}));
 const id=String(data.reference_id||"");
 const distance=Math.max(0,Math.min(100,Number(data.distance)||50));
 if(!UUID.test(id))return message("Selecciona una referencia",400);
 const gatewayToken=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||request.headers.get("x-vercel-oidc-token");
 if(!gatewayToken)return message("AI Gateway aún no está conectado a este despliegue. Requiere OIDC o AI_GATEWAY_API_KEY en Vercel.",503);
 try{
  const items=await lifeSelect<Item>(user.accessToken,"reference_items","select=id,title,url,image_url,media_path,kind,site,notes,auto_tags,project_id&limit=150");
  const source=items.find(x=>x.id===id);
  if(!source)return message("Referencia no encontrada",404);
  const [prior,history,runs]=await Promise.all([
   lifeSelect<Suggestion>(user.accessToken,"reference_ai_suggestions","select=id,source_id,target_id,relation,explanation,status,distance&limit=1000"),
   lifeSelect<Insight>(user.accessToken,"reference_ai_insights","select=reference_id,themes,visual_language,narrative,creative_mechanism,summary,analyzed_at&limit=150"),
   lifeSelect<{created_at:string}>(user.accessToken,"reference_ai_runs","select=created_at&created_at=gte."+encodeURIComponent(new Date(Date.now()-86400000).toISOString())+"&limit=25")
  ]);
  if(runs.length>=20)return message("Límite de seguridad: 20 análisis en 24 horas. Vuelve mañana.",429);
  const current=history.find(x=>x.reference_id===id);
  if(current&&Date.now()-new Date(current.analyzed_at).getTime()<30000)return message("Espera unos segundos antes de analizar de nuevo.",429);
  await lifeInsert(user.accessToken,"reference_ai_runs",{owner_id:user.userId,reference_id:id});
  const other=items.filter(x=>x.id!==id).slice(0,55).map(x=>{
   const h=history.find(i=>i.reference_id===x.id);
   return {id:x.id,title:x.title,notes:x.notes.slice(0,350),type:x.kind,site:x.site,existing_themes:h?.themes||[],existing_mechanism:h?.creative_mechanism||""};
  });
  const learned=prior.filter(x=>x.status!=="pending").slice(-45).map(x=>({
   from:items.find(i=>i.id===x.source_id)?.title,to:items.find(i=>i.id===x.target_id)?.title,
   relation:x.relation,reason:x.explanation,decision:x.status
  }));
  const instructions=`Eres el motor creativo personal de Reference Lib. Analiza una referencia de publicidad/cine/arte/música de forma no obvia y útil para un director creativo. Devuelve SOLO JSON válido, sin fences, bajo el esquema:
{"summary":"1 frase concreta","themes":["hasta 6 temas"],"visual_language":["hasta 5 recursos visuales"],"narrative":"hasta 200 caracteres","creative_mechanism":"hasta 220 caracteres","connections":[{"target_id":"UUID existente","relation":"etiqueta de 2-5 palabras","explanation":"por qué hay una relación no trivial, específica, hasta 250 caracteres","distance":0}]}
La lista 'connections' tiene máximo 5 entradas. Solo puedes usar target_id de las referencias candidatas suministradas. Distancia 0=semejanza directa, 100=salto conceptual lejano. Se solicita proximidad ${distance}/100; alterna relaciones visuales, conceptuales, mecanismos narrativos, contradicciones y analogías. No inventes detalles de una obra si el título o imagen no bastan: expresa incertidumbre. Analiza la IMAGEN si hay una. No reproduzcas letras de canciones ni diálogos. No inventes referencias externas. Aprende de decisiones anteriores, pero no repitas conexiones rechazadas. No devuelvas análisis grandilocuentes o genéricos. Español de España.`;
  const payload=JSON.stringify({reference:{id:source.id,title:source.title,site:source.site,kind:source.kind,notes:source.notes,url:source.url},candidates:other,feedback:learned,desired_distance:distance});
  const content:Array<Record<string,unknown>>=[{type:"text",text:instructions+"\n\nDATOS:\n"+payload}];
  const image=publicImage(source.image_url||((source.kind==="image"&&!source.media_path)?source.url:null));
  if(image)content.push({type:"image_url",image_url:{url:image,detail:"low"}});
  const ai=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
   method:"POST",signal:AbortSignal.timeout(35000),
   headers:{Authorization:"Bearer "+gatewayToken,"Content-Type":"application/json"},
   body:JSON.stringify({model:"google/gemini-2.5-flash",messages:[{role:"user",content}],temperature:0.6,max_tokens:1200,response_format:{type:"json_object"}}),
   cache:"no-store"
  });
  if(!ai.ok){const info=(await ai.text()).slice(0,400);return message("AI Gateway: "+ai.status+" "+info,502)}
  const result=await ai.json() as {choices?:Array<{message?:{content?:string}}>};
  const raw=result.choices?.[0]?.message?.content||"";
  let decoded:{summary?:unknown;themes?:unknown;visual_language?:unknown;narrative?:unknown;creative_mechanism?:unknown;connections?:unknown};
  try{decoded=JSON.parse(raw.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim())}catch{return message("La IA devolvió una respuesta inválida. Prueba otra vez.",502)}
  const model="google/gemini-2.5-flash";
  const insight=await upsert(user.accessToken,"reference_ai_insights",{
   reference_id:id,owner_id:user.userId,summary:bounded(decoded.summary,450),
   themes:shortArray(decoded.themes),visual_language:shortArray(decoded.visual_language),
   narrative:bounded(decoded.narrative,500),creative_mechanism:bounded(decoded.creative_mechanism,500),
   analyzed_at:new Date().toISOString(),model
  },"reference_id");
  const proposals=Array.isArray(decoded.connections)?decoded.connections.slice(0,5):[];
  let saved=0;
  const allowed=new Set(other.map(x=>x.id));
  for(const p of proposals){
   if(!p||typeof p!=="object"||!allowed.has(p.target_id))continue;
   const blocked=prior.some(x=>x.source_id===id&&x.target_id===p.target_id&&x.status!=="pending");
   if(blocked)continue;
   const relation=bounded(p.relation,80),explanation=bounded(p.explanation,400);
   if(!relation||!explanation)continue;
   await upsert(user.accessToken,"reference_ai_suggestions",{
    owner_id:user.userId,source_id:id,target_id:p.target_id,relation,explanation,
    distance:Math.max(0,Math.min(100,Number(p.distance)||50)),status:"pending",model,updated_at:new Date().toISOString()
   },"owner_id,source_id,target_id");saved++;
  }
  return NextResponse.json({insight,created:saved,model});
 }catch(e){return message(e instanceof Error?e.message:"No se pudo analizar la referencia",500)}
}
