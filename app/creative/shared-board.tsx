"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowUpRight} from "lucide-react";
type Node={id:string;kind:string;title:string;body:string;x:number;y:number;width?:number;height?:number;url?:string};
type Board={title:string;nodes:Node[];edges:{id:string;source:string;target:string;label:string;sourcePort?:string;targetPort?:string}[]};
type Person={id:string;name:string;x:number|null;y:number|null};
const colors:Record<string,string>={tension:"#FF846F",idea:"#B7FF4A",camino:"#9FD4FF",concepto:"#F0E100",racional:"#D6C3FF",briefing:"#DCE9E3",insight:"#F5F3FF",draft:"#D9DDD7",referencia:"#834DFB",ejecution:"#18102B",ejecucion:"#18102B"};
function Media({url,title}:{url?:string;title:string}){
 const [data,setData]=useState<{image:string;site:string;kind:string}|null>(null);
 const [bad,setBad]=useState(false);
 useEffect(()=>{setData(null);setBad(false);if(!url)return;let active=true;fetch("/api/creative/preview?url="+encodeURIComponent(url)).then(r=>r.ok?r.json():null).then(v=>{if(active)setData(v?.preview||null)}).catch(()=>{});return()=>{active=false}},[url]);
 if(!url)return null;
 let direct:string|null=null,video=false;
 try{const u=new URL(url);const host=u.hostname.replace(/^www\\./,"");const id=host==="youtu.be"?u.pathname.slice(1):["youtube.com","m.youtube.com"].includes(host)?u.searchParams.get("v")||u.pathname.match(/^\\/(?:shorts|embed)\\/([^/]+)/)?.[1]:null;if(id&&/^[\\w-]{11}$/.test(id)){direct="https://img.youtube.com/vi/"+id+"/hqdefault.jpg";video=true}else if(/\\.(png|jpe?g|gif|webp|avif)$/i.test(u.pathname))direct=url;}catch{}
 const src=direct||data?.image;
 if(!src||bad)return null;
 return <div style={{position:"absolute",inset:0,borderRadius:"inherit",overflow:"hidden",background:"#111",zIndex:0}}>
 <img src={src} alt="" onError={()=>setBad(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
 <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#0b0b0b75 0%,transparent 40%,#050505e8 100%)"}}/>
 <a href={url} target="_blank" rel="noopener noreferrer" onPointerDown={e=>e.stopPropagation()} style={{position:"absolute",right:9,top:8,pointerEvents:"auto",fontSize:10,color:"white",background:"#3339",padding:"5px 9px",borderRadius:8,textDecoration:"none"}}>{video?"YouTube":data?.site||"Ver"} ↗</a>
 {(video||data?.kind==="video"||data?.kind==="audio")&&<a href={url} target="_blank" rel="noopener noreferrer" onPointerDown={e=>e.stopPropagation()} style={{position:"absolute",left:"50%",top:"46%",transform:"translate(-50%,-50%)",border:"1px solid #fff8",borderRadius:"50%",width:36,height:36,display:"grid",placeItems:"center",color:"white",background:"#1117",pointerEvents:"auto",textDecoration:"none"}}>▶</a>}
 </div>
}
const Cursor=({name,color}:{name:string;color:string})=><div style={{display:"flex",alignItems:"start",gap:3}}><svg width="19" height="25" viewBox="0 0 24 30" fill="none"><path d="M2 1.5V25L8.6 18.9L14 28L19 25.2L13.6 16.3L23 15Z" fill={color} stroke="#fff" strokeWidth="2" strokeLinejoin="round"/><path d="M2 1.5V25L8.6 18.9L14 28L19 25.2L13.6 16.3L23 15Z" stroke="#18102B" strokeWidth=".7"/></svg><span style={{background:color,color:"#18102B",fontWeight:800,fontSize:11,padding:"5px 8px",borderRadius:6,whiteSpace:"nowrap",boxShadow:"0 2px 9px #0002"}}>{name}</span></div>;
export default function SharedBoard({token}:{token:string}){
 const [name,setName]=useState(""),[joined,setJoined]=useState(""),[board,setBoard]=useState<Board|null>(null),[people,setPeople]=useState<Person[]>([]),[error,setError]=useState("");
 const [zoom,setZoom]=useState(.85),[pan,setPan]=useState({x:180,y:120});
 const id=useRef(""),mouse=useRef<{x:number|null;y:number|null}>({x:null,y:null}),drag=useRef<{x:number;y:number;px:number;py:number}|null>(null),view=useRef<HTMLDivElement>(null);
 useEffect(()=>{id.current=crypto.randomUUID();try{setName(sessionStorage.getItem("creative-name")||"")}catch{}},[]);
 useEffect(()=>{if(!joined)return;let active=true;let pending=false;
 const poll=async()=>{if(!active||pending||document.hidden)return;pending=true;try{
 const response=await fetch((process.env.NEXT_PUBLIC_SUPABASE_URL||"https://lpjiilefslxlgnupaacz.supabase.co")+"/rest/v1/rpc/creative_live",{method:"POST",headers:{"Content-Type":"application/json",apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_mATu3ZkITNszykDr2nw9DQ_W5MW0GNh"},body:JSON.stringify({p_token:token,p_visitor:id.current,p_name:joined,p_x:mouse.current.x,p_y:mouse.current.y}),cache:"no-store"});
 if(!response.ok)throw Error((await response.json()).message||"Enlace desactivado");const d=await response.json();if(active){setBoard(d.board);setPeople(d.participants);setError("")}
 }catch(e){if(active)setError(String(e))}finally{pending=false}};
 void poll();const timer=setInterval(poll,850);return()=>{active=false;clearInterval(timer)};
 },[joined,token]);
 const enter=()=>{const n=name.trim().slice(0,50);if(n.length<2)return;try{sessionStorage.setItem("creative-name",n)}catch{}setJoined(n)};
 const track=(e:React.PointerEvent)=>{const rect=view.current?.getBoundingClientRect();if(!rect)return;mouse.current={x:(e.clientX-rect.left-pan.x)/zoom,y:(e.clientY-rect.top-pan.y)/zoom};if(drag.current){const d=drag.current;setPan({x:d.px+e.clientX-d.x,y:d.py+e.clientY-d.y})}};
 const fit=()=>{if(!board?.nodes.length)return;const ns=board.nodes;const l=Math.min(...ns.map(n=>n.x)),t=Math.min(...ns.map(n=>n.y)),r=Math.max(...ns.map(n=>n.x+(n.width||246))),b=Math.max(...ns.map(n=>n.y+(n.height||160)));const w=view.current?.clientWidth||900,h=view.current?.clientHeight||650;const z=Math.min(1.25,(w-100)/(r-l),(h-100)/(b-t));setZoom(z);setPan({x:w/2-(l+r)*z/2,y:h/2-(t+b)*z/2})};
 if(!joined)return <main style={{fontFamily:"Arial",background:"#F6F7F3",minHeight:"100dvh",display:"grid",placeItems:"center"}}><form onSubmit={e=>{e.preventDefault();enter()}} style={{width:340,padding:32,background:"white",borderRadius:18,boxShadow:"0 10px 40px #1112"}}><strong>LAB OS</strong><h1>Te han compartido un mapa creativo.</h1><p style={{fontSize:13,color:"#666"}}>Identifícate para explorar el board y ver a los demás participantes. Acceso de solo lectura.</p><label>Tu nombre<input value={name} maxLength={50} onChange={e=>setName(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,margin:"10px 0 18px",border:"1px solid #ddd",borderRadius:8}}/></label><button disabled={name.trim().length<2} style={{width:"100%",background:"#18102B",color:"white",border:0,borderRadius:9,padding:13,cursor:"pointer"}}>Entrar al mapa →</button></form></main>;
 return <div style={{height:"100dvh",background:"#F7F8F3",display:"flex",flexDirection:"column",fontFamily:"Inter,Arial,sans-serif",color:"#18102B"}}>
 <header style={{padding:"17px 22px",display:"flex",alignItems:"center",gap:22,background:"white",borderBottom:"1px solid #eee"}}><strong>LAB OS</strong><b>{board?.title||"Cargando..."}</b><span style={{marginLeft:"auto",fontSize:12}}>◉ Solo lectura · {people.length} conectados</span></header>
 <div style={{display:"flex",flex:1,minHeight:0}}><aside style={{width:170,padding:20,borderRight:"1px solid #ddd",fontSize:12}}><b>EN EL BOARD</b>{people.map((p,i)=><button key={p.id} onClick={()=>{if(p.x===null||p.y===null)return;setPan({x:(view.current?.clientWidth||900)/2-p.x*zoom,y:(view.current?.clientHeight||600)/2-p.y*zoom})}} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 0",background:"none",border:0,cursor:"pointer"}}><span style={{color:["#834DFB","#FF846F","#82C52A"][i%3]}}>● </span>{p.name}{p.id===id.current?" (tú)":""}</button>)}<small style={{color:"#777"}}>Pulsa un nombre para seguir su posición.</small></aside>
 <div ref={view} onPointerMove={track} onPointerLeave={()=>{mouse.current={x:null,y:null}}} onPointerDown={e=>{if(e.button===0&&!(e.target as Element).closest("a,button")){drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId)}}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onWheel={e=>{const z=Math.max(.12,Math.min(2.5,zoom*Math.exp(-e.deltaY*.001)));const rect=view.current?.getBoundingClientRect();if(!rect)return;const x=e.clientX-rect.left,y=e.clientY-rect.top;setPan({x:x-(x-pan.x)*z/zoom,y:y-(y-pan.y)*z/zoom});setZoom(z)}} style={{position:"relative",flex:1,overflow:"hidden",touchAction:"none",cursor:"grab",backgroundImage:"radial-gradient(#CFD1C9 0.9px,transparent 0.9px)",backgroundSize:`${24*zoom}px ${24*zoom}px`,backgroundPosition:`${pan.x}px ${pan.y}px`}}>
 {error&&<p style={{position:"absolute",top:10,left:20,zIndex:8,background:"#fee",padding:12}}>{error}</p>}
 <div style={{position:"absolute",left:0,top:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"0 0"}}>
 <svg style={{position:"absolute",left:-10000,top:-10000,width:20000,height:20000,overflow:"visible"}} viewBox="-10000 -10000 20000 20000">{board?.edges.map(e=>{const a=board.nodes.find(n=>n.id===e.source),b=board.nodes.find(n=>n.id===e.target);if(!a||!b)return null;const p=e.sourcePort||"right",q=e.targetPort||"left";const coord=(n:Node,s:string)=>({x:n.x+(s==="left"?0:s==="right"?(n.width||246):(n.width||246)/2),y:n.y+(s==="top"?0:s==="bottom"?(n.height||160):(n.height||160)/2)});const x=coord(a,p),y=coord(b,q),d=Math.max(22,Math.min(64,Math.abs(y.x-x.x)*.22));return <path key={e.id} d={`M${x.x} ${x.y} C${x.x+d} ${x.y} ${y.x-d} ${y.y} ${y.x} ${y.y}`} fill="none" stroke="#8B968A" strokeWidth="2"/>})}</svg>
 {board?.nodes.map(n=>{const hasMedia=Boolean(n.url&&(/youtube|youtu.be|\\.(mp4|png|jpg|webp)/i.test(n.url)));const ink=["referencia","ejecucion"].includes(n.kind)?"white":"#18102B";return <article key={n.id} style={{position:"absolute",left:n.x,top:n.y,width:n.width||246,height:n.height||160,boxSizing:"border-box",overflow:"hidden",borderRadius:16,boxShadow:"0 10px 26px #0000001d",background:colors[n.kind]||"#ddd",color:ink,border:"1px solid #ffffff20"}}>
 <Media url={n.url} title={n.title}/>
 <div style={{position:"relative",zIndex:1,height:"100%",boxSizing:"border-box",padding:"12px 15px",display:"flex",flexDirection:"column",pointerEvents:"none",color:hasMedia?"white":ink}}>
 <div style={{fontSize:10,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase"}}>{n.kind}</div>
 <div style={{marginTop:hasMedia?"auto":16,overflow:"auto",scrollbarWidth:"thin"}}>
 <h3 style={{fontSize:18,fontWeight:800,letterSpacing:"-.022em",lineHeight:1.16,margin:"0 0 8px"}}>{n.title}</h3>
 <p style={{fontSize:12,lineHeight:1.5,whiteSpace:"pre-wrap",margin:0,opacity:hasMedia?.95:.78}}>{n.body}</p>
 </div></div></article>})}
 {people.filter(p=>p.id!==id.current&&p.x!==null&&p.y!==null).map((p,i)=><div key={p.id} style={{position:"absolute",left:p.x!,top:p.y!,pointerEvents:"none",zIndex:3}}><Cursor name={p.name} color={["#FF846F","#D6C3FF","#B7FF4A","#9FD4FF"][i%4]}/></div>)}
 </div><div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:12,alignItems:"center",padding:9,borderRadius:12,background:"white"}}><button onClick={fit}>⌗</button><button onClick={()=>setZoom(z=>Math.max(.12,z/1.2))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(2.5,z*1.2))}>+</button></div>
 </div></div></div>
}