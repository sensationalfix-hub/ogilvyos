"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {BrainCircuit,ChevronDown,Info,Loader2,Sparkles,ThumbsDown,ThumbsUp,X} from "lucide-react";
import {localText,localHash,localSuggestions,type LocalReference,type LocalVector,type LocalDecision} from "./reference-local-engine";

type Suggestion=LocalDecision&{id:string;relation:string;explanation:string;distance:number;model?:string};
type LocalPayload={vectors:LocalVector[];proposals:Suggestion[]};
const post=async(url:string,body:unknown,method="POST")=>{
 const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const value=await r.json();if(!r.ok)throw Error(value.error||"No se pudo guardar");return value;
};
export function ReferenceIntelligence({referenceId,items,onUpdate}:{referenceId:string;items:LocalReference[];onUpdate:()=>void}){
 const [distance,setDistance]=useState(55);
 const [records,setRecords]=useState<LocalPayload>({vectors:[],proposals:[]});
 const [running,setRunning]=useState(false);
 const [status,setStatus]=useState("");
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState("");
 const [voting,setVoting]=useState<string|null>(null);
 const workerRef=useRef<Worker|null>(null);
 const operationRef=useRef(0);
 const refresh=useCallback(async()=>{
  const r=await fetch("/api/references/local",{cache:"no-store"});
  const d=await r.json();if(!r.ok)throw Error(d.error||"No se pudo leer la memoria");
  setRecords({vectors:d.vectors||[],proposals:d.proposals||[]});
  return d as LocalPayload;
 },[]);
 useEffect(()=>{
  setStatus("");setError("");setProgress(0);
  refresh().catch(e=>setError(e instanceof Error?e.message:"Error al consultar la biblioteca"));
 },[refresh,referenceId]);
 useEffect(()=>()=>{operationRef.current++;workerRef.current?.terminate();workerRef.current=null},[]);
 const proposals=records.proposals.filter(p=>p.source_id===referenceId&&p.status==="pending"&&p.model==="local-multilingual-embeddings");
 const prior=records.proposals.filter(p=>p.status!=="pending"&&p.model==="local-multilingual-embeddings");
 const analyzed=records.vectors.some(v=>v.reference_id===referenceId&&v.source_hash===localHash(localText(items.find(i=>i.id===referenceId)||{id:referenceId,title:""})));
 const cancel=()=>{operationRef.current++;workerRef.current?.terminate();workerRef.current=null;setRunning(false);setStatus("Análisis cancelado");};
 const saveMatches=async(vectors:LocalVector[],generation:number,decisions:LocalDecision[])=>{
  if(generation!==operationRef.current)return;
  const source=items.find(i=>i.id===referenceId);if(!source)throw Error("Referencia no disponible");
  const vectorMap=new Map(vectors.map(v=>[v.reference_id,v.embedding]));
  const ranked=localSuggestions(source,items,vectorMap,decisions,distance);
  if(!ranked.length){setStatus("No he encontrado conexiones suficientemente sólidas entre estas referencias.");return}
  const result=await post("/api/references/local",{action:"suggestions",source_id:source.id,proposals:ranked.map(row=>({target_id:row.item.id,relation:row.relation,explanation:row.explanation,distance:row.distance}))});
  if(generation!==operationRef.current)return;
  await refresh();
  setStatus(result.saved?result.saved+" conexiones sugeridas. Decide cuáles merecen quedarse.":"No hay propuestas nuevas. Las ya aceptadas o rechazadas se respetan.");
 };
 const analyze=async()=>{
  setError("");setStatus("");setProgress(0);setRunning(true);
  const generation=++operationRef.current;
  try{
   const fresh=await refresh();if(generation!==operationRef.current)return;
   const valid=new Map<string,LocalVector>();
   for(const row of fresh.vectors)if(row.model==="paraphrase-multilingual-MiniLM-L12-v2-q8")valid.set(row.reference_id,row);
   const queue=items.slice(0,150).map(i=>({...i,text:localText(i),source_hash:localHash(localText(i))})).filter(i=>valid.get(i.id)?.source_hash!==i.source_hash);
   const complete=fresh.vectors.filter(v=>v.model==="paraphrase-multilingual-MiniLM-L12-v2-q8");
   if(!queue.length){setStatus("Comparando las referencias ya analizadas...");await saveMatches(complete,generation,fresh.proposals);return}
   setStatus("Iniciando modelo local. La primera descarga puede superar los 100 MB...");
   const worker=new Worker("/workers/reference-local-model.js",{type:"module"});
   workerRef.current=worker;
   await new Promise<void>((resolve,reject)=>{
    worker.onmessage=async e=>{
     if(generation!==operationRef.current){resolve();return}
     const msg=e.data||{};
     if(msg.type==="status")setStatus(String(msg.message||"Preparando modelo..."));
     else if(msg.type==="download")setStatus("Descargando modelo al navegador: "+msg.value+"%");
     else if(msg.type==="progress"){setProgress(Math.round(msg.value/msg.total*100));setStatus("Analizando descripciones "+msg.value+" / "+msg.total+" en tu dispositivo...");}
     else if(msg.type==="error"){reject(Error(msg.error||"El navegador no puede ejecutar este modelo"));}
     else if(msg.type==="result"){
      try{
       const newVectors=(msg.vectors||[]) as LocalVector[];
       setStatus("Guardando memoria semántica en Supabase...");
       for(let index=0;index<newVectors.length;index+=30){
        await post("/api/references/local",{action:"embeddings",vectors:newVectors.slice(index,index+30)});
       }
       await saveMatches([...complete.filter(v=>!newVectors.some(n=>n.reference_id===v.reference_id)),...newVectors],generation,fresh.proposals);
       resolve();
      }catch(err){reject(err)}
     }
    };
    worker.onerror=e=>reject(Error(e.message||"Error del motor local"));
    worker.postMessage({type:"embed",id:generation,items:queue});
   });
  }catch(e){
   if(generation===operationRef.current)setError(e instanceof Error?e.message:"El motor local no ha podido completar el análisis");
  }finally{if(generation===operationRef.current){setRunning(false);workerRef.current?.terminate();workerRef.current=null}}
 };
 const vote=async(s:Suggestion,status:"accepted"|"rejected")=>{
  setVoting(s.id);setError("");
  try{
   await post("/api/references/ai",{id:s.id,status},"PATCH");
   await refresh();if(status==="accepted")onUpdate();
  }catch(e){setError(e instanceof Error?e.message:"Error de feedback")}finally{setVoting(null)}
 };
 const mode=distance<35?"Directa":distance<70?"Asociativa":"Experimental";
 const modeHint=distance<35?"Prioriza similitudes evidentes de concepto o temática.":distance<70?"Equilibra semejanzas y asociaciones menos obvias.":"Favorece analogías más lejanas, sin garantizar que todas sean útiles.";
 return <section className="ri-panel ri-local" aria-label="Inteligencia de referencias">
  <header className="ri-local-head">
   <div className="ri-heading"><span className="ri-icon"><BrainCircuit size={19}/></span><div><strong>Reference Intelligence</strong><small>Asociaciones entre referencias</small></div></div>
   <span className="ri-local-badge"><span/> Local · gratis</span>
  </header>
  <p className="ri-local-intro">Encuentra relaciones entre ideas, títulos y notas. También incorpora los conceptos visuales que hayas confirmado.</p>
  <div className="ri-distance-box">
   <div className="ri-distance-top"><label htmlFor="ri-local-distance">Distancia creativa</label><output htmlFor="ri-local-distance">{mode}</output></div>
   <p className="ri-distance-description">{modeHint}</p>
   <input id="ri-local-distance" className="ri-range" type="range" min="0" max="100" value={distance} style={{"--ri-fill":distance+"%"} as React.CSSProperties} disabled={running} onChange={e=>setDistance(Number(e.target.value))}/>
   <div className="ri-distance-scale"><span>Directa</span><span>Asociativa</span><span>Experimental</span></div>
   <small className="ri-distance-footnote">Se aplica en la siguiente búsqueda. No cambia conexiones guardadas.</small>
  </div>
  {running?<button className="ri-cta ri-cancel" onClick={cancel} type="button"><X size={16}/> Cancelar búsqueda</button>:<button className="ri-cta" onClick={analyze} type="button"><Sparkles size={17}/>{analyzed?"Buscar nuevas conexiones":"Descubrir conexiones"}</button>}
  {running&&<div className="ri-progress" role="progressbar" aria-label="Progreso del análisis" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:progress+"%"}}/></div>}
  {status&&<p className="ri-status" role="status">{running&&<Loader2 size={15} className="ri-spin"/>}{status}</p>}
  {error&&<p className="ri-error" role="alert">{error}</p>}
  {proposals.length>0&&<div className="ri-results">
   <div className="ri-results-header"><span>CONEXIONES PROPUESTAS</span><b>{proposals.length}</b></div>
   {proposals.map(s=>{const other=items.find(i=>i.id===s.target_id);if(!other)return null;return <article className="ri-proposal" key={s.id}>
    <strong>{other.title}</strong><span className="ri-proposal-relation">{s.relation}</span><p>{s.explanation}</p>
    <div className="ri-actions">
     <button className="ri-accept" onClick={()=>vote(s,"accepted")} disabled={!!voting||running}><ThumbsUp size={14}/> Conecta</button>
     <button className="ri-reject" onClick={()=>vote(s,"rejected")} disabled={!!voting||running}><ThumbsDown size={14}/> No conecta</button>
    </div>
   </article>})}
  </div>}
  <details className="ri-explain">
   <summary><span><Info size={15}/> Cómo funciona y qué guarda</span><ChevronDown size={16}/></summary>
   <div className="ri-explain-body">
    <p><b>1. Compara.</b> Convierte los textos en vectores de significado con un modelo multilingüe local. Analiza hasta 150 referencias por ejecución.</p>
    <p><b>2. Propone.</b> La distancia creativa cambia el tipo de semejanzas que prioriza. No analiza vídeos completos ni busca automáticamente referencias externas.</p>
    <p><b>3. Aprende de ti.</b> «Conecta» guarda una relación; «No conecta» descarta esa pareja. Ambas decisiones influyen ligeramente en próximas propuestas.</p>
    <p className="ri-private-note">Primera vez: descarga aproximada de 120 MB o más. El cálculo se realiza en este navegador; Supabase conserva vectores y decisiones, no los archivos visuales.</p>
   </div>
  </details>
 </section>;
}
