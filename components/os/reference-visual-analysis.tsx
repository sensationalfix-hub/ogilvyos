"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, ImagePlus, Loader2, RefreshCcw, Sparkles, X } from "lucide-react";
import { VISUAL_LABELS, VISUAL_TAG_PREFIX } from "@/app/lib/reference-visual-vocabulary";

type ReferenceAsset={
 id:string;url:string|null;image_url:string|null;media_path:string|null;kind:string;auto_tags:string[];
};
type Concept={id:string;name:string;group:string;score:number};
type ModelMessage={type:string;id?:number;concepts?:Concept[];value?:number;total?:number;message?:string;error?:string};
const isVideo=(url:string)=>/\.(mp4|webm|m4v)(?:$|[?#])/i.test(url);
const withTimeout=<T,>(promise:Promise<T>,time:number,label:string)=>new Promise<T>((resolve,reject)=>{
 const timer=window.setTimeout(()=>reject(Error(label)),time);
 promise.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});
});
function awaitMedia(el:HTMLVideoElement,type:string,timeout=11000){
 return withTimeout(new Promise<void>((resolve,reject)=>{
  const finished=()=>{el.removeEventListener(type,ok);el.removeEventListener("error",fail);};
  const ok=()=>{finished();resolve()};
  const fail=()=>{finished();reject(Error("No se pudo cargar el vídeo."))};
  el.addEventListener(type,ok,{once:true});el.addEventListener("error",fail,{once:true});
 }),timeout,"Tiempo de espera agotado al leer el vídeo.");
}
async function prepareImage(blob:Blob):Promise<Blob>{
 if(!blob.type.startsWith("image/"))throw Error("La fuente no es una imagen.");
 const image=await createImageBitmap(blob);
 try{
  const max=768,ratio=Math.min(1,max/Math.max(image.width,image.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(image.width*ratio));
  canvas.height=Math.max(1,Math.round(image.height*ratio));
  const context=canvas.getContext("2d");
  if(!context)throw Error("Canvas no disponible");
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(output=>output?resolve(output):reject(Error("No se pudo preparar la imagen")),"image/jpeg",.85));
 }finally{image.close()}
}
async function videoFrames(source:string):Promise<Blob[]>{
 const player=document.createElement("video");
 player.crossOrigin="anonymous";player.muted=true;player.playsInline=true;player.preload="auto";
 try{
  player.src=source;
  const ready=awaitMedia(player,"loadedmetadata");
  player.load();
  await ready;
  if(!Number.isFinite(player.duration)||player.duration<=0)throw Error("Este vídeo no permite extraer fotogramas.");
  const samples=[Math.max(.1,player.duration*.24),Math.max(.3,player.duration*.73)];
  const result:Blob[]=[];
  for(const target of samples){
   const seek=awaitMedia(player,"seeked");
   player.currentTime=Math.min(player.duration-.02,target);
   await seek;
   const canvas=document.createElement("canvas");
   const scale=Math.min(1,768/Math.max(1,player.videoWidth,player.videoHeight));
   canvas.width=Math.max(1,Math.round(player.videoWidth*scale));
   canvas.height=Math.max(1,Math.round(player.videoHeight*scale));
   const context=canvas.getContext("2d");if(!context)throw Error("No se pudo preparar un fotograma");
   try{context.drawImage(player,0,0,canvas.width,canvas.height)}
   catch{throw Error("El servidor del vídeo no permite leer sus fotogramas (CORS).")}
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error("No se pudo extraer el fotograma")),"image/jpeg",.82));
   result.push(blob);
  }
  return result;
 }finally{player.pause();player.removeAttribute("src");player.load()}
}
async function sourceFrames(item:ReferenceAsset):Promise<{frames:Blob[];origin:string}>{
 const url=item.url||"";
 if(isVideo(url)){
  try{return {frames:await videoFrames(url),origin:"dos fotogramas del MP4"}}
  catch{ /* use poster as fallback if available, label honestly */ }
 }
 const source=item.media_path?"/api/references/media?path="+encodeURIComponent(item.media_path):item.image_url||(
  url.startsWith("https://")&&/\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(url)?url:null
 );
 if(!source)throw Error("Esta referencia no ofrece una imagen legible. Selecciona una captura o un archivo local para analizarlo.");
 let response:Response;
 try{response=await fetch(source,{cache:"no-store",mode:"cors"})}
 catch{throw Error("La fuente bloquea el acceso a su imagen (CORS). Prueba a elegir una captura local.");}
 if(!response.ok)throw Error("No se pudo descargar la imagen de la referencia.");
 const body=await response.blob();
 if(body.size>12*1024*1024)throw Error("La imagen supera 12 MB. Selecciona una captura más pequeña.");
 return {frames:[await prepareImage(body)],origin:item.kind==="video"?"miniatura del vídeo (no sus fotogramas)":"imagen de la referencia"};
}
async function fileFrames(file:File):Promise<{frames:Blob[];origin:string}>{
 if(file.size>120*1024*1024)throw Error("El archivo supera 120 MB; elige una captura más pequeña.");
 if(file.type.startsWith("image/"))return {frames:[await prepareImage(file)],origin:"imagen local"};
 if(file.type.startsWith("video/")){
  const url=URL.createObjectURL(file);
  try{return {frames:await videoFrames(url),origin:"dos fotogramas del vídeo local"}}
  finally{URL.revokeObjectURL(url)}
 }
 throw Error("Solo imágenes y vídeos MP4/WebM compatibles.");
}

export function ReferenceVisualAnalysis({item,onUpdate}:{
 item:ReferenceAsset;onUpdate:()=>void;
}){
 const [running,setRunning]=useState(false);
 const [saving,setSaving]=useState(false);
 const [status,setStatus]=useState("");
 const [error,setError]=useState("");
 const [origin,setOrigin]=useState("");
 const [proposed,setProposed]=useState<Concept[]>([]);
 const [chosen,setChosen]=useState<string[]>([]);
 const [download,setDownload]=useState<number|null>(null);
 const worker=useRef<Worker|null>(null);
 const generation=useRef(0);
 const fileRef=useRef<HTMLInputElement>(null);
 const saved=(item.auto_tags||[]).filter(tag=>tag.startsWith(VISUAL_TAG_PREFIX)).map(tag=>tag.slice(VISUAL_TAG_PREFIX.length));
 useEffect(()=>()=>{
  generation.current++;
  worker.current?.terminate();
  worker.current=null;
 },[item.id]);
 const stop=()=>{generation.current++;worker.current?.terminate();worker.current=null;setRunning(false);setStatus("Análisis cancelado.");};
 const analyze=async(file?:File)=>{
  if(running||saving)return;
  setRunning(true);setError("");setStatus("Preparando imágenes en este dispositivo...");setDownload(null);setProposed([]);
  const current=++generation.current;
  try{
   const prepared=await (file?fileFrames(file):sourceFrames(item));
   if(current!==generation.current)return;
   setOrigin(prepared.origin);
   setStatus("Analizando composición, iluminación, estilo y motivos...");
   const w=new Worker("/workers/reference-visual-model.js",{type:"module"});worker.current=w;
   await new Promise<void>((resolve,reject)=>{
    w.onmessage=event=>{
     if(current!==generation.current){resolve();return}
     const msg=event.data as ModelMessage;
     if(msg.type==="status"&&msg.message)setStatus(msg.message);
     if(msg.type==="download"&&typeof msg.value==="number")setDownload(msg.value);
     if(msg.type==="progress")setStatus("Analizando imagen "+msg.value+" / "+msg.total+"...");
     if(msg.type==="error")reject(Error(msg.error||"Error al cargar el modelo visual"));
     if(msg.type==="result"){
      const result=msg.concepts||[];
      setProposed(result);
      setChosen(result.map(x=>x.id));
      setStatus(result.length?"Revisa los conceptos propuestos antes de guardarlos.":"No se han detectado pistas visuales suficientemente claras.");
      resolve();
     }
    };
    w.onerror=event=>reject(Error(event.message||"No se pudo ejecutar el modelo visual"));
    w.postMessage({type:"analyze",id:current,frames:prepared.frames,labels:VISUAL_LABELS});
   });
  }catch(e){if(current===generation.current){setError(e instanceof Error?e.message:"Error al analizar la imagen");setStatus("")}}
  finally{if(current===generation.current){worker.current?.terminate();worker.current=null;setRunning(false)}}
 };
 const persist=async()=>{
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/references",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,visual_labels:chosen})});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||"No se guardaron los conceptos");
   setProposed([]);setStatus("Conceptos visuales guardados. Ya puedes buscar relaciones con el motor local.");
   onUpdate();
  }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar")}
  finally{setSaving(false)}
 };
 const choose=(id:string)=>setChosen(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
 return <section className="rv-panel">
  <div className="rv-head"><span className="rv-icon"><Eye size={17}/></span><div><strong>Lectura visual</strong><small>CLIP local · sin IA de pago</small></div></div>
  <p className="rv-explanation">Busca pistas de composición, luz, estilo y motivos visibles. Son hipótesis del modelo, no descripciones confirmadas de la obra.</p>
  {saved.length>0&&<div className="rv-existing"><small>CONCEPTOS VISUALES GUARDADOS</small><div>{saved.map(id=><span key={id}>{VISUAL_LABELS.find(x=>x.id===id)?.name||id.replace(/-/g," ")}</span>)}</div></div>}
  {proposed.length>0&&<div className="rv-proposals"><small>PROPUESTAS A REVISAR · {origin}</small><div>{proposed.map(concept=><button type="button" key={concept.id} className={chosen.includes(concept.id)?"active":""} aria-pressed={chosen.includes(concept.id)} onClick={()=>choose(concept.id)}>{chosen.includes(concept.id)&&<Check size={12}/>} {concept.name}</button>)}</div></div>}
  {running?<button className="rv-action rv-cancel" onClick={stop} type="button"><X size={15}/> Cancelar análisis</button>:
    <button className="rv-action" disabled={saving} onClick={()=>analyze()} type="button">{saving?<Loader2 className="rv-spin" size={15}/>:saved.length?<RefreshCcw size={15}/>:<Sparkles size={15}/>} {saved.length?"Volver a analizar":"Analizar referencia"}</button>}
  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="rv-file" aria-label="Elegir archivo local para analizar" onChange={event=>{const file=event.target.files?.[0];if(file)analyze(file);event.target.value=""}}/>
  <button className="rv-upload" type="button" disabled={running||saving} onClick={()=>fileRef.current?.click()}><ImagePlus size={14}/> Analizar archivo o captura local</button>
  {proposed.length>0&&!running&&<button className="rv-apply" type="button" disabled={saving||chosen.length>8} onClick={persist}>{saving?<Loader2 size={14} className="rv-spin"/>:<Check size={14}/>} Guardar {chosen.length} conceptos</button>}
  {status&&<p className="rv-status">{status}{download!==null&&running?" · "+download+"%":""}</p>}
  {error&&<p className="rv-error" role="alert">{error}</p>}
  <small className="rv-foot">Se ejecuta en el navegador. El modelo puede ocupar bastante memoria y descargar archivos grandes la primera vez. No se suben imágenes para la inferencia; solo los conceptos que confirmes se guardan en Supabase. Los vídeos de plataformas cerradas pueden limitarse a su miniatura.</small>
 </section>;
}
