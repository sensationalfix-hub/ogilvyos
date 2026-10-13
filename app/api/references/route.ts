import { NextResponse } from "next/server";
import { lifeSession, lifeSelect, lifeInsert } from "@/app/lib/life-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/lib/supabase-auth";

type RefItem={id:string;title:string;url:string|null;image_url:string|null;media_path:string|null;kind:string;site:string|null;notes:string;auto_tags:string[];collection_id:string|null;project_id:string|null;created_at:string};
type Collection={id:string;name:string;created_at:string};
const reply=(error:string,status:number)=>NextResponse.json({error},{status});
const uuid=(v:unknown)=>typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const trim=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
const safeExternal=(v:unknown)=>{if(typeof v!=="string"||v.length>3000)return null;try{const u=new URL(v);return u.protocol==="https:" && !u.username&&!u.password&&!u.port?u.href:null}catch{return null}};
const terms=["cine","cinematic","cinema","film","western","deporte","sport","nike","real madrid","futbol","football","mitologia","myth","arte","art","fotografia","photo","tipografia","typography","music","musica","video","animation","animacion","surreal","surrealismo","arquitectura","architecture","advertising","publicidad","campana","campaign","ambicion","ambition","humor","comedia","comedy","brutalismo","brutalist"];
const stop=new Set(["https","www","com","the","and","this","with","para","este","esta","desde","sobre","https","video","una","uno","de","del","los","las","por","con","que","you","your","from","more","into","una"]);
function tags(title:string,notes:string){const v=(title+" "+notes).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const lex=terms.filter(t=>v.includes(t)).slice(0,7);const words=v.match(/[a-z]{5,}/g)||[];return Array.from(new Set([...lex,...words.filter(t=>!stop.has(t)).slice(0,5)])).slice(0,10)}
function kindOf(url:string){if(/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url))return "image";if(/youtube\.com|youtu\.be|vimeo\.com|\.mp4(\?|$)/i.test(url))return "video";if(/spotify\.com|soundcloud\.com/i.test(url))return "audio";return "web"}
function headers(token:string,extra:Record<string,string>={}){return {apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json",...extra}}
async function restPatch(token:string,table:string,id:string,body:Record<string,unknown>){const r=await fetch(SUPABASE_URL+"/rest/v1/"+table+"?id=eq."+id,{method:"PATCH",headers:headers(token,{Prefer:"return=representation"}),body:JSON.stringify(body),cache:"no-store"});if(!r.ok)throw new Error(await r.text());const rows=await r.json();return rows[0]||null}
async function restDelete(token:string,table:string,id:string){const r=await fetch(SUPABASE_URL+"/rest/v1/"+table+"?id=eq."+id,{method:"DELETE",headers:headers(token),cache:"no-store"});if(!r.ok)throw new Error(await r.text())}
export async function GET(request:Request){const session=await lifeSession(request);if(!session)return reply("Inicia sesión con Supabase para usar Reference Lib.",401);
 try{const [items,collections,connections]=await Promise.all([
 lifeSelect<RefItem>(session.accessToken,"reference_items","select=id,title,url,image_url,media_path,kind,site,notes,auto_tags,collection_id,project_id,created_at&order=created_at.desc&limit=500"),
 lifeSelect<Collection>(session.accessToken,"reference_collections","select=id,name,created_at&order=name.asc"),
 lifeSelect<{id:string;source_id:string;target_id:string;relation:string;explanation:string}>(session.accessToken,"reference_connections","select=id,source_id,target_id,relation,explanation&limit=1000")
 ]);return NextResponse.json({items,collections,connections});}catch(e){return reply(String(e),500)}}
export async function POST(request:Request){const session=await lifeSession(request);if(!session)return reply("Sin autorización",401);
 const b=await request.json().catch(()=>({}));try{
 if(b.action==="collection"){const name=trim(b.name,110);if(!name)return reply("Indica un nombre.",400);return NextResponse.json({collection:await lifeInsert(session.accessToken,"reference_collections",{owner_id:session.userId,name})},{status:201})}
 if(b.action==="connection"){if(!uuid(b.source_id)||!uuid(b.target_id)||b.source_id===b.target_id)return reply("Referencias incorrectas.",400);return NextResponse.json({connection:await lifeInsert(session.accessToken,"reference_connections",{owner_id:session.userId,source_id:b.source_id,target_id:b.target_id,relation:trim(b.relation,90)||"conecta con",explanation:trim(b.explanation,500)})},{status:201})}
 const url=safeExternal(b.url);const mediaPath=trim(b.media_path,300);
 if(!url&&!mediaPath)return reply("Introduce una URL https o sube una imagen.",400);
 if(mediaPath&&!mediaPath.startsWith(session.userId+"/"))return reply("Archivo no autorizado.",403);
 if(url){
  const q=new URLSearchParams({select:"id,title,url,image_url,media_path,kind,site,notes,auto_tags,collection_id,project_id,created_at",url:"eq."+url,limit:"1"});
  const existing=await lifeSelect<RefItem>(session.accessToken,"reference_items",q.toString());
  if(existing[0])return NextResponse.json({item:existing[0],duplicate:true});
 }
 const collectionId=uuid(b.collection_id)?b.collection_id:null;
 const title=trim(b.title,180)||(url?new URL(url).hostname.replace(/^www\./,""):"Imagen sin título");
 const note=trim(b.notes,4000);
 const kind=["image","video","audio","web","other"].includes(b.kind)?b.kind:(mediaPath?"image":kindOf(url||""));
 const imageUrl=safeExternal(b.image_url);
 const data={owner_id:session.userId,url,media_path:mediaPath||null,title,kind,image_url:imageUrl,site:trim(b.site,100)||null,notes:note,auto_tags:tags(title,note),collection_id:collectionId,project_id:trim(b.project_id,160)||null};
 return NextResponse.json({item:await lifeInsert<RefItem>(session.accessToken,"reference_items",data)},{status:201});
 }catch(e){return reply(String(e),500)}}
export async function PATCH(request:Request){const session=await lifeSession(request);if(!session)return reply("Sin autorización",401);
 const b=await request.json().catch(()=>({}));if(!uuid(b.id))return reply("ID incorrecto",400);try{
 if(b.action==="collection"){const name=trim(b.name,110);if(!name)return reply("Nombre vacío",400);return NextResponse.json({collection:await restPatch(session.accessToken,"reference_collections",b.id,{name})})}
 const payload:Record<string,unknown>={updated_at:new Date().toISOString()};
 if("title" in b)payload.title=trim(b.title,180)||"Sin título";
 if("notes" in b)payload.notes=trim(b.notes,4000);
 if("collection_id" in b)payload.collection_id=uuid(b.collection_id)?b.collection_id:null;
 if("project_id" in b)payload.project_id=trim(b.project_id,160)||null;
 if("image_url" in b)payload.image_url=safeExternal(b.image_url);
 if("site" in b)payload.site=trim(b.site,100)||null;
 if("kind" in b&&["image","video","audio","web","other"].includes(b.kind))payload.kind=b.kind;

 if("title" in b||"notes" in b)payload.auto_tags=tags(String(payload.title||b.current_title||""),String(payload.notes||b.current_notes||""));
 const item=await restPatch(session.accessToken,"reference_items",b.id,payload);if(!item)return reply("Referencia no encontrada",404);return NextResponse.json({item});
 }catch(e){return reply(String(e),500)}}
export async function DELETE(request:Request){const session=await lifeSession(request);if(!session)return reply("Sin autorización",401);
 const p=new URL(request.url).searchParams;const id=p.get("id");if(!uuid(id))return reply("ID incorrecto",400);const table=p.get("type")==="collection"?"reference_collections":p.get("type")==="connection"?"reference_connections":"reference_items";
 try{await restDelete(session.accessToken,table,id!);return NextResponse.json({ok:true});}catch(e){return reply(String(e),500)}}
