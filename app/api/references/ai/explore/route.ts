import {NextResponse} from "next/server";
import {lifeSession,lifeSelect} from "@/app/lib/life-store";
export const maxDuration=50;
export async function POST(request:Request){
 const user=await lifeSession(request);
 if(!user)return NextResponse.json({error:"Sin sesión"},{status:401});
 const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||request.headers.get("x-vercel-oidc-token");
 if(!token)return NextResponse.json({error:"AI Gateway no está configurado."},{status:503});
 try{
  const refs=await lifeSelect<{title:string;notes:string;auto_tags:string[]}>(user.accessToken,"reference_items","select=title,notes,auto_tags&limit=40");
  if(!refs.length)return NextResponse.json({error:"Primero guarda una referencia."},{status:400});
  const prompt="Eres un curador creativo. A partir de estas referencias propone 3 territorios nuevos de exploración conceptual y visual en arte. No inventes obras. Devuelve únicamente JSON: {directions:[{title:string,reason:string,query:string}]}. Title y reason en español; query en inglés de 1-3 palabras, válido para un buscador de museo de arte. Evita sugerir más de lo mismo. Referencias: "+JSON.stringify(refs.map(x=>({title:x.title,notes:x.notes.slice(0,130),tags:x.auto_tags})));
  const r=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-2.5-flash",messages:[{role:"user",content:prompt}],max_tokens:850,response_format:{type:"json_object"}}),signal:AbortSignal.timeout(35000)});
  if(!r.ok)return NextResponse.json({error:"AI Gateway devolvió "+r.status},{status:502});
  const d=await r.json();const raw=String(d.choices?.[0]?.message?.content||"").replace(/^```json\s*/,"").replace(/```$/,"");
  const obj=JSON.parse(raw);const directions=(Array.isArray(obj.directions)?obj.directions:[]).slice(0,3).map((x:{title:string;reason:string;query:string})=>({title:String(x.title||"Nueva ruta").slice(0,90),reason:String(x.reason||"").slice(0,250),query:String(x.query||"").replace(/[^a-zA-Z\s-]/g,"").slice(0,65)})).filter((x:{query:string})=>x.query.length>2);
  return NextResponse.json({directions});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error de IA"},{status:500})}
}
