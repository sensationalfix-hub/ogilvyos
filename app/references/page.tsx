"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookmarkPlus, Check, ChevronDown, Compass, ExternalLink, Film, FolderOpen, GitBranch, Grid2X2, Image as ImageIcon, Layers2, LibraryBig, Link2, Loader2, MoreHorizontal, Plus, Search, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { ReferenceCapture } from "@/components/os/reference-capture";
import { ReferenceIntelligence } from "@/components/os/reference-intelligence";
import { ReferenceVisualAnalysis } from "@/components/os/reference-visual-analysis";
import { VISUAL_LABELS } from "@/app/lib/reference-visual-vocabulary";
import { LocalDiscovery } from "@/components/os/reference-local-discovery";
import { ReferenceGraph } from "@/components/os/reference-graph";
import "@/components/os/reference-intelligence.css";
import "@/components/os/reference-visual-analysis.css";
import "./references.css";

type Item={id:string;title:string;url:string|null;image_url:string|null;media_path:string|null;kind:"image"|"video"|"audio"|"web"|"other";site:string|null;notes:string;auto_tags:string[];collection_id:string|null;project_id:string|null;created_at:string};
type Collection={id:string;name:string};
type Connection={id:string;source_id:string;target_id:string;relation:string;explanation:string};
type Data={items:Item[];collections:Collection[];connections:Connection[]};
type PageTab="all"|"connections"|"discover";
type ExternalWork={id:string;title:string;description:string;date:string;image:string;url:string;site:string;source:"directors"|"reasonwhy"|"publicista";kind:"video"|"web";mode:"live"|"selection"};
type DiscoverySource="all"|ExternalWork["source"];
const stop=new Set(["para","sobre","desde","hasta","unas","unos","esta","este","entre","tiene","pero","that","with","from","some","this","your","https","www","com","video","image","the","and"]);
function words(r:Item){const text=[r.title,r.notes,...r.auto_tags.filter(tag=>!tag.startsWith("visual:"))].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return Array.from(new Set((text.match(/[a-z]{5,}/g)||[]).filter(t=>!stop.has(t))));}
function similar(ref:Item,items:Item[]){const a=words(ref);return items.filter(x=>x.id!==ref.id).map(item=>{const b=words(item);const overlap=a.filter(w=>b.includes(w));return {item,overlap,score:overlap.length}}).filter(x=>x.score>0).sort((x,y)=>y.score-x.score).slice(0,6)}
type Preview={image?:string;title?:string;site?:string;kind?:string};
const previewRequests=new Map<string,Promise<Preview|null>>();
function directMedia(url:string|null):{src:string;videoFile:boolean}|null{
 if(!url)return null;
 try{
  const u=new URL(url),host=u.hostname.toLowerCase().replace(/^www\./,"");
  if(u.protocol!=="https:")return null;
  const id=host==="youtu.be"?u.pathname.split("/")[1]:["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com"].includes(host)?u.searchParams.get("v")||u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]:null;
  if(id&&/^[A-Za-z0-9_-]{11}$/.test(id))return {src:"https://img.youtube.com/vi/"+id+"/hqdefault.jpg",videoFile:false};
  if(/\.(?:png|jpe?g|webp|gif|avif)$/i.test(u.pathname))return {src:u.href,videoFile:false};
  if(/\.(?:mp4|webm|m4v)$/i.test(u.pathname))return {src:u.href,videoFile:true};
 }catch{}
 return null;
}
function loadRichPreview(url:string):Promise<Preview|null>{
 const cached=previewRequests.get(url);if(cached)return cached;
 const req=(async()=>{
  for(const endpoint of ["/api/creative/preview?url=","/api/references/preview?url="]){
   try{const r=await fetch(endpoint+encodeURIComponent(url));if(!r.ok)continue;const json=await r.json();if(json.preview?.image)return json.preview as Preview;}catch{}
  }
  return null;
 })();
 previewRequests.set(url,req);
 if(previewRequests.size>350)previewRequests.clear();
 return req;
}
function ItemMedia({item}:{item:Item}){
 const direct=directMedia(item.url);
 const fileVideo=direct?.videoFile===true;
 const initial=item.media_path?"/api/references/media?path="+encodeURIComponent(item.media_path):item.image_url||(!fileVideo?direct?.src:null)||null;
 const [rich,setRich]=useState<Preview|null>(null);
 const [broken,setBroken]=useState(false);
 useEffect(()=>{setBroken(false);setRich(null)},[item.id,item.image_url,item.url]);
 useEffect(()=>{
  if(initial||!item.url||fileVideo)return;
  let live=true;
  loadRichPreview(item.url).then(preview=>{
   if(!live||!preview?.image)return;
   setRich(preview);
   fetch("/api/references",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,image_url:preview.image,site:preview.site||item.site||undefined,kind:preview.kind||item.kind})}).catch(()=>{});
  }).catch(()=>{});
  return()=>{live=false};
 },[item.id,item.url,item.image_url,item.site,item.kind,initial,fileVideo]);
 const src=broken?null:(initial||rich?.image||null);
 if(fileVideo&&item.url)return <div className="rl-media rl-media-video"><video key={item.url} src={item.url+"#t=3"} preload="metadata" playsInline muted onLoadedMetadata={e=>{const video=e.currentTarget;if(video.duration>1){try{video.currentTime=Math.min(4,video.duration*.12)}catch{}}}} onError={()=>setBroken(true)}/><span className="rl-media-play"><Film size={19}/></span></div>;
 if(src)return <img className="rl-img" src={src} alt={item.title} loading="lazy" decoding="async" onError={()=>setBroken(true)}/>;
 return <div className={"rl-art rl-art-"+item.kind}><span>{item.kind==="video"?<Film size={29}/>:item.kind==="audio"?<Layers2 size={30}/>:item.kind==="image"?<ImageIcon size={30}/>:<Link2 size={29}/>}</span><small>{item.site||"REFERENCE"}</small></div>;
}
function domain(url:string|null){try{return url?new URL(url).hostname.replace(/^www\./,""):"Archivo"}catch{return "Referencia"}}
function MasonryGallery({items,onOpen}:{items:Item[];onOpen:(id:string)=>void}){
 const containerRef=useRef<HTMLDivElement>(null);
 const [columns,setColumns]=useState(5);
 useEffect(()=>{
  const el=containerRef.current;
  if(!el)return;
  const calculate=(width:number)=>{
   const count=width<440?1:width<640?2:width<860?3:width<1080?4:5;
   setColumns(current=>current===count?current:count);
  };
  calculate(el.getBoundingClientRect().width);
  const observer=new ResizeObserver(entries=>{if(entries[0])calculate(entries[0].contentRect.width)});
  observer.observe(el);
  return()=>observer.disconnect();
 },[]);
 const groups=useMemo(()=>{
  const buckets:Item[][]=Array.from({length:columns},()=>[]);
  const weight=Array(columns).fill(0) as number[];
  for(const item of items){
   const next=weight.indexOf(Math.min(...weight));
   buckets[next].push(item);
   // Estimate heights before imagery loads. Each column remains independently stacked.
   const likelyRatio=item.kind==="video"?0.66:item.kind==="image"?1.25:item.kind==="audio"?0.92:1.05;
   weight[next]+=likelyRatio+0.29;
  }
  return buckets;
 },[items,columns]);
 return <div className="rl-masonry" ref={containerRef} style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>
  {groups.map((group,index)=><div className="rl-masonry-column" key={index}>
   {group.map(item=><button key={item.id} className="rl-card" type="button" onClick={()=>onOpen(item.id)}>
    <ItemMedia item={item}/>
    <span className="rl-card-caption"><strong>{item.title}</strong><small>{item.site||domain(item.url)}</small></span>
    <span className="rl-card-action"><ArrowUpRight size={16}/></span>
    {item.kind==="video"&&<span className="rl-type"><Film size={12}/> Vídeo</span>}
   </button>)}
  </div>)}
 </div>;
}
function DiscoveryImage({work}:{work:ExternalWork}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[work.id,work.image]);
 return <div className={"rl-discovery-media"+(!work.image||failed?" is-placeholder":"")}>
  {!work.image||failed?
   <span className="rl-discovery-placeholder"><Film size={31}/><small>{work.source==="directors"?"FILM / CAMPAIGN":"CREATIVE / CAMPAIGN"}</small></span>:
   <img src={work.image} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>}
  <span className="rl-discovery-media-type">{work.source==="directors"?"SPOT / FILM":"CAMPAÑA"}</span>
 </div>;
}
export default function ReferencesPage(){
 const [data,setData]=useState<Data>({items:[],collections:[],connections:[]});
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const [tab,setTab]=useState<PageTab>("all");const [filter,setFilter]=useState("all");const [query,setQuery]=useState("");
 const [capture,setCapture]=useState(false);const [activeId,setActiveId]=useState<string|null>(null);
 const [creating,setCreating]=useState(false);const [collectionName,setCollectionName]=useState("");
 const [editTitle,setEditTitle]=useState("");const [editNotes,setEditNotes]=useState("");const [editCollection,setEditCollection]=useState("");
 const [connectTo,setConnectTo]=useState("");const [connectionLabel,setConnectionLabel]=useState("inspira");
 const [externalTerm,setExternalTerm]=useState("");
 const [externalWorks,setExternalWorks]=useState<ExternalWork[]>([]);
 const [externalLoading,setExternalLoading]=useState(false);
 const [externalError,setExternalError]=useState("");
 const [savingExternal,setSavingExternal]=useState<string|null>(null);
 const [discoverySource,setDiscoverySource]=useState<DiscoverySource>("all");
 const [importStatus,setImportStatus]=useState("");
 const discoveryTerm=externalTerm.trim();
 useEffect(()=>{
  if(tab!=="discover")return;
  let active=true;
  const timer=setTimeout(async()=>{
   setExternalLoading(true);setExternalError("");
   try{const r=await fetch("/api/references/discover?q="+encodeURIComponent(discoveryTerm),{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Error de búsqueda");if(active){setExternalWorks(d.works||[]);setExternalError(d.error||"")}}
   catch(e){if(active){setExternalWorks([]);setExternalError(e instanceof Error?e.message:"No se pudo buscar")}}
   finally{if(active)setExternalLoading(false)}
  },350);
  return()=>{active=false;clearTimeout(timer)}
 },[tab,discoveryTerm]);

 useEffect(()=>{window.scrollTo({top:0,behavior:"instant"})},[tab]);
 const load=useCallback(async()=>{try{const r=await fetch("/api/references",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Error de biblioteca");setData({items:d.items||[],collections:d.collections||[],connections:d.connections||[]});setError("")}catch(e){setError(e instanceof Error?e.message:"No se pudo abrir la biblioteca")}finally{setLoading(false)}},[]);
 useEffect(()=>{load();const refresh=()=>load();window.addEventListener("reference-lib:changed",refresh);return()=>window.removeEventListener("reference-lib:changed",refresh)},[load]);
 const selected=data.items.find(x=>x.id===activeId)||null;
 useEffect(()=>{if(selected){setEditTitle(selected.title);setEditNotes(selected.notes||"");setEditCollection(selected.collection_id||"");setConnectTo("")}},[activeId,selected?.title,selected?.notes,selected?.collection_id]);
 const filtered=useMemo(()=>data.items.filter(r=>{
 if(filter==="unfiled"&&r.collection_id)return false;
 if(filter!=="all"&&filter!=="unfiled"&&r.collection_id!==filter)return false;
 const hay=[r.title,r.notes,r.site,...r.auto_tags].join(" ").toLowerCase();
 return !query.trim()||hay.includes(query.trim().toLowerCase())
 }),[data.items,query,filter]);
 const relations=selected?data.connections.filter(c=>c.source_id===selected.id||c.target_id===selected.id):[];
 const suggested=selected?similar(selected,data.items).filter(x=>!relations.some(c=>c.source_id===x.item.id||c.target_id===x.item.id)).slice(0,4):[];
 const visualSuggestions=selected?data.items.filter(item=>item.id!==selected.id).map(item=>{
  const current=new Set((selected.auto_tags||[]).filter(tag=>tag.startsWith("visual:")));
  const overlap=(item.auto_tags||[]).filter(tag=>current.has(tag));
  return {item,overlap};
 }).filter(row=>row.overlap.length>=1&&!relations.some(c=>c.source_id===row.item.id||c.target_id===row.item.id)).sort((a,b)=>b.overlap.length-a.overlap.length).slice(0,4):[];
 const request=async(method:"POST"|"PATCH"|"DELETE",body?:Record<string,unknown>,url="/api/references")=>{
 const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||"Error al guardar");return d
 };
 const createCollection=async()=>{if(!collectionName.trim())return;setBusy(true);try{await request("POST",{action:"collection",name:collectionName});setCollectionName("");setCreating(false);await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const updateSelected=async()=>{if(!selected)return;setBusy(true);try{await request("PATCH",{id:selected.id,title:editTitle,notes:editNotes,collection_id:editCollection||null});await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const deleteSelected=async()=>{if(!selected||!window.confirm("¿Eliminar esta referencia de la biblioteca?"))return;setBusy(true);try{await request("DELETE",undefined,"/api/references?id="+encodeURIComponent(selected.id));setActiveId(null);await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const connect=async(targetId:string,label:string)=>{if(!selected)return;setBusy(true);try{await request("POST",{action:"connection",source_id:selected.id,target_id:targetId,relation:label});setConnectTo("");await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const disconnect=async(id:string)=>{setBusy(true);try{await request("DELETE",undefined,"/api/references?type=connection&id="+encodeURIComponent(id));await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const saveDiscovered=async(work:ExternalWork)=>{
  setSavingExternal(work.id);
  try{await request("POST",{url:work.url,title:work.title,image_url:work.image||null,site:work.site,kind:work.kind,notes:work.description});await load()}
  catch(e){setExternalError(e instanceof Error?e.message:"No se pudo guardar")}
  finally{setSavingExternal(null)}
 };
 const importCreative=async()=>{setBusy(true);setImportStatus("Revisando mapas de Creative Lab...");
 try{const r=await fetch("/api/creative",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"No se pudieron leer los mapas");
 const nodes:{url:string;title:string;body?:string;project_id?:string|null}[]=[];const seen=new Set(data.items.map(i=>i.url).filter(Boolean));
 for(const board of d.boards||[])for(const node of board.nodes||[]){if(node.kind!=="referencia"||typeof node.url!=="string"||!node.url.startsWith("https://")||seen.has(node.url))continue;seen.add(node.url);nodes.push({...node,project_id:board.project_id||null})}
 let count=0;
 for(const n of nodes.slice(0,80)){try{await request("POST",{url:n.url,title:n.title||"",notes:n.body||"",project_id:n.project_id||null});count++}catch{}setImportStatus("Importando "+count+" / "+Math.min(nodes.length,80)+" referencias")}
 await load();setImportStatus(count?count+" referencias importadas desde Creative Lab.":nodes.length?"Algunas referencias no pudieron importarse.":"No hay referencias nuevas con enlace en tus mapas.");
 }catch(e){setImportStatus(e instanceof Error?e.message:"Error al importar")}finally{setBusy(false)}};

 const discoveryLinks=[
  {id:"directors" as const,label:"Directors' Library",url:"https://directorslibrary.com/videos/latest/campaigns/"},
  {id:"reasonwhy" as const,label:"Reason Why",url:"https://www.reasonwhy.es/noticias-sobre/campanas-de-publicidad"},
  {id:"publicista" as const,label:"El Publicista",url:"https://www.elpublicista.es/"}
 ];
 const discoveryVisible=externalWorks.filter(work=>discoverySource==="all"||work.source===discoverySource);
 const sourceCount=(source:DiscoverySource)=>source==="all"?externalWorks.length:externalWorks.filter(w=>w.source===source).length;
 return <main className={"rl-shell"+(tab==="connections"?" rl-immersive":"")}>
  <aside className="rl-sidebar">
   <Link href="/" className="rl-brand"><span className="rl-logo"><LibraryBig size={22}/></span><span>REF<span>LIB</span><small>OS</small></span></Link>
   <div className="rl-sideheading">BIBLIOTECA</div>
   <button className={"rl-sidenav"+(tab==="all"&&filter==="all"?" active":"")} onClick={()=>{setTab("all");setFilter("all")}}><Grid2X2 size={16}/> Todas las referencias <span>{data.items.length}</span></button>
   <button className={"rl-sidenav"+(tab==="connections"?" active":"")} onClick={()=>setTab("connections")}><GitBranch size={16}/> Conexiones</button>
   <button className={"rl-sidenav"+(tab==="discover"?" active":"")} onClick={()=>setTab("discover")}><Compass size={16}/> Descubrir <Sparkles size={13}/></button>
   <div className="rl-sideheading rl-colheader">COLECCIONES <button title="Nueva colección" aria-label="Crear colección" onClick={()=>setCreating(x=>!x)}><Plus size={17}/></button></div>
   {creating&&<form className="rl-create-collection" onSubmit={e=>{e.preventDefault();createCollection()}}><input autoFocus value={collectionName} onChange={e=>setCollectionName(e.target.value)} placeholder="Nombre de colección" maxLength={110}/><button type="submit" disabled={busy}><Check size={15}/></button></form>}
   {data.collections.map(c=><button className={"rl-sidenav"+(tab==="all"&&filter===c.id?" active":"")} key={c.id} onClick={()=>{setTab("all");setFilter(c.id)}}><FolderOpen size={16}/><span className="rl-ellipsis">{c.name}</span><span>{data.items.filter(i=>i.collection_id===c.id).length}</span></button>)}
   <button className={"rl-sidenav"+(tab==="all"&&filter==="unfiled"?" active":"")} onClick={()=>{setTab("all");setFilter("unfiled")}}><Layers2 size={16}/> Sin clasificar</button>
   <div className="rl-sidebar-bottom"><span className="rl-status-dot"/> Tu archivo creativo <small>{data.items.length} referencias guardadas</small></div>
  </aside>
  <section className={"rl-content"+(tab==="discover"?" rl-discover-content":"")}>
   {tab==="all"&&<header className="rl-header">
    <div className="rl-title-block"><span className="rl-eyebrow">ARCHIVO / IDEAS / REFERENCIAS</span><h1>{tab==="all"?"Tu universo visual.":"Encuentra lo inesperado."}</h1><p>{tab==="all"?"Todo lo que te inspira, en un solo lugar.":"De tu biblioteca hacia nuevas referencias."}</p></div>
    <button className="rl-add" onClick={()=>setCapture(true)}><Plus size={17}/> Añadir referencia</button>
   </header>}
   <div className={"rl-toolbar"+(tab==="connections"?" rl-graph-toolbar":"")}>
    <div className="rl-search"><Search size={18}/><input aria-label={tab==="discover"?"Buscar campañas":"Buscar referencias"} placeholder={tab==="discover"?"Buscar spots, marcas, directores, ideas...":"Buscar una idea, un autor, un concepto..."} value={tab==="discover"?externalTerm:query} onChange={e=>{if(tab==="discover")setExternalTerm(e.target.value);else setQuery(e.target.value)}}/><kbd>⌘ K</kbd></div>
    <div className="rl-tabs"><button className={tab==="all"?"active":""} onClick={()=>setTab("all")}>Galería</button><button className={tab==="connections"?"active":""} onClick={()=>setTab("connections")}>Conexiones</button><button className={tab==="discover"?"active":""} onClick={()=>setTab("discover")}>Explorar</button></div>
    {tab==="connections"&&<button className="rl-add rl-graph-add" onClick={()=>setCapture(true)}><Plus size={16}/> Añadir referencia</button>}
    {tab==="discover"&&<button className="rl-add rl-discover-add" onClick={()=>setCapture(true)}><Plus size={16}/> Añadir referencia</button>}
   </div>
   {error&&<div className="rl-error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}
   {tab==="all"&&<div className="rl-gallery-view">
    <div className="rl-section-line"><span>{filter==="all"?"TODAS LAS REFERENCIAS":filter==="unfiled"?"SIN CLASIFICAR":data.collections.find(x=>x.id===filter)?.name?.toUpperCase()||"COLECCIÓN"}</span><span>{filtered.length} elementos</span></div>
    {loading?<div className="rl-loading"><Loader2 size={22} className="rl-rotate"/> Abriendo tu biblioteca...</div>:filtered.length?<MasonryGallery items={filtered} onOpen={setActiveId}/>:
    <div className="rl-empty"><div className="rl-empty-art"><LibraryBig size={43}/><i/><i/><i/></div><h2>{data.items.length?"Aquí todavía no hay referencias.":"Toda gran colección empieza por una obsesión."}</h2><p>{data.items.length?"Prueba otro filtro o crea una colección.":"Guarda enlaces e imágenes, o trae las referencias que ya utilizas en Creative Lab."}</p><div className="rl-empty-actions"><button onClick={()=>setCapture(true)}><Plus size={15}/> Añadir referencia</button><button className="secondary" onClick={importCreative} disabled={busy}><Upload size={15}/> Importar de Creative Lab</button></div></div>}
    {data.items.length>0&&<div className="rl-import-footer"><button disabled={busy} onClick={importCreative}><Upload size={15}/> Importar referencias de Creative Lab</button>{importStatus&&<span>{importStatus}</span>}</div>}
    {data.items.length===0&&importStatus&&<p className="rl-import-status">{importStatus}</p>}
   </div>}
   {tab==="connections"&&(loading?<div className="rl-loading"><Loader2 size={22} className="rl-rotate"/> Construyendo el mapa...</div>:<ReferenceGraph items={data.items} collections={data.collections} connections={data.connections} query={query} onOpen={setActiveId} onRefresh={load}/>)}
   {tab==="discover"&&<div className="rl-discover-view rl-ad-discover">
    <div className="rl-ad-heading">
     <div><span className="rl-eyebrow">REF LIB / DESCUBRIR</span><h2>Ideas que merecen guardarse.</h2><p>Spots, campañas y dirección creativa. Piezas reales, en su fuente original.</p></div>
     <span className="rl-ad-result-count">{externalLoading?"Actualizando...":discoveryVisible.length+" referencias"}</span>
    </div>
    <div className="rl-ad-filters" role="group" aria-label="Filtrar por fuente">
     <button className={discoverySource==="all"?"active":""} onClick={()=>setDiscoverySource("all")}>Todo <span>{sourceCount("all")}</span></button>
     {discoveryLinks.map(source=><button key={source.id} className={discoverySource===source.id?"active":""} onClick={()=>setDiscoverySource(source.id)}>{source.label} <span>{sourceCount(source.id)}</span></button>)}
     <details className="rl-ad-ai-toggle"><summary><Sparkles size={14}/> IA local <ChevronDown size={13}/></summary><div className="rl-ad-ai-body"><LocalDiscovery items={data.items} onSelect={value=>{setExternalTerm(value);setDiscoverySource("all")}}/></div></details>
    </div>
    {externalError&&<p className="rl-ad-error" role="status">{externalError}</p>}
    {externalLoading&&externalWorks.length===0?<div className="rl-loading"><Loader2 size={18} className="rl-rotate"/> Buscando campañas...</div>:
     discoveryVisible.length>0?<div className="rl-discovery-grid">
      {discoveryVisible.map(work=>{
       const saved=data.items.some(i=>i.url===work.url);
       return <article className="rl-discovery-card" key={work.id}>
        <DiscoveryImage work={work}/>
        <div className="rl-discovery-copy">
         <div className="rl-ad-card-meta"><span>{work.site}</span>{work.mode==="selection"&&<small>Selección verificada</small>}</div>
         <h3>{work.title}</h3>
         {work.description&&<p>{work.description}</p>}
         <div className="rl-ad-card-actions">
          <button disabled={saved||savingExternal===work.id} onClick={()=>saveDiscovered(work)}>{saved?<Check size={15}/>:savingExternal===work.id?<Loader2 size={15} className="rl-rotate"/>:<Plus size={15}/>} {saved?"Guardada":"Guardar"}</button>
          <a href={work.url} target="_blank" rel="noopener noreferrer" title={"Abrir "+work.site} aria-label={"Abrir "+work.title+" en "+work.site}><ArrowUpRight size={16}/></a>
         </div>
        </div>
       </article>;
      })}
     </div>:!externalLoading?<div className="rl-ad-no-results"><Search size={23}/><strong>No hay campañas con ese filtro.</strong><p>La búsqueda filtra las últimas piezas recuperadas, no el archivo completo de cada medio. Puedes seguir buscando en las fuentes.</p></div>:<div className="rl-loading"><Loader2 size={18} className="rl-rotate"/> Actualizando campañas...</div>}
    <div className="rl-ad-source-footer"><span>FUENTES EDITORIALES</span>{discoveryLinks.map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRight size={13}/></a>)}</div>
   </div>}
  </section>
  {selected&&<><button aria-label="Cerrar referencia" className="rl-inspector-shade" onClick={()=>setActiveId(null)}/><aside className="rl-inspector">
   <div className="rl-inspector-head"><span>DETALLE DE REFERENCIA</span><button onClick={()=>setActiveId(null)} aria-label="Cerrar"><X size={19}/></button></div>
   <div className="rl-inspector-image"><ItemMedia item={selected}/></div>
   <div className="rl-inspector-body">
    <span className="rl-eyebrow">{selected.kind.toUpperCase()} / {selected.site||domain(selected.url)}</span>
    <label className="rl-edit-label" htmlFor="rl-ref-title">TÍTULO</label><input id="rl-ref-title" className="rl-title-input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={180}/>
    <label className="rl-edit-label" htmlFor="rl-ref-note">POR QUÉ LA GUARDÉ</label><textarea id="rl-ref-note" className="rl-notes" rows={4} value={editNotes} placeholder="¿Qué te llamó la atención? Puedes dejarlo en blanco." onChange={e=>setEditNotes(e.target.value)}/>
    <label className="rl-edit-label" htmlFor="rl-ref-collection">COLECCIÓN</label><select id="rl-ref-collection" className="rl-notes" value={editCollection} onChange={e=>setEditCollection(e.target.value)}><option value="">Sin colección</option>{data.collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <button className="rl-save" disabled={busy||!editTitle.trim()} onClick={updateSelected}><Check size={16}/> Guardar cambios</button>
    {selected.url&&<a className="rl-external-link" href={selected.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Abrir fuente original</a>}
    <Link className="rl-lab-link" href="/creative" title="Abre el mapa de destino y usa Añadir desde Library"><GitBranch size={16}/> Abrir Creative Lab <ArrowUpRight size={15}/></Link>
    <ReferenceVisualAnalysis key={selected.id+"-vision"} item={selected} onUpdate={load}/>
    <ReferenceIntelligence key={selected.id} referenceId={selected.id} items={data.items} onUpdate={load}/>
    <div className="rl-divider"/>
    <div className="rl-relationship-title"><strong>Conexiones</strong><span>{relations.length} guardadas</span></div>
    {relations.map(c=>{const other=data.items.find(x=>x.id===(c.source_id===selected.id?c.target_id:c.source_id));return other?<div key={c.id} className="rl-related"><div className="rl-related-thumb"><ItemMedia item={other}/></div><button className="rl-related-copy" onClick={()=>setActiveId(other.id)}><strong>{other.title}</strong><span>{c.relation}</span></button><button title="Eliminar conexión" onClick={()=>disconnect(c.id)}><X size={14}/></button></div>:null})}
    {visualSuggestions.length>0&&<><span className="rl-edit-label">AFINIDADES VISUALES · POR CONCEPTOS GUARDADOS</span>{visualSuggestions.map(row=><div key={row.item.id} className="rl-related"><div className="rl-related-thumb"><ItemMedia item={row.item}/></div><button className="rl-related-copy" onClick={()=>setActiveId(row.item.id)}><strong>{row.item.title}</strong><span>Comparten {row.overlap.slice(0,2).map(tag=>VISUAL_LABELS.find(l=>l.id===tag.slice(7))?.name||tag.slice(7)).join(", ")}</span></button><button title="Conectar por lenguaje visual" disabled={busy} onClick={()=>connect(row.item.id,"comparte lenguaje visual")}><Plus size={16}/></button></div>)}</>}
    {suggested.length>0&&<><span className="rl-edit-label">POSIBLES AFINIDADES · POR TEXTO</span>{suggested.map(c=><div key={c.item.id} className="rl-related"><div className="rl-related-thumb"><ItemMedia item={c.item}/></div><button className="rl-related-copy" onClick={()=>setActiveId(c.item.id)}><strong>{c.item.title}</strong><span>Comparten {c.overlap.slice(0,2).join(", ")}</span></button><button title="Conectar" disabled={busy} onClick={()=>connect(c.item.id,"comparte tema")}><Plus size={16}/></button></div>)}</>}
    <span className="rl-edit-label">CONECTAR MANUALMENTE</span>
    <div className="rl-connect-form"><select value={connectTo} onChange={e=>setConnectTo(e.target.value)}><option value="">Elegir otra referencia</option>{data.items.filter(x=>x.id!==selected.id&&!relations.some(c=>c.source_id===x.id||c.target_id===x.id)).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select><select value={connectionLabel} onChange={e=>setConnectionLabel(e.target.value)}><option>inspira</option><option>comparte tema</option><option>contradice</option><option>misma estética</option><option>desarrolla</option></select><button disabled={!connectTo||busy} onClick={()=>connect(connectTo,connectionLabel)}><Plus size={14}/> Conectar</button></div>
    <div className="rl-divider"/><button className="rl-delete" onClick={deleteSelected} disabled={busy}><Trash2 size={15}/> Eliminar referencia</button>
   </div>
  </aside></>}
  <ReferenceCapture open={capture} onClose={()=>setCapture(false)} onSaved={load}/>
 </main>
}