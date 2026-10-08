"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CirclePlus, GitBranch, Lightbulb, Link2, Loader2, Plus, Save, Trash2, X } from "lucide-react";

type Kind="insight"|"concepto"|"racional"|"referencia"|"ejecucion";
type Node={id:string;kind:Kind;title:string;body:string;x:number;y:number;url?:string};
type Edge={id:string;source:string;target:string;label:string};
type Board={id:string;title:string;project_id:string|null;nodes:Node[];edges:Edge[];updated_at:string};
const types: {key:Kind;name:string;color:string}[]=[
 {key:"insight",name:"Insight",color:"#ddedff"},
 {key:"concepto",name:"Concepto",color:"#f4e9b2"},
 {key:"racional",name:"Racional",color:"#eae4fd"},
 {key:"referencia",name:"Referencia",color:"#d7ede4"},
 {key:"ejecucion",name:"Ejecución",color:"#f9e0d7"},
];
const typeOf=(k:Kind)=>types.find(t=>t.key===k)||types[0];
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
 const [connecting,setConnecting]=useState<string|null>(null);
 const [edgeSelected,setEdgeSelected]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1);
 const [showBoards,setShowBoards]=useState(true);
 const drag=useRef<{id:string;clientX:number;clientY:number;startX:number;startY:number}|null>(null);
 const board=boards.find(b=>b.id===activeId);
 const boardRef=useRef(board);boardRef.current=board;
 const latestRef=useRef(boards);latestRef.current=boards;
 const seq=useRef(0);const loaded=useRef(false);
 const selectedNode=board?.nodes.find(n=>n.id===selected);
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
   setBoards(p=>[d.board,...p]);setActiveId(d.board.id);setShowBoards(false);setSelected(null);setEdgeSelected(null);setSaved(true);
  }catch(e){setError(String(e));}
 };
 const deleteBoard=async()=>{
  if(!board||!window.confirm("¿Eliminar este mapa y todas sus ideas?"))return;
  const r=await fetch("/api/creative?id="+board.id,{method:"DELETE"});if(!r.ok){setError("No se pudo eliminar");return}
  const rest=boards.filter(b=>b.id!==board.id);setBoards(rest);setActiveId(rest[0]?.id||null);setSelected(null);
 };
 const addNode=(kind:Kind)=>{
  if(!board)return;
  const node:Node={id:id(),kind,title:typeOf(kind).name+" sin título",body:"",x:Math.round((160+Math.random()*290)/20)*20,y:Math.round((120+Math.random()*230)/20)*20};
  update(b=>({...b,nodes:[...b.nodes,node]}));setSelected(node.id);setEdgeSelected(null);setShowBoards(false);
 };
 const onNodeClick=(nodeId:string)=>{
  if(connecting){if(connecting!==nodeId&&!board?.edges.some(e=>e.source===connecting&&e.target===nodeId))update(b=>({...b,edges:[...b.edges,{id:id(),source:connecting,target:nodeId,label:"relaciona"}]}));setConnecting(null);return;}
  setSelected(nodeId);setEdgeSelected(null);
 };
 const deleteNode=()=>{if(!selected)return;update(b=>({...b,nodes:b.nodes.filter(n=>n.id!==selected),edges:b.edges.filter(e=>e.source!==selected&&e.target!==selected)}));setSelected(null)};
 const nodeChange=(field:"title"|"body"|"url",value:string)=>{if(selected)update(b=>({...b,nodes:b.nodes.map(n=>n.id===selected?{...n,[field]:value}:n)}))};
 const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  const d=drag.current;if(!d)return;
  const dx=(event.clientX-d.clientX)/zoom,dy=(event.clientY-d.clientY)/zoom;
  update(b=>({...b,nodes:b.nodes.map(n=>n.id===d.id?{...n,x:Math.max(0,Math.round(d.startX+dx)),y:Math.max(0,Math.round(d.startY+dy))}:n)}));
 };
 const selectBoard=(b:Board)=>{setActiveId(b.id);setSelected(null);setEdgeSelected(null);setConnecting(null);setShowBoards(false);setSaved(true)};
 return <div className="cl-root">
  <style>{`
  *{box-sizing:border-box}.cl-root{height:100dvh;background:#f3f3f0;color:#20211f;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif}
  .cl-top{height:72px;background:#fafaf8;border-bottom:1px solid #dddeda;display:flex;align-items:center;gap:14px;padding:0 26px;flex-shrink:0}
  .cl-brand{font-size:11px;letter-spacing:.17em;font-weight:800;color:#72746d}.cl-title{font-size:20px;font-weight:750;letter-spacing:-.06em;border:0;background:transparent;outline:0;min-width:120px;width:260px}
  .cl-button{border:1px solid #d4d6d0;background:#fff;padding:10px 13px;border-radius:10px;display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:12px;cursor:pointer;color:#20211f}
  .cl-button:hover{background:#eceee9}.cl-button.dark{background:#20211f;color:#fff;border-color:#20211f}.cl-button svg{width:15px;height:15px}
  .cl-grow{flex:1}.cl-state{font-size:11px;color:#7f827b;display:flex;gap:5px;align-items:center}
  .cl-main{min-height:0;display:flex;flex:1}.cl-sidebar{width:236px;flex-shrink:0;padding:24px 17px;background:#fafaf8;border-right:1px solid #dedfda;overflow:auto}
  .cl-small{font-size:10px;color:#8c8d85;font-weight:800;text-transform:uppercase;letter-spacing:.12em;margin:10px 8px 16px}
  .cl-palette{display:flex;align-items:center;gap:11px;width:100%;background:transparent;border:0;text-align:left;padding:12px 11px;border-radius:11px;font-weight:700;cursor:pointer;color:#30312e}
  .cl-palette:hover{background:#eeeeea}.cl-dot{height:15px;width:15px;border-radius:5px;border:1px solid #00000014}
  .cl-workspace{position:relative;flex:1;min-width:0;overflow:auto;background-image:radial-gradient(#cfd1c9 1px,transparent 1px);background-size:24px 24px}
  .cl-canvas{position:relative;min-width:1700px;min-height:1150px;transform-origin:top left}
  .cl-wire{position:absolute;inset:0;pointer-events:none;width:1700px;height:1150px;overflow:visible}
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
    <div className="cl-hint">Arrastra una tarjeta desde su cabecera. Selecciónala y pulsa «Conectar» para enlazarla con otra.</div>
    {board&&<div style={{marginTop:30}}><label className="cl-label">ID del proyecto vinculado (opcional)</label><input className="cl-field" value={board.project_id||""} onChange={e=>update(b=>({...b,project_id:e.target.value}))} placeholder="Proyecto WorkOS / Notion"/></div>}
   </aside>
   <div className="cl-workspace" onPointerMove={onPointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onClick={e=>{if(e.target===e.currentTarget){setSelected(null);setEdgeSelected(null);setConnecting(null)}}}>
    {error&&<div role="alert" style={{position:"sticky",top:10,left:20,zIndex:20,margin:15,background:"#fee",padding:12,borderRadius:10,maxWidth:550}}>{error}</div>}
    {loading?<div className="cl-empty"><Loader2/> Cargando mapas...</div>:showBoards||!board?<div className="cl-empty" style={{position:"sticky",top:90,left:100,transform:"none",textAlign:"left",maxWidth:470}}>
     <h2 style={{letterSpacing:"-.05em"}}>Tus mapas creativos</h2><p style={{fontSize:13,color:"#777",lineHeight:1.5}}>Un lienzo para relacionar pensamientos, desarrollar racionales y dar forma a tus campañas.</p>
     <div className="cl-list">{boards.map(b=><button key={b.id} className={"cl-board "+(activeId===b.id?"active":"")} onClick={()=>selectBoard(b)}>{b.title}<small>{b.nodes.length} ideas · {b.edges.length} conexiones</small></button>)}</div>
     <button className="cl-button dark" onClick={createBoard} style={{marginTop:18}}><CirclePlus/> Crear mapa</button>
    </div>:<div className="cl-canvas" style={{transform:`scale(${zoom})`}}>
     <svg className="cl-wire" viewBox="0 0 1700 1150"><defs><marker id="cl-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#696d65" strokeWidth="1.5"/></marker></defs>
      {board.edges.map(edge=>{const a=board.nodes.find(n=>n.id===edge.source),b=board.nodes.find(n=>n.id===edge.target);if(!a||!b)return null;const x1=a.x+123,y1=a.y+78,x2=b.x+123,y2=b.y+78;return <g key={edge.id} style={{pointerEvents:"auto",cursor:"pointer"}} onClick={()=>{setEdgeSelected(edge.id);setSelected(null)}}>
       <path d={`M${x1} ${y1} C${(x1+x2)/2} ${y1},${(x1+x2)/2} ${y2},${x2} ${y2}`} stroke="transparent" strokeWidth="18" fill="none"/>
       <path d={`M${x1} ${y1} C${(x1+x2)/2} ${y1},${(x1+x2)/2} ${y2},${x2} ${y2}`} stroke={edgeSelected===edge.id?"#151515":"#8a9089"} strokeWidth={edgeSelected===edge.id?3:2} fill="none" markerEnd="url(#cl-arrow)"/>
       <rect x={(x1+x2)/2-39} y={(y1+y2)/2-12} width="78" height="22" rx="9" fill="#fff" stroke="#ddddda"/>
       <text x={(x1+x2)/2} y={(y1+y2)/2+3} textAnchor="middle" fontSize="10" fill="#62665f">{edge.label.slice(0,16)}</text>
      </g>})}
     </svg>
     {board.nodes.map(n=><div key={n.id} className={"cl-card "+(selected===n.id?"chosen":"")} style={{left:n.x,top:n.y}} onClick={()=>onNodeClick(n.id)}>
      <div className="cl-card-head" style={{background:typeOf(n.kind).color}} onPointerDown={e=>{if(e.button!==0||connecting)return;drag.current={id:n.id,clientX:e.clientX,clientY:e.clientY,startX:n.x,startY:n.y};e.currentTarget.setPointerCapture(e.pointerId);setSelected(n.id);setEdgeSelected(null)}}>{typeOf(n.kind).name}<span>⠿</span></div>
      <div className="cl-card-body"><h3>{n.title}</h3><p>{n.body||"Haz clic para desarrollar esta idea."}</p></div>
     </div>)}
    </div>}
    <div className="cl-footer"><button className="cl-button" onClick={()=>setZoom(v=>Math.max(.6,Math.round((v-.1)*10)/10))}>−</button>{Math.round(zoom*100)}%<button className="cl-button" onClick={()=>setZoom(v=>Math.min(1.5,Math.round((v+.1)*10)/10))}>+</button></div>
   </div>
   {board&&!showBoards&&(selectedNode||selectedEdge)&&<aside className="cl-inspector">
    <button className="cl-button" onClick={()=>{setSelected(null);setEdgeSelected(null);setConnecting(null)}} style={{float:"right"}}><X/></button>
    {selectedNode?<><div className="cl-small">Editor de ideas</div><h2>{typeOf(selectedNode.kind).name}</h2>
     <label className="cl-label">Título</label><input className="cl-field" value={selectedNode.title} onChange={e=>nodeChange("title",e.target.value)}/>
     <label className="cl-label">Racional / desarrollo</label><textarea className="cl-field" value={selectedNode.body} onChange={e=>nodeChange("body",e.target.value)} placeholder="Escribe tu argumento, hipótesis o desarrollo creativo..."/>
     <label className="cl-label">Enlace de referencia</label><input className="cl-field" value={selectedNode.url||""} onChange={e=>nodeChange("url",e.target.value)} placeholder="https://..."/>
     {selectedNode.url&&/^https?:\/\//i.test(selectedNode.url)&&<a href={selectedNode.url} target="_blank" rel="noopener noreferrer" style={{display:"block",fontSize:12,marginTop:9}}>Abrir referencia ↗</a>}
     <button className="cl-button dark" style={{width:"100%",justifyContent:"center",marginTop:30}} onClick={()=>{setConnecting(selectedNode.id);setSelected(null)}}><Link2/> Conectar con otra idea <ArrowRight/></button>
     <button className="cl-button" style={{width:"100%",justifyContent:"center",marginTop:12}} onClick={deleteNode}><Trash2/> Eliminar tarjeta</button>
    </>:selectedEdge?<><div className="cl-small">Conexión</div><h2>Relación entre ideas</h2><label className="cl-label">Qué significa esta conexión</label><input className="cl-field" value={selectedEdge.label} onChange={e=>update(b=>({...b,edges:b.edges.map(x=>x.id===selectedEdge.id?{...x,label:e.target.value}:x)}))}/>
     <button className="cl-button" onClick={()=>{update(b=>({...b,edges:b.edges.filter(x=>x.id!==selectedEdge.id)}));setEdgeSelected(null)}} style={{marginTop:20}}><Trash2/> Eliminar conexión</button></>:null}
   </aside>}
   {connecting&&<div style={{position:"absolute",bottom:20,right:25,background:"#222",color:"white",padding:16,borderRadius:12,zIndex:30,fontSize:13}}>Selecciona la tarjeta de destino <button onClick={()=>setConnecting(null)} style={{marginLeft:20,color:"white",background:"none",border:"none",cursor:"pointer"}}>Cancelar</button></div>}
  </div>
 </div>;
}
