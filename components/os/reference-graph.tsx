"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, GitBranch, Layers3, Maximize2, Minus, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import "./reference-graph.css";

type Item = { id:string; title:string; url:string|null; image_url:string|null; media_path:string|null; kind:string; site:string|null; notes:string; auto_tags:string[]; collection_id:string|null };
type Collection = { id:string; name:string };
type Connection = { id:string; source_id:string; target_id:string; relation:string; explanation:string };
type Node = { id:string; title:string; image:string|null; kind:string; collection:string; group:string; count:number; cluster:boolean };
type Edge = { id:string; source:string; target:string; saved:boolean; relation:string; explanation:string; strength:number };
type Point = { x:number;y:number;vx:number;vy:number;dragging?:boolean;pinnedUntil?:number };
type Camera = { x:number;y:number;zoom:number };

const WIDTH = 1120;
const HEIGHT = 720;
const PAGE_SIZE = 110;
const hash = (s:string) => { let h=2166136261;for(let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0; };
const groupId = (item:Item) => item.collection_id||"__unfiled";
const photo = (item:Item) => {
 if(item.media_path) return "/api/references/media?path="+encodeURIComponent(item.media_path);
 if(item.image_url) return item.image_url;
 try { const url=new URL(item.url||""); const host=url.hostname.replace(/^www\./,"");
  const id=host==="youtu.be"?url.pathname.split("/")[1]:["youtube.com","m.youtube.com","music.youtube.com"].includes(host)?url.searchParams.get("v")||url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]:null;
  if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return "https://img.youtube.com/vi/"+id+"/hqdefault.jpg";
  if(/\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname))return url.href;
 }catch{}
 return null;
};
const stem = (tag:string) => tag.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function affinity(a:Item,b:Item) {
 const aTags=new Set((a.auto_tags||[]).map(stem));
 const shared=[...new Set((b.auto_tags||[]).map(stem))].filter(t=>aTags.has(t)&&t.length>3);
 const visual=shared.filter(t=>t.startsWith("visual:"));
 const general=shared.filter(t=>!t.startsWith("visual:"));
 const score=visual.length*3+general.length;
 if(visual.length===0&&general.length<2)return null;
 return {score,explanation:"Coinciden en "+[...visual,...general].slice(0,3).map(s=>s.replace(/^visual:/,"").replace(/-/g," ")).join(", ")+". Sugerencia por etiquetas, todavía no guardada."};
}
function makeGraph(items:Item[],collections:Collection[],connections:Connection[],scope:string|null,term:string,page:number,showSuggestions:boolean) {
 const names=new Map(collections.map(c=>[c.id,c.name]));
 const q=stem(term.trim());
 let pool=items.filter(i=>(!scope||groupId(i)===scope)&&(!q||stem([i.title,i.notes,i.site,...(i.auto_tags||[])].join(" ")).includes(q)));
 const total=pool.length;
 if(scope||q) pool=pool.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const collapsing=!scope&&!q&&items.length>80;
 const sizes=new Map<string,Item[]>();
 for(const item of pool){const k=groupId(item);sizes.set(k,[...(sizes.get(k)||[]),item]);}
 const nodes:Node[]=[];
 const nodeFor=new Map<string,string>();
 for(const [group,groupItems] of sizes){
  if(collapsing&&groupItems.length>=4){
   const id="cluster:"+group;
   nodes.push({id,title:names.get(group)||"Sin clasificar",image:null,kind:"cluster",collection:names.get(group)||"Sin clasificar",group,count:groupItems.length,cluster:true});
   for(const item of groupItems)nodeFor.set(item.id,id);
  }else{
   for(const item of groupItems){
    nodes.push({id:item.id,title:item.title,image:photo(item),kind:item.kind,collection:names.get(group)||"Sin clasificar",group,count:1,cluster:false});
    nodeFor.set(item.id,item.id);
   }
  }
 }
 if(nodes.length>PAGE_SIZE){const allowed=new Set(nodes.slice(0,PAGE_SIZE).map(n=>n.id));nodes.splice(PAGE_SIZE);for(const [k,v] of nodeFor)if(!allowed.has(v))nodeFor.delete(k);}
 const edges:Edge[]=[];
 const merged=new Map<string,Edge>();
 for(const c of connections) {
  const a=nodeFor.get(c.source_id),b=nodeFor.get(c.target_id);
  if(!a||!b||a===b)continue;
  const key=[a,b].sort().join("|");
  const existing=merged.get(key);
  if(existing){existing.strength++;continue;}
  merged.set(key,{id:c.id,source:a,target:b,saved:true,relation:c.relation||"conecta con",explanation:c.explanation||"",strength:1});
 }
 edges.push(...merged.values());
 if(showSuggestions&&!collapsing){
  const byId=new Map(pool.map(item=>[item.id,item]));
  const existing=new Set(edges.map(e=>[e.source,e.target].sort().join("|")));
  const ranks=new Map<string,number>();
  const candidates:{a:string;b:string;score:number;explanation:string}[]=[];
  const possible=nodes.filter(n=>!n.cluster);
  for(let i=0;i<possible.length;i++)for(let j=i+1;j<possible.length;j++){
   const a=possible[i].id,b=possible[j].id,key=[a,b].sort().join("|");
   if(existing.has(key))continue;
   const first=byId.get(a),second=byId.get(b);
   if(!first||!second)continue;
   const match=affinity(first,second);
   if(match)candidates.push({a,b,...match});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates) {
   if(edges.length>=220)break;
   if((ranks.get(c.a)||0)>=3||(ranks.get(c.b)||0)>=3)continue;
   edges.push({id:"suggest:"+c.a+":"+c.b,source:c.a,target:c.b,saved:false,relation:"afinidad posible",explanation:c.explanation,strength:c.score});
   ranks.set(c.a,(ranks.get(c.a)||0)+1);ranks.set(c.b,(ranks.get(c.b)||0)+1);
  }
 }
 return {nodes,edges,total,collapsing,groups:sizes.size};
}
function initialPoint(node:Node,index:number,count:number):Point {
 const angle=(index/Math.max(count,1))*Math.PI*2+(hash(node.group)%70)/80;
 const radius=150+(hash(node.id)%220);
 return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*.7,vx:0,vy:0};
}
export function ReferenceGraph({items,collections,connections,query,onOpen,onRefresh}:{items:Item[];collections:Collection[];connections:Connection[];query:string;onOpen:(id:string)=>void;onRefresh:()=>void|Promise<void>}) {
 const [scope,setScope]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const [suggestions,setSuggestions]=useState(true);
 const [focus,setFocus]=useState<string|null>(null);
 const [activeEdge,setActiveEdge]=useState<string|null>(null);
 const [connectMode,setConnectMode]=useState(false);
 const [connectSource,setConnectSource]=useState<string|null>(null);
 const [draft,setDraft]=useState<{source:string;target:string}|null>(null);
 const [relation,setRelation]=useState("inspira");
 const [explanation,setExplanation]=useState("");
 const [saving,setSaving]=useState(false);
 const [actionError,setActionError]=useState("");
 const [linkDrag,setLinkDrag]=useState<{source:string;x:number;y:number}|null>(null);
 const [camera,setCamera]=useState<Camera>({x:500,y:360,zoom:1});
 const [dims,setDims]=useState({width:1000,height:660});
 const canvas=useRef<HTMLDivElement>(null);
 const positions=useRef<Map<string,Point>>(new Map());
 const pan=useRef<{id:number;x:number;y:number;camX:number;camY:number}|null>(null);
 const drag=useRef<{id:number;node:string;element:HTMLButtonElement;offsetX:number;offsetY:number;startX:number;startY:number;moved:boolean}|null>(null);
 const linkPointer=useRef<{id:number;source:string}|null>(null);
 const suppressClick=useRef(false);
 const dragPaint=useRef<number|null>(null);
 const nodeEls=useRef<Map<string,HTMLButtonElement>>(new Map());
 const lineEls=useRef<Map<string,SVGPathElement>>(new Map());
 const lineHitEls=useRef<Map<string,SVGPathElement>>(new Map());
 const paintPositions=useRef<()=>void>(()=>{});
 const cameraRef=useRef(camera);
 cameraRef.current=camera;
 const graph=useMemo(()=>makeGraph(items,collections,connections,scope,query,page,suggestions),[items,collections,connections,scope,query,page,suggestions]);
 const edges=graph.edges;
 const focusNode=graph.nodes.find(n=>n.id===focus)||null;
 const active=edges.find(e=>e.id===activeEdge)||null;
 const neighbors=new Set(focus?[focus,...edges.filter(e=>e.source===focus||e.target===focus).flatMap(e=>[e.source,e.target])]:[]);
 const groupTitle=collections.find(c=>c.id===scope)?.name||(scope==="__unfiled"?"Sin clasificar":null);
 const shownCount=graph.nodes.reduce((sum,node)=>sum+node.count,0);
 // Keep layout motion out of React's render cycle. Updating 19+ images and SVG lines
 // through React on every pointer frame caused the visible Safari stutter.
 paintPositions.current=()=>{
  const points=positions.current;
  for(const [id,element] of nodeEls.current){
   const p=points.get(id);if(!p)continue;
   element.style.transform="translate3d("+p.x+"px,"+p.y+"px,0)";
  }
  for(const edge of edges){
   const a=points.get(edge.source),b=points.get(edge.target);
   if(!a||!b)continue;
   const d="M "+a.x+" "+a.y+" L "+b.x+" "+b.y;
   lineEls.current.get(edge.id)?.setAttribute("d",d);
   lineHitEls.current.get(edge.id)?.setAttribute("d",d);
  }
 };

 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const observer=new ResizeObserver(entries=>{const rect=entries[0]?.contentRect;if(!rect)return;setDims({width:rect.width,height:rect.height});});
  observer.observe(element);
  const rect=element.getBoundingClientRect();
  setCamera({x:rect.width/2,y:rect.height/2,zoom:1});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const handler=(event:WheelEvent)=>{
   event.preventDefault();const rect=el.getBoundingClientRect();const px=event.clientX-rect.left,py=event.clientY-rect.top;
   setCamera(old=>{const next=Math.max(.42,Math.min(2.1,old.zoom*Math.exp(-event.deltaY*.001)));const scale=next/old.zoom;return {x:px-(px-old.x)*scale,y:py-(py-old.y)*scale,zoom:next};});
  };
  el.addEventListener("wheel",handler,{passive:false});
  return()=>el.removeEventListener("wheel",handler);
 },[]);
 useEffect(()=>{setPage(0);setScope(null);setFocus(null);setActiveEdge(null);setConnectSource(null);setDraft(null);},[query]);
 useLayoutEffect(()=>{
  const old=positions.current;
  const next=new Map<string,Point>();
  graph.nodes.forEach((node,i)=>next.set(node.id,old.get(node.id)||initialPoint(node,i,graph.nodes.length)));
  positions.current=next;
  paintPositions.current();
 },[graph.nodes]);
 useEffect(()=>{
  if(graph.nodes.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  let raf=0;
  const animate=()=>{
   // While a node is in hand, the simulation must not move *any* node.
   // Let the pointer own every position update until release.
   if(drag.current){raf=requestAnimationFrame(animate);return;}
   const coords=positions.current;
   const ids=graph.nodes.map(n=>n.id);
   const forces=new Map<string,{x:number;y:number}>();
   for(const id of ids)forces.set(id,{x:0,y:0});
   for(let i=0;i<ids.length;i++){
    const a=coords.get(ids[i]);if(!a)continue;
    const fa=forces.get(ids[i])!;
    fa.x+=-a.x*.0011;fa.y+=-a.y*.0011;
    for(let j=i+1;j<ids.length;j++){
     const b=coords.get(ids[j]);if(!b)continue;
     const dx=a.x-b.x,dy=a.y-b.y,dd=dx*dx+dy*dy+80;
     const repulse=Math.min(8,5200/dd);
     const fx=dx*repulse/Math.sqrt(dd),fy=dy*repulse/Math.sqrt(dd);
     fa.x+=fx;fa.y+=fy;
     const fb=forces.get(ids[j])!;fb.x-=fx;fb.y-=fy;
    }
   }
   for(const edge of edges){
    const a=coords.get(edge.source),b=coords.get(edge.target);if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y;
    const d=Math.max(1,Math.hypot(dx,dy));
    const desired=edge.saved?185:230;
    const spring=(d-desired)*(edge.saved?.0037:.0016);
    const fx=dx/d*spring,fy=dy/d*spring;
    const fa=forces.get(edge.source)!,fb=forces.get(edge.target)!;
    fa.x+=fx;fa.y+=fy;fb.x-=fx;fb.y-=fy;
   }
   for(const id of ids){
    const p=coords.get(id),f=forces.get(id);if(!p||!f||p.dragging||(p.pinnedUntil&&performance.now()<p.pinnedUntil))continue;
    p.vx=Math.max(-3,Math.min(3,(p.vx+f.x)*.82));p.vy=Math.max(-3,Math.min(3,(p.vy+f.y)*.82));
    p.x=Math.max(-WIDTH/2,Math.min(WIDTH/2,p.x+p.vx));
    p.y=Math.max(-HEIGHT/2,Math.min(HEIGHT/2,p.y+p.vy));
   }
   paintPositions.current();
   raf=requestAnimationFrame(animate);
  };
  raf=requestAnimationFrame(animate);
  return()=>cancelAnimationFrame(raf);
 },[graph.nodes,edges]);
 useEffect(()=>{if(focus&&!graph.nodes.some(n=>n.id===focus))setFocus(null);if(activeEdge&&!edges.some(e=>e.id===activeEdge))setActiveEdge(null);},[graph.nodes,edges,focus,activeEdge]);
 const reset=()=>{setCamera({x:dims.width/2,y:dims.height/2,zoom:1});setFocus(null);setActiveEdge(null);};
 const worldAt=(clientX:number,clientY:number)=>{
  const rect=canvas.current?.getBoundingClientRect();
  const c=cameraRef.current;
  return {x:(clientX-(rect?.left||0)-c.x)/c.zoom,y:(clientY-(rect?.top||0)-c.y)/c.zoom};
 };
 const openEdge=(edge:Edge)=>{
  setActiveEdge(edge.id);setFocus(null);setDraft(null);setConnectMode(false);setConnectSource(null);
  setRelation(edge.saved?edge.relation:"comparte tema");
  setExplanation(edge.saved?edge.explanation:"");
  setActionError("");
 };
 const prepareConnection=(source:string,target:string)=>{
  if(source===target)return;
  const linked=edges.find(e=>e.saved&&((e.source===source&&e.target===target)||(e.target===source&&e.source===target)));
  if(linked){openEdge(linked);return;}
  setDraft({source,target});setActiveEdge(null);setFocus(null);setConnectMode(false);setConnectSource(null);
  setRelation("inspira");setExplanation("");setActionError("");
 };
 const saveConnection=async()=>{
  const pair=draft||(!draft&&active?{source:active.source,target:active.target}:null);
  if(!pair||saving)return;
  const editing=active?.saved&&!draft;
  setSaving(true);setActionError("");
  try{
   const response=await fetch("/api/references",{
    method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(editing?{action:"connection",id:active?.id,relation,explanation}:{action:"connection",source_id:pair.source,target_id:pair.target,relation,explanation})
   });
   const json=await response.json();if(!response.ok)throw new Error(json.error||"No se pudo guardar la conexión.");
   setDraft(null);setActiveEdge(null);setConnectSource(null);await onRefresh();
  }catch(error){setActionError(error instanceof Error?error.message:"Error al guardar.");}
  finally{setSaving(false);}
 };
 const removeConnection=async()=>{
  if(!active?.saved||saving||!window.confirm("¿Eliminar esta conexión?"))return;
  setSaving(true);setActionError("");
  try{
   const response=await fetch("/api/references?type=connection&id="+encodeURIComponent(active.id),{method:"DELETE"});
   const json=await response.json();if(!response.ok)throw new Error(json.error||"No se pudo eliminar.");
   setActiveEdge(null);await onRefresh();
  }catch(error){setActionError(error instanceof Error?error.message:"Error al eliminar.");}
  finally{setSaving(false);}
 };
 const zoom=(factor:number,px=dims.width/2,py=dims.height/2)=>{
  setCamera(old=>{const next=Math.max(.42,Math.min(2.1,old.zoom*factor));const scale=next/old.zoom;return {x:px-(px-old.x)*scale,y:py-(py-old.y)*scale,zoom:next};});
 };
 const onDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||(event.target instanceof Element&&event.target.closest(".rlg-node,.rlg-line-hit,.rlg-panel,.rlg-controls,.rlg-top,.rlg-mode-note,.rlg-hint")))return;
  // A click on empty canvas clears selection, but does not dismiss a connection draft being edited.
  setFocus(null);setActiveEdge(null);setConnectSource(null);
  pan.current={id:event.pointerId,x:event.clientX,y:event.clientY,camX:cameraRef.current.x,camY:cameraRef.current.y};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const onMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const p=pan.current;if(!p||p.id!==event.pointerId)return;
  setCamera(c=>({...c,x:p.camX+event.clientX-p.x,y:p.camY+event.clientY-p.y}));
 };
 const onUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(pan.current?.id===event.pointerId)pan.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 // Pointer listeners live on window rather than on the moving node.
 // Safari can send uneven pointer coordinates if a transformed element captures its own pointer.
 useEffect(()=>{
  const paint=()=>{
   if(dragPaint.current!==null)return;
   dragPaint.current=requestAnimationFrame(()=>{dragPaint.current=null;paintPositions.current();});
  };
  const move=(event:PointerEvent)=>{
   const d=drag.current;if(!d||d.id!==event.pointerId)return;
   if(Math.hypot(event.clientX-d.startX,event.clientY-d.startY)>3)d.moved=true;
   if(!d.moved)return;
   const rect=canvas.current?.getBoundingClientRect();
   if(!rect)return;
   const c=cameraRef.current;
   const p=positions.current.get(d.node);
   if(!p)return;
   const x=(event.clientX-rect.left-c.x)/c.zoom-d.offsetX;
   const y=(event.clientY-rect.top-c.y)/c.zoom-d.offsetY;
   // The cursor gives an absolute position, not incremental changes from a moving DOM target.
   p.x=x;p.y=y;p.vx=0;p.vy=0;
   paint();
  };
  const release=(event:PointerEvent)=>{
   const d=drag.current;if(!d||d.id!==event.pointerId)return;
   const p=positions.current.get(d.node);
   if(p){p.dragging=false;p.vx=0;p.vy=0;p.pinnedUntil=performance.now()+900;}
   d.element.classList.remove("is-dragging");
   drag.current=null;
   suppressClick.current=d.moved;
   // Browser click (if any) is dispatched after pointerup; do not suppress a future click.
   requestAnimationFrame(()=>{suppressClick.current=false;});
   paint();
  };
  window.addEventListener("pointermove",move,{passive:true});
  window.addEventListener("pointerup",release);
  window.addEventListener("pointercancel",release);
  return()=>{
   window.removeEventListener("pointermove",move);
   window.removeEventListener("pointerup",release);
   window.removeEventListener("pointercancel",release);
   if(dragPaint.current!==null)cancelAnimationFrame(dragPaint.current);
   dragPaint.current=null;
  };
 },[]);
 const nodeDown=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{
  if(event.button!==0)return;
  event.stopPropagation();
  const point=worldAt(event.clientX,event.clientY);
  const p=positions.current.get(id);if(!p)return;
  drag.current={id:event.pointerId,node:id,element:event.currentTarget,offsetX:point.x-p.x,offsetY:point.y-p.y,startX:event.clientX,startY:event.clientY,moved:false};
  event.currentTarget.classList.add("is-dragging");
  p.dragging=true;p.vx=0;p.vy=0;
 };
 const linkStart=(event:ReactPointerEvent<HTMLSpanElement>,source:string)=>{
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const point=worldAt(event.clientX,event.clientY);
  linkPointer.current={id:event.pointerId,source};
  setLinkDrag({source,x:point.x,y:point.y});
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const linkMove=(event:ReactPointerEvent<HTMLSpanElement>)=>{
  if(linkPointer.current?.id!==event.pointerId)return;
  event.stopPropagation();
  const point=worldAt(event.clientX,event.clientY);
  setLinkDrag({source:linkPointer.current.source,x:point.x,y:point.y});
 };
 const linkEnd=(event:ReactPointerEvent<HTMLSpanElement>)=>{
  const lp=linkPointer.current;if(!lp||lp.id!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();
  const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-graph-node]");
  const target=destination?.dataset.graphNode;
  if(target&&target!==lp.source&&graph.nodes.some(n=>n.id===target&&!n.cluster))prepareConnection(lp.source,target);
  else{setConnectMode(true);setConnectSource(lp.source);setFocus(lp.source);}
  setLinkDrag(null);linkPointer.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const choose=(node:Node)=>{
  if(suppressClick.current){suppressClick.current=false;return;}
  if(node.cluster){setScope(node.group);setPage(0);setFocus(null);setActiveEdge(null);setConnectSource(null);reset();return;}
  if(connectMode){
   if(!connectSource){setConnectSource(node.id);setFocus(node.id);setActiveEdge(null);return;}
   if(connectSource===node.id){setConnectSource(null);setFocus(null);return;}
   prepareConnection(connectSource,node.id);return;
  }
  setFocus(node.id);setActiveEdge(null);
 };
 const pos=(id:string)=>positions.current.get(id)||{x:0,y:0};
 return <div className="rlg">
  <div className="rlg-canvas" ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Mapa interactivo de referencias">
   <div className="rlg-grid"/>
   <div className="rlg-top">
    <div className="rlg-title"><span className="rlg-led"/><strong>{groupTitle?"Explorando "+groupTitle:"Mapa de conexiones"}</strong><span>{shownCount} referencias · {edges.filter(e=>e.saved).length} enlaces confirmados</span></div>
    <div className="rlg-actions">
     {scope&&<button onClick={()=>{setScope(null);setPage(0);reset();}}><ArrowLeft size={14}/> Todos los grupos</button>}
     <button className={connectMode?"rlg-toggled rlg-connect-active":"rlg-connect-button"} onClick={()=>{setConnectMode(v=>!v);setConnectSource(null);setActiveEdge(null);setDraft(null);setFocus(null);}}><GitBranch size={14}/> {connectMode?"Selecciona origen":"Conectar nodos"}</button>
     <button className={suggestions?"rlg-toggled":""} onClick={()=>setSuggestions(v=>!v)} title="Mostrar u ocultar afinidades calculadas con etiquetas"><Sparkles size={14}/> Afinidades {suggestions?"ON":"OFF"}</button>
    </div>
   </div>
   {connectMode&&<div className="rlg-mode-note">{connectSource?"Ahora selecciona la referencia de destino.":"Selecciona el primer nodo para conectarlo con otro."}<button onClick={()=>{setConnectMode(false);setConnectSource(null);setFocus(null);}}>Cancelar</button></div>}
   <div className="rlg-stage" style={{transform:"translate("+camera.x+"px,"+camera.y+"px) scale("+camera.zoom+")"}}>
    <svg className="rlg-wires" width={WIDTH} height={HEIGHT} viewBox={"-"+WIDTH/2+" -"+HEIGHT/2+" "+WIDTH+" "+HEIGHT} aria-hidden="true">
     {edges.map(e=>{
      const a=pos(e.source),b=pos(e.target);
      const emphasized=focus?e.source===focus||e.target===focus:true;
      const chosen=activeEdge===e.id;
      const d="M "+a.x+" "+a.y+" L "+b.x+" "+b.y;
      return <g key={e.id} className={"rlg-wire "+(e.saved?"is-saved":"is-proposed")+(emphasized?" is-visible":" is-muted")+(chosen?" is-chosen":"")}>
       <path ref={el=>{if(el)lineEls.current.set(e.id,el);else lineEls.current.delete(e.id);}} className="rlg-line" d={d}/>
       <path ref={el=>{if(el)lineHitEls.current.set(e.id,el);else lineHitEls.current.delete(e.id);}} className="rlg-line-hit" d={d} onPointerDown={event=>event.stopPropagation()} onClick={()=>openEdge(e)}><title>{e.relation}</title></path>
      </g>;
     })}
     {linkDrag&&<path className="rlg-draft-line" d={"M "+pos(linkDrag.source).x+" "+pos(linkDrag.source).y+" L "+linkDrag.x+" "+linkDrag.y}/>}
    </svg>
    {graph.nodes.map(node=>{
     const p=pos(node.id),selected=focus===node.id||connectSource===node.id,muted=Boolean(focus&&!neighbors.has(node.id));
     return <button key={node.id} ref={el=>{if(el)nodeEls.current.set(node.id,el);else nodeEls.current.delete(node.id);}} type="button" data-graph-node={node.id} className={"rlg-node "+(node.cluster?"is-cluster ":"")+(selected?"is-selected ":"")+(muted?"is-dimmed":"")} style={{transform:"translate3d("+p.x+"px,"+p.y+"px,0)"}} onPointerDown={e=>nodeDown(e,node.id)} onClick={()=>choose(node)} onDoubleClick={()=>{if(!node.cluster)onOpen(node.id);}} aria-label={(node.cluster?"Abrir colección ":"Seleccionar referencia ")+node.title}>
      <span className="rlg-orb">{node.cluster?<><Layers3 size={23}/><span className="rlg-count">{node.count}</span></>:node.image?<img draggable={false} src={node.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none";}}/>:<span className="rlg-placeholder"><GitBranch size={22}/></span>}</span>
      {!node.cluster&&(selected||connectMode)&&<span className="rlg-node-handle" title="Arrastra hasta otra referencia para conectarlas" onPointerDown={event=>linkStart(event,node.id)} onPointerMove={linkMove} onPointerUp={linkEnd} onPointerCancel={linkEnd} onClick={event=>event.stopPropagation()}><Plus size={15}/></span>}
      <span className="rlg-node-name">{node.title}</span>
      {node.cluster&&<span className="rlg-cluster-caption">ABRIR GRUPO</span>}
     </button>;
    })}
   </div>
   <div className="rlg-controls">
    <button title="Acercar" aria-label="Acercar" onClick={()=>zoom(1.2)}><Plus size={18}/></button>
    <button title="Alejar" aria-label="Alejar" onClick={()=>zoom(1/1.2)}><Minus size={18}/></button>
    <button title="Centrar mapa" aria-label="Centrar mapa" onClick={reset}><Maximize2 size={17}/></button>
   </div>
   {focusNode&&!focusNode.cluster&&<aside className="rlg-panel">
    <button className="rlg-close" onClick={()=>setFocus(null)} aria-label="Cerrar selección"><X size={16}/></button>
    <div className="rlg-panel-eyebrow">REFERENCIA SELECCIONADA</div>
    <h3>{focusNode.title}</h3><small>{focusNode.collection}</small>
    <div className="rlg-panel-divider"/>
    <span className="rlg-panel-eyebrow">SUS RELACIONES</span>
    <div className="rlg-relations">
     {edges.filter(e=>e.source===focus||e.target===focus).slice(0,8).map(e=>{
      const other=graph.nodes.find(n=>n.id===(e.source===focus?e.target:e.source));
      return <button key={e.id} onClick={()=>{setActiveEdge(e.id);setFocus(null);}}><span className={e.saved?"rlg-linkdot saved":"rlg-linkdot"}/><span><strong>{other?.title||"Referencia"}</strong><small>{e.saved?e.relation:"Afinidad sugerida"}</small></span><ArrowUpRight size={14}/></button>;
     })}
     {!edges.some(e=>e.source===focus||e.target===focus)&&<p>Sin relaciones visibles. Puedes crearlas desde el detalle.</p>}
    </div>
    <button className="rlg-secondary" onClick={()=>{setConnectMode(true);setConnectSource(focusNode.id);}}>Conectar con otra referencia <GitBranch size={14}/></button>
    <button className="rlg-primary" onClick={()=>onOpen(focusNode.id)}>Abrir referencia <ArrowUpRight size={15}/></button>
   </aside>}
   {(active||draft)&&<aside className="rlg-panel rlg-editor" onPointerDown={event=>event.stopPropagation()}>
    <button className="rlg-close" onClick={()=>{setActiveEdge(null);setDraft(null);setActionError("");}} aria-label="Cerrar conexión"><X size={16}/></button>
    <div className="rlg-panel-eyebrow">{draft?"NUEVA CONEXIÓN":active?.saved?"EDITAR CONEXIÓN":"CONFIRMAR AFINIDAD"}</div>
    <h3>{graph.nodes.find(n=>n.id===(draft?.source||active?.source))?.title||"Origen"}</h3>
    <div className="rlg-edge-relation"><GitBranch size={14}/> conectado con</div>
    <h3>{graph.nodes.find(n=>n.id===(draft?.target||active?.target))?.title||"Destino"}</h3>
    <label className="rlg-form-label" htmlFor="rlg-relation">TIPO DE RELACIÓN</label>
    <select id="rlg-relation" className="rlg-form-input" value={relation} onChange={event=>setRelation(event.target.value)}>
     <option value="inspira">Inspira</option><option value="comparte tema">Comparte tema</option><option value="misma estética">Misma estética</option><option value="comparte lenguaje visual">Comparte lenguaje visual</option><option value="desarrolla">Desarrolla</option><option value="contradice">Contradice</option><option value="conecta con">Conecta con</option>
     {!["inspira","comparte tema","misma estética","comparte lenguaje visual","desarrolla","contradice","conecta con"].includes(relation)&&<option value={relation}>{relation}</option>}
    </select>
    <label className="rlg-form-label" htmlFor="rlg-explanation">POR QUÉ SE CONECTAN</label>
    <textarea id="rlg-explanation" className="rlg-form-input" rows={3} maxLength={500} placeholder="Opcional: explica la relación entre estas ideas…" value={explanation} onChange={event=>setExplanation(event.target.value)}/>
    {active&&!active.saved&&<p className="rlg-suggestion-note">{active.explanation}</p>}
    {actionError&&<p className="rlg-action-error" role="alert">{actionError}</p>}
    <button disabled={saving} className="rlg-primary" onClick={saveConnection}>{saving?"Guardando…":active?.saved&&!draft?"Guardar cambios":"Guardar conexión"} <Check size={15}/></button>
    {active?.saved&&!draft&&<button disabled={saving} className="rlg-delete-link" onClick={removeConnection}><Trash2 size={14}/> Eliminar conexión</button>}
   </aside>}
   {!items.length&&<div className="rlg-empty"><GitBranch size={26}/><strong>El mapa espera sus primeras referencias.</strong><span>Añade referencias para empezar a descubrir conexiones.</span></div>}
   {items.length>0&&!graph.nodes.length&&<div className="rlg-empty"><GitBranch size={25}/><strong>Sin coincidencias.</strong><span>Prueba otra búsqueda.</span></div>}
   <div className="rlg-hint"><span className="rlg-line-legend"/> Guardada <span className="rlg-line-legend proposed"/> Afinidad sugerida <span className="rlg-hint-desktop"> · Arrastra para mover · Usa el + para enlazar · Doble clic para abrir</span></div>
  </div>
  <div className="rlg-bottom">
   <span>{graph.collapsing?"Vista agrupada para evitar saturación. Haz clic en un grupo para explorarlo.":query?"Resultados filtrados en tu biblioteca.":"Las líneas discontinuas son sugerencias, no se guardan automáticamente."}</span>
   {graph.total>PAGE_SIZE&&!graph.collapsing&&<div className="rlg-pagination"><button disabled={page===0} onClick={()=>{setPage(p=>Math.max(0,p-1));setFocus(null);reset();}}><ArrowLeft size={14}/></button><span>{page*PAGE_SIZE+1}–{Math.min(graph.total,(page+1)*PAGE_SIZE)} de {graph.total}</span><button disabled={(page+1)*PAGE_SIZE>=graph.total} onClick={()=>{setPage(p=>p+1);setFocus(null);reset();}}>Siguiente <ArrowUpRight size={14}/></button></div>}
   <span className="rlg-bottom-icon"><RotateCcw size={13}/> Física local · Sin costes de IA</span>
  </div>
 </div>;
}
