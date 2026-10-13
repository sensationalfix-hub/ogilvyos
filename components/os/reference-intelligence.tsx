"use client";
import {useState,useEffect,useCallback} from "react";
import {Sparkles,Loader2,ThumbsUp,ThumbsDown} from "lucide-react";
type Insight={reference_id:string;summary:string;themes:string[];visual_language:string[];narrative:string;creative_mechanism:string};
type Suggestion={id:string;source_id:string;target_id:string;relation:string;explanation:string;status:string};
export function ReferenceIntelligence({referenceId,items,onUpdate}:{referenceId:string;items:{id:string;title:string}[];onUpdate:()=>void}){
 const [insight,setInsight]=useState<Insight|null>(null);
 const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
 const [distance,setDistance]=useState(55);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  try{const r=await fetch("/api/references/ai",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);
  setInsight((d.insights||[]).find((x:Insight)=>x.reference_id===referenceId)||null);
  setSuggestions((d.suggestions||[]).filter((s:Suggestion)=>s.source_id===referenceId&&s.status==="pending"));}
  catch(e){setError(e instanceof Error?e.message:"No se pudo cargar IA")}
 },[referenceId]);
 useEffect(()=>{setInsight(null);setSuggestions([]);setError("");refresh()},[refresh]);
 const analyze=async()=>{setLoading(true);setError("");try{
 const r=await fetch("/api/references/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference_id:referenceId,distance})});const d=await r.json();if(!r.ok)throw Error(d.error||"Error de IA");await refresh();
 }catch(e){setError(e instanceof Error?e.message:"Error de análisis")}finally{setLoading(false)}};
 const decide=async(id:string,status:"accepted"|"rejected")=>{setLoading(true);setError("");try{
 const r=await fetch("/api/references/ai",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw Error(d.error);await refresh();if(status==="accepted")onUpdate();
 }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar")}finally{setLoading(false)}};
 return <section className="ri-panel">
  <div className="ri-heading"><span className="ri-icon"><Sparkles size={18}/></span><div><strong>Reference Intelligence</strong><small>Conexiones con criterio creativo</small></div></div>
  {insight&&<div className="ri-summary"><p>{insight.summary}</p>{insight.creative_mechanism&&<small><b>Mecanismo:</b> {insight.creative_mechanism}</small>}{insight.narrative&&<small><b>Narrativa:</b> {insight.narrative}</small>}
   <div className="ri-tags">{insight.themes?.map(t=><span key={t}>{t}</span>)}</div></div>}
  <div className="ri-distance"><label htmlFor="ri-range">Distancia creativa</label><span>{distance<35?"Directa":distance<70?"Asociativa":"Experimental"}</span></div>
  <input id="ri-range" className="ri-range" type="range" min="0" max="100" value={distance} onChange={e=>setDistance(Number(e.target.value))}/>
  <div className="ri-hints"><span>Más literal</span><span>Más inesperada</span></div>
  <button className="ri-cta" disabled={loading} onClick={analyze}>{loading?<Loader2 size={15} className="ri-spin"/>:<Sparkles size={15}/>} {loading?"Analizando...":insight?"Explorar nuevas conexiones":"Analizar con IA"}</button>
  {!!suggestions.length&&<h4 className="ri-subtitle">CONEXIONES PROPUESTAS</h4>}
  {suggestions.map(s=>{const match=items.find(i=>i.id===s.target_id);return match?<div className="ri-proposal" key={s.id}><b>{match.title}</b><span>{s.relation}</span><p>{s.explanation}</p><div className="ri-actions"><button disabled={loading} onClick={()=>decide(s.id,"accepted")}><ThumbsUp size={13}/> Conecta</button><button disabled={loading} onClick={()=>decide(s.id,"rejected")}><ThumbsDown size={13}/> No conecta</button></div></div>:null})}
  {error&&<p className="ri-error" role="alert">{error}</p>}
  <small className="ri-footer">Las relaciones son hipótesis. Solo se convierten en conexiones guardadas al aceptarlas.</small>
 </section>;
}
