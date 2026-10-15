import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";

export const runtime = "nodejs";

/**
 * Public source pages only. No general-purpose URL fetching or paid discovery API.
 * Indexes are cached and fall back to a small, verified set if a publisher blocks
 * automated access. Original pieces always open at their publisher.
 */
type SourceId = "directors" | "reasonwhy" | "publicista";
type Work = {
 id: string; title: string; description: string; image: string;
 url: string; source: SourceId; site: string; kind: "video" | "web";
 date: string; mode: "live" | "selection";
};
const sources:Record<SourceId,{name:string;index:string;kind:"video"|"web"}>={
 directors:{name:"Directors' Library",index:"https://directorslibrary.com/videos/latest/campaigns/",kind:"video"},
 reasonwhy:{name:"Reason Why",index:"https://www.reasonwhy.es/noticias-sobre/campanas-de-publicidad",kind:"web"},
 publicista:{name:"El Publicista",index:"https://www.elpublicista.es/",kind:"web"},
};
const selection:Pick<Work,"url"|"title"|"description"|"source"|"kind">[]=[
 {url:"https://directorslibrary.com/2026/latest/campaigns/aldi-kids-aldi/",title:"ALDI Kids · Marleaux Desiré",description:"Campaña audiovisual de ALDI, dirigida por Marleaux Desiré.",source:"directors",kind:"video"},
 {url:"https://directorslibrary.com/2026/latest/campaigns/tdr-x-nike/",title:"TDR × Nike · Thuan Tran",description:"Pieza de Nike, dirigida por Thuan Tran.",source:"directors",kind:"video"},
 {url:"https://directorslibrary.com/2026/latest/campaigns/a24-meets-dior/",title:"A24 Meets Dior · Aidan Zamiri",description:"Colaboración cinematográfica de A24 y Dior.",source:"directors",kind:"video"},
 {url:"https://directorslibrary.com/2026/latest/campaigns/feel-perfected-srixon/",title:"Feel Perfected · Srixon",description:"Spot de Srixon, dirigido por Alex Ramsey.",source:"directors",kind:"video"},
 {url:"https://www.reasonwhy.es/actualidad/turismo-andalucia-cierra-andalusian-crush-provincias-videojuegos",title:"Andalusian Crush entra en los videojuegos",description:"La campaña de Andalucía explora nuevos formatos.",source:"reasonwhy",kind:"web"},
 {url:"https://www.reasonwhy.es/actualidad/asics-pone-movimiento-humano-peligro-extincion-alertar-sedentarismo",title:"Asics: el movimiento, en peligro de extinción",description:"Campaña creativa sobre sedentarismo y deporte.",source:"reasonwhy",kind:"web"},
 {url:"https://www.reasonwhy.es/actualidad/nueva-plataforma-just-eat-quedate-en-el-momento",title:"Just Eat · Quédate en el momento",description:"Nueva plataforma de marca y campaña audiovisual.",source:"reasonwhy",kind:"web"},
 {url:"https://www.elpublicista.es/anunciantes/mutua-madrilena-lanza-campana-verano-basandose-satisfaccion",title:"Mutua Madrileña · Campaña de verano",description:"Campaña de imagen basada en la satisfacción de sus clientes.",source:"publicista",kind:"web"},
 {url:"https://www.elpublicista.es/anunciantes/fotocasa-lanza-ultima-campana-ritmo-pop-ska-flamenco",title:"Fotocasa · Pop, ska y flamenco",description:"Tres piezas audiovisuales en distintos estilos musicales.",source:"publicista",kind:"web"},
 {url:"https://www.elpublicista.es/anunciantes/nueva-campana-canal-isabel-ii-presenta-agua-madrid-como",title:"Canal de Isabel II · Orgullo local",description:"Campaña de marca para fomentar el consumo del agua del grifo.",source:"publicista",kind:"web"},
 {url:"https://www.elpublicista.es/anunciantes/bono-cultural-joven-renueva-comunicacion-para-hablar-generacion",title:"Bono Cultural Joven · Nueva comunicación",description:"Campaña dirigida a una nueva generación.",source:"publicista",kind:"web"},
];
const decode=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);?/gi,(_,val:string)=>{
 const number=val[0].toLowerCase()==="x"?parseInt(val.slice(1),16):parseInt(val,10);
 return Number.isFinite(number)&&number>=32&&number<0x110000?String.fromCodePoint(number):" ";
}).replace(/&(?:amp|quot|apos|lt|gt|nbsp|ndash|mdash|hellip|rsquo|lsquo|ldquo|rdquo|eacute|aacute|oacute|iacute|uacute|ntilde);/gi,found=>({
 "&amp;":"&","&quot;":'"',"&apos;":"'","&lt;":"<","&gt;":">","&nbsp;":" ","&ndash;":"–","&mdash;":"—","&hellip;":"…",
 "&rsquo;":"’","&lsquo;":"‘","&ldquo;":"“","&rdquo;":"”","&eacute;":"é","&aacute;":"á","&oacute;":"ó","&iacute;":"í","&uacute;":"ú","&ntilde;":"ñ",
} as Record<string,string>)[found.toLowerCase()]||" ");
const clean=(s:string)=>decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
const attr=(s:string,name:string)=>s.match(new RegExp("\\b"+name+"\\s*=\\s*([\"'])([\\s\\S]*?)\\1","i"))?.[2]||"";
const safe=(raw:string,base:string,source:SourceId)=>{
 try{
  const u=new URL(decode(raw),base);const hostname=u.hostname.toLowerCase().replace(/^www\./,"");
  if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
  const hosts:Record<SourceId,string>={directors:"directorslibrary.com",reasonwhy:"reasonwhy.es",publicista:"elpublicista.es"};
  if(hostname!==hosts[source])return null;
  u.hash="";return u.href;
 }catch{return null;}
};
const safeImage=(raw:string,base:string)=>{
 try{
  const u=new URL(decode(raw),base);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return "";
  if(["localhost","127.0.0.1","0.0.0.0","::1"].includes(u.hostname)||u.hostname.endsWith(".local"))return "";
  return u.href;
 }catch{return "";}
};
const matchPath=(u:URL,source:SourceId)=>{
 if(source==="directors")return /^\/20\d{2}\/latest\/campaigns\/[^/]+\/?$/.test(u.pathname);
 if(source==="reasonwhy")return /^\/actualidad\/[^/]{6,}\/?$/.test(u.pathname);
 return /^\/(?:anunciantes|agencias|campanas|creatividad|marketing|produccion|estrategia)\/[^/]{8,}\/?$/.test(u.pathname);
};
const publicistaRelevant=/(campaña|spot|publicidad|creativ|marca|anunci|lanzam|pel[ií]cula|plataforma|concepto|[fú]tbol|nueva imagen|publicitari)/i;
async function fetchPage(url:string){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(6500),headers:{"User-Agent":"Mozilla/5.0 (compatible; REF LIB discovery; +https://ogilvy-os.vercel.app)","Accept":"text/html,application/xhtml+xml"},next:{revalidate:10800}});
  if(!response.ok)return "";
  const type=response.headers.get("content-type")||"";
  if(!type.includes("html"))return "";
  const content=await response.text();
  return content.slice(0,850000);
 }catch{return "";}
}
function parseIndex(html:string,source:SourceId):Work[]{
 const src=sources[source],out:Work[]=[];
 const seen=new Set<string>();
 const anchors=/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi;
 for(const match of html.matchAll(anchors)){
  const address=safe(attr(match[1],"href"),src.index,source);
  if(!address||seen.has(address))continue;
  if(!matchPath(new URL(address),source))continue;
  const title=clean(match[2])||decode(attr(match[1],"title"))||decode(attr(match[2],"alt"));
  if(title.length<13||title.length>190)continue;
  if(source==="publicista"&&!publicistaRelevant.test(title))continue;
  if(source==="reasonwhy"&&/(^leer m[aá]s$|^ver noticia$)/i.test(title))continue;
  seen.add(address);
  out.push({id:source+":"+address,title,description:"",image:"",url:address,source,site:src.name,kind:src.kind,date:"",mode:"live"});
  if(out.length>=22)break;
 }
 return out;
}
function ogImage(html:string,base:string){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 for(const tag of tags){
  const property=attr(tag,"property")||attr(tag,"name");
  if(/^(og:image|twitter:image|twitter:image:src)$/i.test(property)){
   const url=safeImage(attr(tag,"content"),base);if(url)return url;
  }
 }
 return "";
}
async function enrich(item:Work):Promise<Work>{
 const html=await fetchPage(item.url);
 if(!html)return item;
 const image=ogImage(html,item.url);
 // Keep title supplied by index, because page titles may include navigation and SEO junk.
 const shortDescription=(html.match(/<meta\s+[^>]*(?:name=["']description["'][^>]*content=["']([^"']+)|content=["']([^"']+)["'][^>]*name=["']description["'])/i)||[]).slice(1).find(Boolean)||"";
 return {...item,image,description:item.description||clean(shortDescription).slice(0,180)};
}
const normalized=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const matches=(item:Work,query:string)=>!query||normalized([item.title,item.description,item.site].join(" ")).includes(query);
function roundRobin(input:Work[],limit:number){
 const sourcesOrder:SourceId[]=["directors","reasonwhy","publicista"];
 const groups=new Map(sourcesOrder.map(source=>[source,input.filter(item=>item.source===source)]));
 const result:Work[]=[];
 while(result.length<limit){
  let added=false;
  for(const source of sourcesOrder){
   const next=groups.get(source)?.shift();
   if(next){result.push(next);added=true;}
  }
  if(!added)break;
 }
 return result.slice(0,limit);
}
export async function GET(request:Request){
 if(!await lifeSession(request))return NextResponse.json({error:"Sin autorización"},{status:401});
 const query=normalized((new URL(request.url).searchParams.get("q")||"").slice(0,100));
 const [directorIndex,reasonIndex,publicistaIndex]=await Promise.all([
  fetchPage(sources.directors.index),fetchPage(sources.reasonwhy.index),fetchPage(sources.publicista.index),
 ]);
 const lists:[SourceId,string][]=[["directors",directorIndex],["reasonwhy",reasonIndex],["publicista",publicistaIndex]];
 const result:Work[]=[];
 const seen=new Set<string>();
 for(const [source,html] of lists){
  const fresh=parseIndex(html,source);
  // Limited fallback guarantees real advertising references instead of empty or museum results.
  const rows=[...fresh,...selection.filter(item=>item.source===source).map(item=>({
   ...item,id:source+":"+item.url,site:sources[source].name,image:"",date:"",mode:"selection" as const,
  }))];
  for(const item of rows){
   if(seen.has(item.url))continue;
   seen.add(item.url);result.push(item);
  }
 }
 const filtered=result.filter(item=>matches(item,query));
 const ordered=roundRobin(filtered,30);
 // Fetch metadata for a bounded visible batch; cache each source page for three hours.
 const works=await Promise.all(ordered.map((work,index)=>index<18?enrich(work):Promise.resolve(work)));
 return NextResponse.json({works,query,counts:Object.fromEntries((Object.keys(sources) as SourceId[]).map(key=>[key,filtered.filter(w=>w.source===key).length])),sources:Object.fromEntries(lists.map(([source,html])=>[source,html?"online":"selección verificada"]))},{
  headers:{"Cache-Control":"private, max-age=300"}
 });
}
