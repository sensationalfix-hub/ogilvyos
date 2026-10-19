"use client";

import { useEffect, useState } from "react";
import { BookImage, ChevronRight, Clapperboard, Gamepad2, LoaderCircle, Plus, Search, X } from "lucide-react";
import styles from "./culture-catalog.module.css";

export type MediaType = "videojuego" | "película" | "serie";
export type MediaMatch = {
 id:string;type:MediaType;title:string;year:string|null;image:string|null;
 fallbackImage:string|null;description:string;genres:string[];platforms:string[];
 rating:number|null;ratingLabel:string|null;source:string;sourceUrl:string;
};
const types:{id:MediaType;label:string;icon:typeof Gamepad2}[]=[
 {id:"videojuego",label:"Videojuegos",icon:Gamepad2},
 {id:"película",label:"Películas",icon:Clapperboard},
 {id:"serie",label:"Series",icon:BookImage},
];
const trustedImage=(value:string|null):string|null=>{
 if(!value)return null;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&[
   "upload.wikimedia.org","image.tmdb.org","static.tvmaze.com",
   "media.rawg.io","shared.fastly.steamstatic.com","cdn.cloudflare.steamstatic.com",
   "steamcdn-a.akamaihd.net"].includes(u.hostname)?u.href:null;
 }catch{return null;}
};
export function readMediaMatch(value:unknown):MediaMatch|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const item=value as Partial<MediaMatch>;
 if(typeof item.id!=="string"||typeof item.title!=="string")return null;
 const type=types.some(x=>x.id===item.type)?item.type as MediaType:"videojuego";
 return {
  id:item.id.slice(0,160),type,title:item.title.slice(0,220),
  year:typeof item.year==="string"?item.year:null,
  image:trustedImage(typeof item.image==="string"?item.image:null),
  fallbackImage:trustedImage(typeof item.fallbackImage==="string"?item.fallbackImage:null),
  description:typeof item.description==="string"?item.description.slice(0,1200):"",
  genres:Array.isArray(item.genres)?item.genres.filter((x):x is string=>typeof x==="string").slice(0,10):[],
  platforms:Array.isArray(item.platforms)?item.platforms.filter((x):x is string=>typeof x==="string").slice(0,15):[],
  rating:typeof item.rating==="number"&&Number.isFinite(item.rating)?item.rating:null,
  ratingLabel:typeof item.ratingLabel==="string"?item.ratingLabel:null,
  source:typeof item.source==="string"?item.source:"",
  sourceUrl:typeof item.sourceUrl==="string"&&item.sourceUrl.startsWith("https://")?item.sourceUrl:"",
 };
}
export function MediaPoster({item,className="",alt=""}:{item:MediaMatch|null;className?:string;alt?:string}){
 const [fallback,setFallback]=useState(false);
 const image=item?(fallback?item.fallbackImage:item.image):null;
 useEffect(()=>setFallback(false),[item?.id,item?.image]);
 return <div className={styles.poster+" "+className}>
  {image?<img alt={alt||item?.title||""} loading="lazy" src={image} onError={()=>setFallback(true)}/>:<span className={styles.posterFallback}><Gamepad2 size={28}/></span>}
 </div>;
}
type Props={
 open:boolean;
 onClose:()=>void;
 onSelect:(match:MediaMatch)=>void;
 onManual:()=>void;
 existing:MediaMatch[];
};
export function CultureCatalog({open,onClose,onSelect,onManual,existing}:Props){
 const [type,setType]=useState<MediaType>("videojuego");
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<MediaMatch[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [searched,setSearched]=useState(false);
 useEffect(()=>{
  if(!open){setQuery("");setResults([]);setSearched(false);setError("");setType("videojuego");}
 },[open]);
 useEffect(()=>{
  if(!open||query.trim().length<2){setResults([]);setLoading(false);setSearched(false);setError("");return;}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setError("");setSearched(false);
   try{
    const r=await fetch("/api/life/catalog?q="+encodeURIComponent(query.trim())+"&type="+encodeURIComponent(type),{signal:controller.signal,cache:"no-store"});
    const body=await r.json().catch(()=>({})) as {results?:unknown[];error?:string};
    if(!r.ok)throw new Error(body.error||"Error al buscar");
    if(!controller.signal.aborted){setResults((body.results||[]).map(readMediaMatch).filter((x):x is MediaMatch=>Boolean(x)));setSearched(true);}
   }catch(e){
    if(!controller.signal.aborted){setError(e instanceof Error?e.message:"Error de búsqueda");setResults([]);setSearched(true);}
   }finally{if(!controller.signal.aborted)setLoading(false);}
  },480);
  return ()=>{controller.abort();clearTimeout(timer);};
 },[query,type,open]);
 useEffect(()=>{
  if(!open)return;
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
  document.addEventListener("keydown",esc);
  return ()=>document.removeEventListener("keydown",esc);
 },[open,onClose]);
 if(!open)return null;
 return <div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Buscar en el catálogo cultural">
   <header className={styles.top}>
    <div><span>CATÁLOGO CULTURAL</span><h2>¿Qué quieres guardar?</h2></div>
    <button type="button" aria-label="Cerrar buscador" onClick={onClose}><X size={21}/></button>
   </header>
   <div className={styles.findBar}>
    <div className={styles.typeTabs}>{types.map(({id,label,icon:Icon})=><button type="button" key={id} className={id===type?styles.selected:""} onClick={()=>setType(id)}><Icon size={16}/>{label}</button>)}</div>
    <label className={styles.searchBox}><Search size={21}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={type==="videojuego"?"Busca Zelda, Resident Evil, Hollow Knight…":type==="película"?"Busca una película por título…":"Busca una serie…"} aria-label="Buscar título"/>{loading&&<LoaderCircle className={styles.spin} size={18}/>}</label>
   </div>
   <div className={styles.resultPane}>
    {query.trim().length<2?<div className={styles.blank}><Search size={28}/><h3>Busca y añade, sin picar fichas a mano.</h3><p>La portada y la información se guardarán en tu biblioteca. Tus notas y tu progreso seguirán siendo tuyos.</p></div>:
    loading&&!results.length?<div className={styles.blank}><LoaderCircle className={styles.spin} size={28}/><p>Buscando títulos…</p></div>:
    error?<div className={styles.blank}><p>{error}</p></div>:
    searched&&!results.length?<div className={styles.blank}><BookImage size={29}/><h3>No hay coincidencias claras</h3><p>Prueba otro nombre, o añádelo manualmente.</p></div>:
    <div className={styles.results}>{results.map(item=>{
      const stored=existing.some(x=>x.id===item.id);
      return <button type="button" className={styles.result} key={item.id} onClick={()=>onSelect(item)}>
       <MediaPoster item={item}/>
       <div className={styles.resultCopy}><div className={styles.resultTitle}><h3>{item.title}</h3>{stored&&<span className={styles.saved}>EN BIBLIOTECA</span>}</div>
        <span className={styles.meta}>{[item.year,item.genres.slice(0,2).join(" · "),item.platforms.slice(0,2).join(", ")].filter(Boolean).join(" · ")||"Ficha de "+item.source}</span>
        <p>{item.description||"Portada y datos del catálogo. Puedes completar tu valoración y progreso después."}</p>
        <span className={styles.source}>Fuente: {item.source}{item.rating!==null?" · "+item.rating+" "+(item.ratingLabel||""):""}</span>
       </div><ChevronRight size={17} className={styles.chevron}/>
      </button>;
    })}</div>}
   </div>
   <footer className={styles.foot}><span>Fuentes: Steam, Wikipedia y TVmaze. Las fichas muestran su procedencia.</span><button type="button" onClick={onManual}><Plus size={15}/> Añadir manualmente</button></footer>
  </section>
 </div>;
}
