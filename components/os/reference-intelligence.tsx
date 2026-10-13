"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {BrainCircuit,Check,Loader2,Sparkles,ThumbsDown,ThumbsUp,X} from "lucide-react";
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
 const saveMatches=async(vectors:LocalVector[],generation:number)=>{
  if(generation!==operationRef.current)return;
  const source=items.find(i=>i.id===referenceId);if(!source)throw Error("Referencia no disponible");
  const vectorMap=new Map(vectors.map(v=>[v.reference_id,v.embedding]));
  const ranked=localSuggestions(source,items,vectorMap,records.proposals,distance);
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
   if(!queue.length){setStatus("Comparando las referencias ya analizadas...");await saveMatches(complete,generation);return}
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
       await saveMatches([...complete.filter(v=>!newVectors.some(n=>n.reference_id===v.reference_id)),...newVectors],generation);
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
 return <section className="ri-panel ri-local">
  <div className="ri-heading"><span className="ri-icon"><BrainCircuit size={17}/></span><div><strong>Reference Intelligence</strong><small>Modelo multilingüe local · sin inferencia de pago</small></div></div>
  <div className="ri-local-note">Compara títulos y notas por significado, no por coincidencia literal. La IA se ejecuta en este dispositivo. Por ahora no analiza el contenido de los vídeos ni reconoce objetos de las imágenes.</div>
  <div className="ri-distance"><label htmlFor="ri-local-distance">Distancia creativa</label><span>{distance<35?"Directa":distance<70?"Asociativa":"Experimental"}</span></div>
  <input id="ri-local-distance" className="ri-range" type="range" min="0" max="100" value={distance} disabled={running} onChange={e=>setDistance(Number(e.target.value))}/>
  <div className="ri-hints"><span>Más literal</span><span>Más inesperada</span></div>
  {running?<button className="ri-cta ri-cancel" onClick={cancel} type="button"><X size={15}/> Cancelar análisis</button>:
   <button className="ri-cta" onClick={analyze} type="button"><Sparkles size={15}/>{analyzed?"Buscar otras conexiones":"Descubrir conexiones gratis"}</button>}
  {running&&<div className="ri-progress"><div style={{width:progress+"%"}}/></div>}
  {status&&<p className="ri-status" role="status">{running&&<Loader2 size={13} className="ri-spin"/>}{status}</p>}
  {proposals.length>0&&<h4 className="ri-subtitle">CONEXIONES PARA TI · {proposals.length}</h4>}
  {proposals.map(s=>{const other=items.find(i=>i.id===s.target_id);if(!other)return null;return <div className="ri-proposal" key={s.id}><b>{other.title}</b><span>{s.relation}</span><p>{s.explanation}</p><div className="ri-actions"><button onClick={()=>vote(s,"accepted")} disabled={!!voting||running}><ThumbsUp size={13}/> Conecta</button><button onClick={()=>vote(s,"rejected")} disabled={!!voting||running}><ThumbsDown size={13}/> No conecta</button></div></div>})}
  {error&&<p className="ri-error" role="alert">{error}</p>}
  <small className="ri-footer">Primera vez: descarga aproximada de 120 MB o más, según archivos auxiliares. El modelo queda en la caché del navegador si está disponible. Tu contenido se calcula localmente; solo se sincronizan vectores y decisiones en Supabase.</small>
 </section>;
}
