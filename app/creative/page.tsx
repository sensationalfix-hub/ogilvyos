"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CirclePlus, GitBranch, Lightbulb, Link2, Loader2, GripVertical, Plus, Save, Trash2, X, MoveDiagonal2, Hand, MousePointer2, CheckSquare2 } from "lucide-react";

type Kind="insight"|"concepto"|"racional"|"referencia"|"ejecucion";
type Node={id:string;kind:Kind;title:string;body:string;x:number;y:number;url?:string;width?:number;height?:number};
type Port="top"|"right"|"bottom"|"left";
type Edge={id:string;source:string;target:string;label:string;sourcePort?:Port;targetPort?:Port};
type ProjectOption={id:string;name:string;account?:string};
const PORTS:Port[]=["top","right","bottom","left"];
const PWIDTH=246,PHEIGHT=160;
const MIN_WIDTH=220,MAX_WIDTH=700,MIN_HEIGHT=150,MAX_HEIGHT=650;
const dimensions=(n:Node)=>({width:n.width??PWIDTH,height:n.height??PHEIGHT});
const anchor=(n:Node,p:Port)=>{const {width,height}=dimensions(n);return {x:n.x+(p==="left"?0:p==="right"?width:width/2),y:n.y+(p==="top"?0:p==="bottom"?height:height/2)};};
const curveGeometry=(a:{x:number;y:number},b:{x:number;y:number},from:Port="right",to:Port="left")=>{
 const d=Math.max(50,Math.hypot(a.x-b.x,a.y-b.y)*.35);
 const off=(p:Port):[number,number]=>p==="left"?[-d,0]:p==="right"?[d,0]:p==="top"?[0,-d]:[0,d];
 const [ax,ay]=off(from),[bx,by]=off(to);
 const cp1={x:a.x+ax,y:a.y+ay},cp2={x:b.x+bx,y:b.y+by};
 // The label sits on the actual cubic Bézier, not the average of its endpoints.
 const mid={x:(a.x+3*cp1.x+3*cp2.x+b.x)/8,y:(a.y+3*cp1.y+3*cp2.y+b.y)/8};
 return {path:`M${a.x} ${a.y} C${cp1.x} ${cp1.y},${cp2.x} ${cp2.y},${b.x} ${b.y}`,mid};
};
const curve=(a:{x:number;y:number},b:{x:number;y:number},from:Port="right",to:Port="left")=>curveGeometry(a,b,from,to).path;
type Board={id:string;title:string;project_id:string|null;nodes:Node[];edges:Edge[];updated_at:string};
const types: {key:Kind;name:string;color:string}[]=[
 {key:"insight",name:"Insight",color:"#ddedff"},
 {key:"concepto",name:"Concepto",color:"#f4e9b2"},
 {key:"racional",name:"Racional",color:"#eae4fd"},
 {key:"referencia",name:"Referencia",color:"#d7ede4"},
 {key:"ejecucion",name:"Ejecución",color:"#f9e0d7"},
];
const typeOf=(k:Kind)=>types.find(t=>t.key===k)||types[0];
function mediaPreview(raw?:string):{src:string;kind:"video"|"image"}|null{
 if(!raw)return null;
 try{
  const u=new URL(raw);
  if(!["https:","http:"].includes(u.protocol))return null;
  const host=u.hostname.toLowerCase().replace(/^www\./,"");
  let videoId="";
  if(host==="youtu.be")videoId=u.pathname.split("/")[1]||"";
  else if(["youtube.com","m.youtube.com","youtube-nocookie.com"].includes(host)){
   videoId=u.searchParams.get("v")||"";
   if(!videoId)videoId=u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]||"";
  }
  if(/^[a-zA-Z0-9_-]{11}$/.test(videoId))return {src:"https://img.youtube.com/vi/"+videoId+"/hqdefault.jpg",kind:"video"};
  if(/\.(?:png|jpe?g|webp|gif|avif)(?:$)/i.test(u.pathname))return {src:u.href,kind:"image"};
 }catch{}
 return null;
}
type RichPreview={image:string;title:string;site:string;kind:"video"|"image"|"audio"};
const richPreviewCache=new Map<string,RichPreview|null>();
function ReferencePreview({url,title}:{url?:string;title:string}){
 const direct=mediaPreview(url);
 const directSrc=direct?.src;
 const [rich,setRich]=useState<RichPreview|null>(null);
 const [broken,setBroken]=useState(false);
 useEffect(()=>{
  setBroken(false);
  setRich(null);
  if(!url||directSrc)return;
  const existing=richPreviewCache.get(url);
  if(existing!==undefined){setRich(existing);return;}
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   fetch("/api/creative/preview?url="+encodeURIComponent(url),{signal:controller.signal,cache:"default"})
    .then(async response=>{if(!response.ok)throw new Error("Preview no disponible");return response.json() as Promise<{preview:RichPreview|null}>})
    .then(data=>{if(!controller.signal.aborted){richPreviewCache.set(url,data.preview||null);setRich(data.preview||null);}})
    .catch(()=>{if(!controller.signal.aborted){richPreviewCache.set(url,null);}});
  },450);
  return()=>{window.clearTimeout(timer);controller.abort()};
 },[url,directSrc]);
 const src=directSrc||rich?.image;
 if(!url||!src||broken)return null;
 const kind=direct?.kind||rich?.kind||"image";
 const site=directSrc?(kind==="video"?"YouTube":"Imagen"):rich?.site||"Referencia";
 const description=rich?.title||title;
 return <div className="cl-media-cover" aria-label={"Vista previa de "+title}>
  <img className="cl-media-image" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>
  <div className="cl-media-veil" aria-hidden="true"/>
  <a className="cl-media-source" href={url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={"Abrir "+description}>
   <span>{site}</span><ArrowRight aria-hidden="true" size={12}/>
  </a>
  {(kind==="video"||kind==="audio")&&<a className={"cl-media-play"+(kind==="audio"?" cl-media-audio":"")} href={url} target="_blank" rel="noopener noreferrer" aria-label={(kind==="audio"?"Escuchar en Spotify: ":"Ver vídeo: ")+title} onClick={e=>e.stopPropagation()}>
   <span aria-hidden="true">▶</span>
  </a>}
 </div>;
}
const id=()=>crypto.randomUUID();
const startNodes:Node[]=[
 {id:"a",kind:"insight",title:"Una verdad de partida",body:"¿Qué tensión humana o cultural sostiene esta campaña?",x:80,y:110},
 {id:"b",kind:"concepto",title:"Territorio creativo",body:"¿Y si le damos la vuelta a esa verdad?",x:420,y:95},
 {id:"c",kind:"racional",title:"El porqué de la idea",body:"Desarrolla aquí el argumento y su conexión con el insight.",x:420,y:365},
];
const startEdges:Edge[]=[{id:"demo-edge",source:"a",target:"b",label:"inspira"},{id:"demo-edge-2",source:"b",target:"c",label:"se sostiene en"}];
export default function CreativeLab(){
 const [boards,setBoards]=useState<Board[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [saved,setSaved]=useState(true);
 const [selected,setSelected]=useState<string|null>(null);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [tool,setTool]=useState<"hand"|"select">("hand");
 const [cmdHeld,setCmdHeld]=useState(false);
 const currentTool=cmdHeld?"select":tool;
 const [marquee,setMarquee]=useState<{x0:number;y0:number;x1:number;y1:number}|null>(null);
 const marqueeRef=useRef<{pointerId:number;x0:number;y0:number;x1:number;y1:number;add:boolean}|null>(null);
 const skipCanvasClickUntil=useRef(0);
 const [workspaceSize,setWorkspaceSize]=useState({width:1000,height:800});
 const [connecting,setConnecting]=useState<string|null>(null);
 const [sourcePort,setSourcePort]=useState<Port>("right");
 const [wireEnd,setWireEnd]=useState<{x:number;y:number}|null>(null);
 const [projects,setProjects]=useState<ProjectOption[]>([]);
 const [projectError,setProjectError]=useState("");
 const canvasRef=useRef<HTMLDivElement>(null);
 const wireDrag=useRef(false);
 const [edgeSelected,setEdgeSelected]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1);
 const [pan,setPan]=useState({x:120,y:80});
 const [panning,setPanning]=useState(false);
 const panDrag=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
 const workspaceRef=useRef<HTMLDivElement>(null);
 const zoomRef=useRef(zoom);zoomRef.current=zoom;
 const panRef=useRef(pan);panRef.current=pan;
 const navigableRef=useRef(false);
 const [showBoards,setShowBoards]=useState(true);
 const drag=useRef<{id:string;pointerId:number;clientX:number;clientY:number;startPositions:{id:string;x:number;y:number}[];moved:boolean}|null>(null);
 const [draggingId,setDraggingId]=useState<string|null>(null);
 const resize=useRef<{id:string;pointerId:number;clientX:number;clientY:number;startWidth:number;startHeight:number;moved:boolean}|null>(null);
 const [resizingId,setResizingId]=useState<string|null>(null);
 const ignoreCardClickUntil=useRef(0);
 const board=boards.find(b=>b.id===activeId);
 navigableRef.current=!!board&&!showBoards;
 const boardRef=useRef(board);boardRef.current=board;
 const latestRef=useRef(boards);latestRef.current=boards;
 const seq=useRef(0);const loaded=useRef(false);
 const selectedNode=selectedIds.length<=1?board?.nodes.find(n=>n.id===selected):undefined;
 const marqueeIds=marquee&&board?board.nodes.filter(n=>{
  const x=n.x*zoom+pan.x,y=n.y*zoom+pan.y,{width,height}=dimensions(n);
  return x+width*zoom>=Math.min(marquee.x0,marquee.x1)&&x<=Math.max(marquee.x0,marquee.x1)&&y+height*zoom>=Math.min(marquee.y0,marquee.y1)&&y<=Math.max(marquee.y0,marquee.y1);
 }).map(n=>n.id):[];
 const visibleWorld={left:-pan.x/zoom-180,top:-pan.y/zoom-180,width:workspaceSize.width/zoom+360,height:workspaceSize.height/zoom+360};
 const selectedEdge=board?.edges.find(e=>e.id===edgeSelected);
 const update=useCallback((change:(b:Board)=>Board)=>{
  setBoards(prev=>prev.map(b=>b.id===activeId?change(b):b));setSaved(false);seq.current++;
 },[activeId]);
 const refresh=useCallback(async()=>{
  try{const r=await fetch("/api/creative",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron cargar los mapas");
   setBoards(d.boards||[]);setActiveId(v=>v&&d.boards.some((b:Board)=>b.id===v)?v:d.boards[0]?.id||null);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Error de conexión");}
  finally{setLoading(false);loaded.current=true;}
 },[]);
 useEffect(()=>{refresh()},[refresh]);
 useEffect(()=>{let mounted=true;fetch("/api/notion/state",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("No se pudieron cargar los proyectos");return r.json()}).then(data=>{if(mounted)setProjects(Array.isArray(data.projects)?data.projects:[])}).catch(()=>{if(mounted)setProjectError("No se pudieron cargar los proyectos")});return()=>{mounted=false}},[]);
 useEffect(()=>{
  if(!loaded.current||!board||saved)return;
  const version=seq.current;
  const handle=setTimeout(async()=>{
   setSaving(true);
   try{const r=await fetch("/api/creative",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:board.id,title:board.title,project_id:board.project_id,nodes:board.nodes,edges:board.edges})});
    if(!r.ok)throw new Error((await r.json()).error||"Error de guardado");
    if(version===seq.current){setSaved(true);setError("");}
   }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}
   finally{setSaving(false);}
  },700);
  return()=>clearTimeout(handle);
 },[board,saved]);
 const createBoard=async()=>{
  try{const r=await fetch("/api/creative",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Nuevo mapa creativo"})});const d=await r.json();if(!r.ok)throw new Error(d.error);
   setBoards(p=>[d.board,...p]);setActiveId(d.board.id);setShowBoards(false);setSelected(null);setSelectedIds([]);setEdgeSelected(null);setSaved(true);
  }catch(e){setError(String(e));}
 };
 const deleteBoard=async()=>{
  if(!board||!window.confirm("¿Eliminar este mapa y todas sus ideas?"))return;
  const r=await fetch("/api/creative?id="+board.id,{method:"DELETE"});if(!r.ok){setError("No se pudo eliminar");return}
  const rest=boards.filter(b=>b.id!==board.id);setBoards(rest);setActiveId(rest[0]?.id||null);setSelected(null);setSelectedIds([]);
 };
 const addNode=(kind:Kind)=>{
  if(!board)return;
  const node:Node={id:id(),kind,title:typeOf(kind).name+" sin título",body:"",x:Math.round(((workspaceSize.width*.5-pan.x)/zoom+(Math.random()-.5)*120)/20)*20,y:Math.round(((workspaceSize.height*.4-pan.y)/zoom+(Math.random()-.5)*100)/20)*20};
  update(b=>({...b,nodes:[...b.nodes,node]}));setSelected(node.id);setSelectedIds([node.id]);setEdgeSelected(null);setShowBoards(false);
 };
 const onNodeClick=(nodeId:string,e:React.MouseEvent)=>{
  if(Date.now()<ignoreCardClickUntil.current)return;
  if(connecting){
   if(connecting!==nodeId&&!board?.edges.some(edge=>edge.source===connecting&&edge.target===nodeId))
    update(b=>({...b,edges:[...b.edges,{id:id(),source:connecting,target:nodeId,label:"relaciona",sourcePort,targetPort:"left"}]}));
   setConnecting(null);setWireEnd(null);wireDrag.current=false;return;
  }
  if(currentTool==="select"||e.shiftKey){
   setSelected(null);setEdgeSelected(null);
   setSelectedIds(ids=>ids.includes(nodeId)?ids.filter(id=>id!==nodeId):[...ids,nodeId]);
   return;
  }
  setSelectedIds([nodeId]);setSelected(nodeId);setEdgeSelected(null);
 };
 const selectAll=()=>{if(!board)return;setSelectedIds(board.nodes.map(n=>n.id));setSelected(null);setEdgeSelected(null)};
 const clearSelection=()=>{setSelectedIds([]);setSelected(null);setEdgeSelected(null)};
 const deleteNode=()=>{if(!selected)return;update(b=>({...b,nodes:b.nodes.filter(n=>n.id!==selected),edges:b.edges.filter(e=>e.source!==selected&&e.target!==selected)}));clearSelection()};
 const nodeChange=(field:"title"|"body"|"url",value:string)=>{if(selected)update(b=>({...b,nodes:b.nodes.map(n=>n.id===selected?{...n,[field]:value}:n)}))};
 const world=(event:React.PointerEvent)=>{const r=canvasRef.current?.getBoundingClientRect();return {x:r?(event.clientX-r.left)/zoom:0,y:r?(event.clientY-r.top)/zoom:0}};
 const beginWire=(e:React.PointerEvent<HTMLButtonElement>,source:string,port:Port)=>{e.preventDefault();e.stopPropagation();setConnecting(source);setSourcePort(port);setWireEnd(world(e));wireDrag.current=true;e.currentTarget.setPointerCapture(e.pointerId);setSelected(null);setEdgeSelected(null)};
 const endWire=(e:React.PointerEvent)=>{if(!wireDrag.current||!connecting)return;const p=world(e);const target=boardRef.current?.nodes.find(n=>{const {width,height}=dimensions(n);return n.id!==connecting&&p.x>=n.x-18&&p.x<=n.x+width+18&&p.y>=n.y-18&&p.y<=n.y+height+18;});
 if(target){const {width,height}=dimensions(target);const ds:Record<Port,number>={top:Math.abs(p.y-target.y),right:Math.abs(p.x-target.x-width),bottom:Math.abs(p.y-target.y-height),left:Math.abs(p.x-target.x)};const targetPort=PORTS.reduce((a,b)=>ds[a]<ds[b]?a:b);update(b=>({...b,edges:[...b.edges,{id:id(),source:connecting,target:target.id,label:"relaciona",sourcePort,targetPort}]}));}
 setConnecting(null);setWireEnd(null);wireDrag.current=false;};
 const beginCardDrag=(event:React.PointerEvent<HTMLDivElement>,node:Node)=>{
  if(event.button!==0||connecting||wireDrag.current)return;
  if((event.target as Element).closest("a,button,input,textarea,select,[data-no-card-drag]"))return;
  const group=selectedIds.length>1&&selectedIds.includes(node.id)?selectedIds:[node.id];
  const startPositions=(board?.nodes||[]).filter(n=>group.includes(n.id)).map(n=>({id:n.id,x:n.x,y:n.y}));
  drag.current={id:node.id,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,startPositions,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  event.stopPropagation();
 };
 const finishCardDrag=(event?:React.PointerEvent)=>{
  const item=drag.current;
  if(!item||event&&item.pointerId!==event.pointerId)return;
  if(item.moved)ignoreCardClickUntil.current=Date.now()+180;
  drag.current=null;
  setDraggingId(null);
 };
 const beginResize=(event:React.PointerEvent<HTMLButtonElement>,node:Node)=>{
  if(event.button!==0||wireDrag.current||connecting)return;
  event.preventDefault();event.stopPropagation();
  const {width,height}=dimensions(node);
  resize.current={id:node.id,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,startWidth:width,startHeight:height,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  setResizingId(node.id);setSelected(node.id);setEdgeSelected(null);
 };
 const finishResize=(event?:React.PointerEvent)=>{
  const active=resize.current;if(!active||event&&active.pointerId!==event.pointerId)return;
  if(active.moved)ignoreCardClickUntil.current=Date.now()+180;
  resize.current=null;setResizingId(null);
 };
 const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  const activeResize=resize.current;
  if(activeResize&&activeResize.pointerId===event.pointerId){
   const dx=(event.clientX-activeResize.clientX)/zoom;
   const dy=(event.clientY-activeResize.clientY)/zoom;
   if(!activeResize.moved&&Math.hypot(dx,dy)>2)activeResize.moved=true;
   if(activeResize.moved){
    const width=Math.max(MIN_WIDTH,Math.min(MAX_WIDTH,Math.round((activeResize.startWidth+dx)/2)*2));
    const height=Math.max(MIN_HEIGHT,Math.min(MAX_HEIGHT,Math.round((activeResize.startHeight+dy)/2)*2));
    update(b=>({...b,nodes:b.nodes.map(n=>n.id===activeResize.id?{...n,width,height}:n)}));
   }
   return;
  }
  if(marqueeRef.current&&event.pointerId===marqueeRef.current.pointerId){
   const r=workspaceRef.current?.getBoundingClientRect();if(!r)return;
   marqueeRef.current.x1=event.clientX-r.left;marqueeRef.current.y1=event.clientY-r.top;
   setMarquee({x0:marqueeRef.current.x0,y0:marqueeRef.current.y0,x1:marqueeRef.current.x1,y1:marqueeRef.current.y1});return;
  }
  if(panDrag.current){const d=panDrag.current;setPan({x:d.startX+event.clientX-d.x,y:d.startY+event.clientY-d.y});return;}
  if(wireDrag.current){setWireEnd(world(event));return;}
  const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;
  const dx=(event.clientX-d.clientX)/zoom,dy=(event.clientY-d.clientY)/zoom;
  if(!d.moved&&Math.hypot(event.clientX-d.clientX,event.clientY-d.clientY)<4)return;
  if(!d.moved){d.moved=true;setDraggingId(d.id);setSelectedIds(d.startPositions.map(p=>p.id));if(d.startPositions.length>1)setSelected(null);}
  const initial=new Map(d.startPositions.map(p=>[p.id,p]));
  update(b=>({...b,nodes:b.nodes.map(n=>{
   const p=initial.get(n.id);
   return p?{...n,x:Math.round(p.x+dx),y:Math.round(p.y+dy)}:n;
  })}));
 };
 useEffect(()=>{
  const el=workspaceRef.current;if(!el)return;
  const handle=(e:WheelEvent)=>{
   if(!navigableRef.current)return;
   const scrollBody=(e.target as Element).closest?.(".cl-card-body") as HTMLElement|null;
   if(scrollBody&&scrollBody.scrollHeight>scrollBody.clientHeight+1)return;
   e.preventDefault();
   const rect=el.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
   const old=zoomRef.current;
   const next=Math.max(.3,Math.min(2.5,old*Math.exp(-e.deltaY*(e.deltaMode===1?.027:.0025))));
   const k=next/old;
   const current=panRef.current;
   const updated={x:px-(px-current.x)*k,y:py-(py-current.y)*k};
   zoomRef.current=next;panRef.current=updated;
   setZoom(next);setPan(updated);
  };
  el.addEventListener("wheel",handle,{passive:false});
  return()=>el.removeEventListener("wheel",handle);
 },[]);
 const beginPan=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(e.button!==0||showBoards||!board||wireDrag.current)return;
  const element=e.target as Element;
  if(element.closest(".cl-card,.cl-port,.cl-footer,.cl-empty,.cl-wire g,button,a,input,textarea,select"))return;
  panDrag.current={x:e.clientX,y:e.clientY,startX:pan.x,startY:pan.y};
  setPanning(true);
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const stopPan=()=>{panDrag.current=null;setPanning(false)};
 const changeZoom=(factor:number)=>{const next=Math.max(.3,Math.min(2.5,zoom*factor));const rect=canvasRef.current?.parentElement?.getBoundingClientRect();if(rect){const cx=rect.width/2,cy=rect.height/2,k=next/zoom;setPan(p=>({x:cx-(cx-p.x)*k,y:cy-(cy-p.y)*k}));}setZoom(next)};
 const selectBoard=(b:Board)=>{setActiveId(b.id);setSelected(null);setEdgeSelected(null);setConnecting(null);setShowBoards(false);setSaved(true)};
 return <div className="cl-root">
  <style>{`
  *{box-sizing:border-box}.cl-root{height:100dvh;background:#f3f3f0;color:#20211f;display:flex;flex-direction:column;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .cl-top{height:72px;background:#fafaf8;border-bottom:1px solid #dddeda;display:flex;align-items:center;gap:14px;padding:0 26px;flex-shrink:0}
  .cl-brand{font-size:11px;letter-spacing:.17em;font-weight:800;color:#72746d}.cl-title{font-size:20px;font-weight:750;letter-spacing:-.06em;border:0;background:transparent;outline:0;min-width:120px;width:260px}
  .cl-button{border:1px solid #d4d6d0;background:#fff;padding:10px 13px;border-radius:10px;display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:12px;cursor:pointer;color:#20211f}
  .cl-button:hover{background:#eceee9}.cl-button.dark{background:#20211f;color:#fff;border-color:#20211f}.cl-button svg{width:15px;height:15px}
  .cl-grow{flex:1}.cl-state{font-size:11px;color:#7f827b;display:flex;gap:5px;align-items:center}
  .cl-main{min-height:0;display:flex;flex:1}.cl-sidebar{width:236px;flex-shrink:0;padding:24px 17px;background:#fafaf8;border-right:1px solid #dedfda;overflow:auto}
  .cl-small{font-size:10px;color:#8c8d85;font-weight:800;text-transform:uppercase;letter-spacing:.12em;margin:10px 8px 16px}
  .cl-palette{display:flex;align-items:center;gap:11px;width:100%;background:transparent;border:0;text-align:left;padding:12px 11px;border-radius:11px;font-weight:700;cursor:pointer;color:#30312e}
  .cl-palette:hover{background:#eeeeea}.cl-dot{height:15px;width:15px;border-radius:5px;border:1px solid #00000014}
  .cl-workspace{position:relative;flex:1;min-width:0;overflow:hidden;cursor:grab;touch-action:none;background-image:radial-gradient(#cfd1c9 1px,transparent 1px);background-size:24px 24px}
  .cl-canvas{position:relative;width:3200px;height:2400px;transform-origin:top left;will-change:transform}
  .cl-wire{position:absolute;inset:0;pointer-events:none;width:3200px;height:2400px;overflow:visible}
  .cl-card{position:absolute;width:246px;min-height:155px;border-radius:16px;border:1px solid #d8d8d3;background:#fff;box-shadow:0 7px 21px #0000000c;overflow:hidden;cursor:pointer;user-select:none}
  .cl-card:hover,.cl-card.chosen{box-shadow:0 11px 28px #00000020;border-color:#969994}.cl-card.chosen{outline:2px solid #262722}
  .cl-card-head{padding:12px 15px;font-size:10px;letter-spacing:.1em;font-weight:800;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between;cursor:grab;touch-action:none}
  .cl-card-body{padding:14px 16px 17px}.cl-card h3{font-size:16px;letter-spacing:-.04em;margin:0 0 10px;line-height:1.15}.cl-card p{font-size:12px;color:#666961;line-height:1.5;margin:0;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .cl-inspector{width:315px;background:#fafaf8;border-left:1px solid #dcded8;padding:22px;flex-shrink:0;overflow:auto}
  .cl-inspector h2{font-size:21px;letter-spacing:-.05em;margin:5px 0 25px}.cl-label{font-size:11px;display:block;font-weight:800;color:#555950;margin:18px 0 8px}
  .cl-field{width:100%;padding:12px;border:1px solid #d6d8d0;border-radius:10px;background:white;color:#20211f;font:inherit;font-size:13px;outline:none}
  textarea.cl-field{resize:vertical;min-height:170px;line-height:1.55}.cl-field:focus{border-color:#555a51}
  .cl-list{display:flex;flex-direction:column;gap:7px}.cl-board{width:100%;border:1px solid #ddd;background:#fff;padding:15px;text-align:left;border-radius:12px;cursor:pointer;font-size:14px;font-weight:750}
  .cl-board.active{border:2px solid #20211f}.cl-board small{display:block;color:#8c8d85;margin-top:5px;font-size:11px}
  .cl-empty{position:absolute;left:50%;top:140px;transform:translateX(-50%);text-align:center;background:#ffffffdc;padding:40px;border:1px solid #eee;border-radius:22px;max-width:330px}
  .cl-footer{position:absolute;bottom:20px;left:26px;display:flex;gap:9px;align-items:center;background:#fff;border:1px solid #deded8;padding:7px 11px;border-radius:11px;font-size:12px}
  .cl-hint{padding:13px 14px;background:#f0f1ec;border-radius:12px;color:#656962;font-size:12px;line-height:1.5}
  @media(max-width:1050px){.cl-sidebar{width:170px}.cl-inspector{width:270px}.cl-title{width:160px}.cl-top{padding:0 12px}}
  @media(max-width:700px){.cl-top{gap:7px}.cl-sidebar{display:none}.cl-inspector{position:absolute;right:0;top:72px;bottom:0;z-index:5;width:min(85vw,310px);box-shadow:-10px 0 35px #0002}.cl-title{width:115px;font-size:16px}.cl-brand{display:none}.cl-top .cl-button{padding:9px}.cl-state{display:none}}
  .cl-root{background:#f4f4ef}.cl-top{background:rgba(248,249,246,.75);backdrop-filter:blur(25px) saturate(145%);-webkit-backdrop-filter:blur(25px) saturate(145%)}
  .cl-sidebar,.cl-inspector{background:rgba(250,250,248,.69);backdrop-filter:blur(22px) saturate(120%);-webkit-backdrop-filter:blur(22px) saturate(120%)}
  .cl-card{height:160px;min-height:160px;overflow:visible;background:var(--card-color);border:1px solid #ffffff98;border-radius:19px;box-shadow:0 12px 35px #232d241b,inset 0 1px #ffffffa0;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:box-shadow .3s cubic-bezier(.2,.8,.2,1),transform .35s cubic-bezier(.2,.8,.2,1);animation:clEnter .42s cubic-bezier(.16,1,.3,1) both}
  .cl-card:hover{transform:translateY(-3px)}.cl-card.chosen{outline:2px solid #303c32}.cl-card-head{background:transparent!important;border-radius:19px 19px 0 0;padding:16px 17px 6px;letter-spacing:.12em}.cl-card-body{padding:11px 17px}.cl-card p{color:#46504a}.cl-card h3{font-size:17px}
  .cl-port{position:absolute;z-index:5;width:15px;height:15px;border-radius:50%;background:#f9faf7;border:2px solid #303b32;box-shadow:0 2px 8px #1112;cursor:crosshair;opacity:0;touch-action:none;transition:opacity .2s,transform .22s cubic-bezier(.2,.8,.2,1)}
  .cl-card:hover .cl-port,.cl-card.chosen .cl-port,.cl-port:focus{opacity:1}.cl-port:hover{transform:scale(1.45)}.cl-port-top{top:-8px;left:calc(50% - 8px)}.cl-port-bottom{bottom:-8px;left:calc(50% - 8px)}.cl-port-left{left:-8px;top:calc(50% - 8px)}.cl-port-right{right:-8px;top:calc(50% - 8px)}
  .cl-wire .cl-selected-wire{stroke-dasharray:7 7;animation:clDash 1.2s linear infinite;filter:drop-shadow(0 0 4px #9caa9a88)}
  @keyframes clDash{to{stroke-dashoffset:-28}}@keyframes clEnter{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  @media(prefers-reduced-motion:reduce){.cl-card,.cl-port{transition:none;animation:none}.cl-selected-wire{animation:none}}
  .cl-workspace.cl-panning{cursor:grabbing}.cl-workspace:active{user-select:none}
  /* Media references: full-bleed cover with frosted controls and editorial text. */
  .cl-card:has(.cl-media-cover){background:#1a1f1e;border-color:rgba(255,255,255,.65);box-shadow:0 12px 36px rgba(24,30,28,.2),inset 0 1px rgba(255,255,255,.26);isolation:isolate}
  .cl-card:has(.cl-media-cover):hover{box-shadow:0 19px 45px rgba(12,24,18,.3)}
  .cl-media-cover{position:absolute;inset:0;z-index:0;border-radius:inherit;overflow:hidden;background:#1a1f1e;pointer-events:none}
  .cl-media-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.93);transition:transform .7s cubic-bezier(.16,1,.3,1),filter .5s ease}
  .cl-card:hover .cl-media-image{transform:scale(1.065);filter:saturate(1.08)}
  .cl-media-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,14,14,.49) 0%,rgba(8,13,11,.11) 36%,rgba(8,12,11,.43) 65%,rgba(5,10,9,.88) 100%);transition:opacity .35s ease}
  .cl-card:hover .cl-media-veil{opacity:.92}
  .cl-card:has(.cl-media-cover) .cl-card-head{position:absolute;left:0;right:119px;top:0;z-index:2;color:#fff;background:transparent!important;text-shadow:0 1px 7px rgba(0,0,0,.4);padding:14px 15px 12px;letter-spacing:.13em}
  .cl-card:has(.cl-media-cover) .cl-card-grip{visibility:hidden}
  .cl-card:has(.cl-media-cover) .cl-card-body{position:absolute;bottom:0;left:0;right:0;z-index:2;padding:14px 15px 15px;color:#fff;pointer-events:auto;text-shadow:0 1px 9px rgba(0,0,0,.48)}
  .cl-card:has(.cl-media-cover) .cl-card-body h3{color:#fff;font-size:18px;line-height:1.13;font-weight:790;letter-spacing:-.045em;margin:0 0 5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .cl-card:has(.cl-media-cover) .cl-card-body p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(255,255,255,.83);font-size:10px;line-height:1.35;margin:0}
  .cl-media-source{position:absolute;top:9px;right:10px;z-index:4;pointer-events:auto;max-width:112px;display:flex;gap:5px;align-items:center;justify-content:center;padding:5px 7px;color:#fff;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.23);border-radius:8px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:9px;font-weight:750;line-height:1;text-decoration:none;transition:background .25s,transform .25s}
  .cl-media-source span{max-width:84px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .cl-media-source:hover{background:rgba(255,255,255,.29);transform:translateY(-1px)}
  .cl-media-play{position:absolute;left:50%;top:43%;z-index:3;display:grid;place-items:center;pointer-events:auto;width:42px;height:42px;border-radius:50%;transform:translate(-50%,-50%);color:#fff;text-decoration:none;background:rgba(10,16,13,.38);border:1px solid rgba(255,255,255,.6);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);box-shadow:0 4px 20px rgba(0,0,0,.22);transition:transform .32s cubic-bezier(.16,1,.3,1),background .3s,box-shadow .3s}
  .cl-media-play span{font-size:13px;margin-left:2px}
  .cl-media-audio{background:rgba(17,54,32,.58);border-color:rgba(212,255,221,.8)}
  .cl-card:has(.cl-media-audio) .cl-media-source{background:rgba(29,185,84,.36);border-color:rgba(188,255,211,.35)}
  .cl-media-play:hover{transform:translate(-50%,-50%) scale(1.13);background:rgba(14,19,16,.62);box-shadow:0 7px 25px rgba(0,0,0,.36)}
  .cl-card:has(.cl-media-cover) .cl-port{z-index:6}
  @media(prefers-reduced-motion:reduce){.cl-media-image,.cl-media-veil,.cl-media-play,.cl-media-source{transition:none}}
  /* Affordances for selecting, dragging and connecting. */
  .cl-card{cursor:grab;touch-action:none}
  .cl-card:hover{box-shadow:0 18px 42px rgba(28,42,33,.23),inset 0 1px rgba(255,255,255,.82);border-color:rgba(70,83,72,.34)}
  .cl-card.is-dragging,.cl-card.is-dragging:hover{z-index:12;cursor:grabbing;transform:translateY(-4px) scale(1.025);box-shadow:0 26px 60px rgba(19,29,23,.29),0 0 0 2px rgba(54,75,60,.46);transition:box-shadow .14s ease,transform .16s ease;animation:none}
  .cl-card:focus-visible{outline:2px solid #718c66;outline-offset:3px}
  .cl-card-head{cursor:grab;gap:8px;min-width:0}
  .cl-card.is-dragging .cl-card-head{cursor:grabbing}
  .cl-card-type{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cl-drag-indicator{display:inline-flex;align-items:center;gap:3px;padding:5px 6px 5px 3px;border-radius:8px;border:1px solid rgba(36,49,39,.11);background:rgba(255,255,255,.33);color:#35413a;font:850 9px/1 var(--font-sans,Inter,system-ui,sans-serif);letter-spacing:.07em;opacity:.62;transition:background .24s ease,opacity .24s ease,transform .24s ease;white-space:nowrap;pointer-events:none}
  .cl-card:hover .cl-drag-indicator,.cl-card.is-dragging .cl-drag-indicator{opacity:1;background:rgba(255,255,255,.82);transform:translateY(-1px)}
  .cl-card.is-dragging .cl-drag-indicator{background:#dafa9b;color:#1e2d1d}
  .cl-card h3,.cl-card:has(.cl-media-cover) .cl-card-body h3{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-stretch:normal;font-weight:800;letter-spacing:-.022em;line-height:1.16}
  .cl-card h3{font-size:18px}
  .cl-card:has(.cl-media-cover) .cl-card-body h3{font-size:18px;font-weight:800;letter-spacing:-.022em;line-height:1.16}
  .cl-card:has(.cl-media-cover) .cl-drag-indicator{position:absolute;top:36px;left:12px;z-index:3;background:rgba(12,20,15,.36);border-color:rgba(255,255,255,.26);color:#fff;opacity:.82;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  .cl-card:has(.cl-media-cover):hover .cl-drag-indicator{background:rgba(12,20,15,.62);opacity:1}
  .cl-card:has(.cl-media-cover).is-dragging .cl-drag-indicator{background:#b7ff4a;color:#1c291c;border-color:#b7ff4a}
  .cl-card:has(.cl-media-cover).is-dragging{box-shadow:0 26px 60px rgba(7,13,9,.46),0 0 0 2px rgba(191,255,95,.7)}
  .cl-card .cl-port{cursor:crosshair}
  .cl-card .cl-media-play,.cl-card .cl-media-source{cursor:pointer}
  @media(prefers-reduced-motion:reduce){.cl-card.is-dragging,.cl-card .cl-drag-indicator{transition:none}}
  /* Independent card scroll and persisted dimensions. */
  .cl-card{min-height:0;-webkit-user-select:none;user-select:none}
  .cl-card h3,.cl-card p,.cl-card-body *{user-select:none;-webkit-user-select:none}
  .cl-card.is-dragging .cl-card-body,.cl-card.is-dragging .cl-card-body *{cursor:grabbing}
  .cl-card-head{flex-shrink:0}
  .cl-card-body{position:relative;height:calc(100% - 50px);min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(51,63,55,.25) transparent;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
  .cl-card-body::-webkit-scrollbar{width:5px}
  .cl-card-body::-webkit-scrollbar-thumb{background:rgba(45,61,47,.26);border-radius:9px}
  .cl-card-body p{display:block;overflow:visible;-webkit-line-clamp:unset;-webkit-box-orient:initial;white-space:pre-wrap}
  .cl-card:has(.cl-media-cover) .cl-card-body{height:auto;max-height:calc(100% - 51px);overflow-y:auto;overscroll-behavior:contain;padding-bottom:18px;touch-action:none;user-select:none;-webkit-user-select:none}
  .cl-card:has(.cl-media-cover) .cl-card-body h3{display:block;overflow:visible;-webkit-line-clamp:unset;-webkit-box-orient:initial}
  .cl-card:has(.cl-media-cover) .cl-card-body p{display:block;overflow:visible;-webkit-line-clamp:unset;-webkit-box-orient:initial;white-space:pre-wrap}
  .cl-drag-indicator{padding:5px;width:26px;height:26px;display:grid;place-items:center;gap:0}
  .cl-card:has(.cl-media-cover) .cl-drag-indicator{top:34px;left:12px}
  .cl-card.is-resizing,.cl-card.is-resizing:hover{z-index:12;animation:none;transform:none;box-shadow:0 17px 42px rgba(18,38,24,.22),0 0 0 2px rgba(89,106,84,.42)}
  .cl-resize-handle{position:absolute;z-index:15;bottom:3px;right:3px;width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;background:rgba(255,255,255,.52);border-radius:8px 5px 13px 5px;color:#38473b;cursor:nwse-resize;touch-action:none;opacity:.38;transition:opacity .18s ease,background .18s ease;user-select:none}
  .cl-card:hover .cl-resize-handle,.cl-card.chosen .cl-resize-handle,.cl-card.is-resizing .cl-resize-handle,.cl-resize-handle:focus-visible{opacity:1}
  .cl-resize-handle:hover,.cl-card.is-resizing .cl-resize-handle{background:rgba(255,255,255,.9)}
  .cl-card:has(.cl-media-cover) .cl-resize-handle{color:#fff;background:rgba(14,24,19,.54);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .cl-card:has(.cl-media-cover) .cl-resize-handle:hover{background:rgba(14,24,19,.85)}
  @media(prefers-reduced-motion:reduce){.cl-resize-handle{transition:none}}
  .cl-zoom{font-variant-numeric:tabular-nums;min-width:42px;text-align:center}
  `}</style>
  <header className="cl-top">
   <a href="/" className="cl-button" title="Volver a Work"><ArrowLeft/></a>
   <span className="cl-brand">WORK / CREATIVE LAB</span>
   <button className="cl-button" onClick={()=>setShowBoards(v=>!v)}><GitBranch/> Mapas</button>
   {board?<input className="cl-title" aria-label="Nombre del mapa" value={board.title} onChange={e=>update(b=>({...b,title:e.target.value}))}/>:<strong>Creative Lab</strong>}
   <div className="cl-grow"/>
   <span className="cl-state">{saving?<><Loader2 size={14}/> Guardando</>:saved?<><Check size={14}/> Guardado</>:<><Save size={14}/> Sin guardar</>}</span>
   <button className="cl-button dark" onClick={createBoard}><Plus/> Nuevo mapa</button>
  </header>
  <div className="cl-main">
   <aside className="cl-sidebar">
    <div className="cl-small">Biblioteca de ideas</div>
    {types.map(t=><button key={t.key} className="cl-palette" onClick={()=>addNode(t.key)}><span className="cl-dot" style={{background:t.color}}/>{t.name}<span style={{marginLeft:"auto",fontSize:16}}>+</span></button>)}
    <div className="cl-small" style={{marginTop:34}}>Herramientas</div>
    <div className="cl-hint"><strong>Tarjetas:</strong> clic para editar; arrastra desde cualquier punto para moverlas. <strong>Texto largo:</strong> usa la rueda para desplazarte dentro. <strong>Tamaño:</strong> estira la esquina inferior derecha. <strong>Mapa:</strong> arrastra el fondo.</div>
    {board&&<div style={{marginTop:30}}><label className="cl-label" htmlFor="cl-project">Proyecto vinculado</label><select id="cl-project" className="cl-field" value={board.project_id||""} onChange={e=>update(b=>({...b,project_id:e.target.value||null}))}><option value="">Sin vincular</option>{board.project_id&&!projects.some(p=>p.id===board.project_id)&&<option value={board.project_id}>Proyecto actual</option>}{projects.slice().sort((a,b)=>a.name.localeCompare(b.name,"es")).map(p=><option key={p.id} value={p.id}>{p.name}{p.account?" · "+p.account:""}</option>)}</select>{projectError&&<small style={{color:"#b44"}}>{projectError}</small>}</div>}
   </aside>
   <div ref={workspaceRef} className={"cl-workspace"+(panning?" cl-panning":"")} onPointerDown={beginPan} onPointerMove={onPointerMove} onPointerUp={e=>{finishResize(e);finishCardDrag(e);stopPan()}} onPointerCancel={e=>{finishResize(e);finishCardDrag(e);stopPan()}} onClick={e=>{if(e.target===e.currentTarget){setSelected(null);setEdgeSelected(null);setConnecting(null)}}}>
    {error&&<div role="alert" style={{position:"sticky",top:10,left:20,zIndex:20,margin:15,background:"#fee",padding:12,borderRadius:10,maxWidth:550}}>{error}</div>}
    {loading?<div className="cl-empty"><Loader2/> Cargando mapas...</div>:showBoards||!board?<div className="cl-empty" style={{position:"sticky",top:90,left:100,transform:"none",textAlign:"left",maxWidth:470}}>
     <h2 style={{letterSpacing:"-.05em"}}>Tus mapas creativos</h2><p style={{fontSize:13,color:"#777",lineHeight:1.5}}>Un lienzo para relacionar pensamientos, desarrollar racionales y dar forma a tus campañas.</p>
     <div className="cl-list">{boards.map(b=><button key={b.id} className={"cl-board "+(activeId===b.id?"active":"")} onClick={()=>selectBoard(b)}>{b.title}<small>{b.nodes.length} ideas · {b.edges.length} conexiones</small></button>)}</div>
     <button className="cl-button dark" onClick={createBoard} style={{marginTop:18}}><CirclePlus/> Crear mapa</button>
    </div>:<div ref={canvasRef} className="cl-canvas" style={{transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`}}>
     <svg className="cl-wire" viewBox="0 0 3200 2400">
      {board.edges.map(edge=>{const a=board.nodes.find(n=>n.id===edge.source),b=board.nodes.find(n=>n.id===edge.target);if(!a||!b)return null;const from=edge.sourcePort||"right",to=edge.targetPort||"left",p1=anchor(a,from),p2=anchor(b,to),geometry=curveGeometry(p1,p2,from,to),label=edge.label.slice(0,26),labelWidth=Math.max(66,Math.min(184,label.length*5.9+22));return <g key={edge.id} style={{pointerEvents:"auto",cursor:"pointer"}} onClick={()=>{setEdgeSelected(edge.id);setSelected(null)}}>
       <path d={geometry.path} stroke="transparent" strokeWidth="20" fill="none"/>
       <path d={geometry.path} stroke={edgeSelected===edge.id?"#242e25":"#79867a"} strokeWidth={edgeSelected===edge.id?3:2} className={edgeSelected===edge.id?"cl-selected-wire":""} strokeLinecap="round" fill="none"/>
       <circle cx={p1.x} cy={p1.y} r="4" fill="#2b352e"/><circle cx={p2.x} cy={p2.y} r="4" fill="#2b352e"/>
       <rect x={geometry.mid.x-labelWidth/2} y={geometry.mid.y-13} width={labelWidth} height="26" rx="13" fill="#ffffffed" stroke="#d5ddd4"/>
       <text x={geometry.mid.x} y={geometry.mid.y+3.5} textAnchor="middle" fontSize="10" fontWeight="650" fill="#515b52">{label}</text></g>})}
      {connecting&&wireEnd&&board.nodes.some(n=>n.id===connecting)&&<path className="cl-selected-wire" d={curve(anchor(board.nodes.find(n=>n.id===connecting)!,sourcePort),wireEnd,sourcePort)} stroke="#293a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>}
     </svg>
     {board.nodes.map(n=><div key={n.id} className={"cl-card "+(selected===n.id?"chosen":"")+(draggingId===n.id?" is-dragging":"")+(resizingId===n.id?" is-resizing":"")+(mediaPreview(n.url)?" has-preview":"")} style={{left:n.x,top:n.y,width:dimensions(n).width,height:dimensions(n).height,"--card-color":typeOf(n.kind).color} as React.CSSProperties} onPointerDown={e=>beginCardDrag(e,n)} onDragStart={e=>e.preventDefault()} onClick={()=>onNodeClick(n.id)}>
      <div className="cl-card-head" title="Arrastra para mover la tarjeta"><span className="cl-card-type">{typeOf(n.kind).name}</span><span className="cl-drag-indicator" title="Arrastra para mover"><GripVertical size={16} strokeWidth={2.5}/></span></div>
      <div className="cl-card-body"><h3>{n.title}</h3><p>{n.body||"Haz clic para desarrollar esta idea."}</p></div>
      <ReferencePreview url={n.url} title={n.title}/>
      {PORTS.map(port=><button key={port} className={"cl-port cl-port-"+port} title="Arrastra para conectar" aria-label={"Conectar "+port} onPointerDown={e=>beginWire(e,n.id,port)} onPointerMove={e=>{if(wireDrag.current){e.stopPropagation();setWireEnd(world(e))}}} onPointerUp={e=>{e.stopPropagation();endWire(e)}} onClick={e=>e.stopPropagation()}/>)}
      <button type="button" data-no-card-drag className="cl-resize-handle" title="Arrastra la esquina para cambiar el tamaño" aria-label={"Cambiar tamaño de "+n.title} onPointerDown={e=>beginResize(e,n)} onClick={e=>e.stopPropagation()}><MoveDiagonal2 size={14} strokeWidth={2.5}/></button>
     </div>)}
    </div>}
    <div className="cl-footer"><button className="cl-button" onClick={()=>changeZoom(1/1.15)}>−</button><span className="cl-zoom">{Math.round(zoom*100)}%</span><button className="cl-button" onClick={()=>changeZoom(1.15)}>+</button></div>
   </div>
   {board&&!showBoards&&(selectedNode||selectedEdge)&&<aside className="cl-inspector">
    <button className="cl-button" onClick={()=>{setSelected(null);setEdgeSelected(null);setConnecting(null)}} style={{float:"right"}}><X/></button>
    {selectedNode?<><div className="cl-small">Editor de ideas</div><h2>{typeOf(selectedNode.kind).name}</h2>
     <label className="cl-label">Título</label><input className="cl-field" value={selectedNode.title} onChange={e=>nodeChange("title",e.target.value)}/>
     <label className="cl-label">Racional / desarrollo</label><textarea className="cl-field" value={selectedNode.body} onChange={e=>nodeChange("body",e.target.value)} placeholder="Escribe tu argumento, hipótesis o desarrollo creativo..."/>
     <label className="cl-label">Enlace de referencia</label><input className="cl-field" value={selectedNode.url||""} onChange={e=>nodeChange("url",e.target.value)} placeholder="https://..."/>
     {selectedNode.url&&/^https?:\/\//i.test(selectedNode.url)&&<a href={selectedNode.url} target="_blank" rel="noopener noreferrer" style={{display:"block",fontSize:12,marginTop:9}}>Abrir referencia ↗</a>}
     <button className="cl-button dark" style={{width:"100%",justifyContent:"center",marginTop:30}} onClick={()=>{setConnecting(selectedNode.id);setSourcePort("right");setSelected(null)}}><Link2/> Conectar con otra idea <ArrowRight/></button>
     <button className="cl-button" style={{width:"100%",justifyContent:"center",marginTop:12}} onClick={deleteNode}><Trash2/> Eliminar tarjeta</button>
    </>:selectedEdge?<><div className="cl-small">Conexión</div><h2>Relación entre ideas</h2><label className="cl-label">Qué significa esta conexión</label><input className="cl-field" value={selectedEdge.label} onChange={e=>update(b=>({...b,edges:b.edges.map(x=>x.id===selectedEdge.id?{...x,label:e.target.value}:x)}))}/>
     <button className="cl-button" onClick={()=>{update(b=>({...b,edges:b.edges.filter(x=>x.id!==selectedEdge.id)}));setEdgeSelected(null)}} style={{marginTop:20}}><Trash2/> Eliminar conexión</button></>:null}
   </aside>}
   {connecting&&<div style={{position:"absolute",bottom:20,right:25,background:"#222",color:"white",padding:16,borderRadius:12,zIndex:30,fontSize:13}}>Selecciona la tarjeta de destino <button onClick={()=>setConnecting(null)} style={{marginLeft:20,color:"white",background:"none",border:"none",cursor:"pointer"}}>Cancelar</button></div>}
  </div>
 </div>;
}
