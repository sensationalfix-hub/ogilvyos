"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Film, Image as ImageIcon, LibraryBig, Link2, Loader2, Music2, Search, X } from "lucide-react";

export type LibraryReference = {
 id:string; title:string; url:string|null; image_url:string|null; media_path:string|null;
 kind:"image"|"video"|"audio"|"web"|"other"; site:string|null;
 notes:string; auto_tags:string[]; collection_id:string|null;
};
type Collection={id:string;name:string};
type LibraryData={items:LibraryReference[];collections:Collection[]};

function normalize(value:string) {
 return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function thumb(item:LibraryReference) {
 if(item.media_path && item.kind!=="video")return "/api/references/media?path="+encodeURIComponent(item.media_path);
 if(item.image_url)return item.image_url;
 if(item.url){
  try{
   const url=new URL(item.url);
   const host=url.hostname.replace(/^www\./,"");
   const id=host==="youtu.be"?url.pathname.split("/")[1]:
    ["youtube.com","m.youtube.com","youtube-nocookie.com"].includes(host)?url.searchParams.get("v")||url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]:null;
   if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return "https://img.youtube.com/vi/"+id+"/hqdefault.jpg";
   if(/\.(?:png|jpe?g|webp|gif|avif)$/i.test(url.pathname))return item.url;
  }catch{}
 }
 return null;
}
function LibraryThumb({item}:{item:LibraryReference}) {
 const [failed,setFailed]=useState(false);
 const image=thumb(item);
 if(image&&!failed)return <img className="cl-lib-thumb" src={image} loading="lazy" alt="" onError={()=>setFailed(true)}/>;
 const Icon=item.kind==="video"?Film:item.kind==="audio"?Music2:item.kind==="image"?ImageIcon:Link2;
 return <div className="cl-lib-thumb cl-lib-placeholder"><Icon size={25} strokeWidth={1.5}/></div>;
}

export function LibraryPicker({open,onClose,onAdd,existingIds,existingLinks,capacity}:{
 open:boolean;onClose:()=>void;onAdd:(items:LibraryReference[])=>void;
 existingIds:string[];existingLinks:string[];capacity:number;
}) {
 const [data,setData]=useState<LibraryData>({items:[],collections:[]});
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [collection,setCollection]=useState("all");
 const [chosen,setChosen]=useState<string[]>([]);
 const searchRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  setQuery("");setCollection("all");setChosen([]);setError("");setLoading(true);
  fetch("/api/references",{cache:"no-store",signal:controller.signal})
   .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"No se pudo cargar Library");return body as LibraryData})
   .then(result=>{if(!controller.signal.aborted)setData({items:result.items||[],collections:result.collections||[]})})
   .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"No se pudo cargar Library")})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  const timer=window.setTimeout(()=>searchRef.current?.focus(),60);
  return()=>{controller.abort();window.clearTimeout(timer)};
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose()}};
  document.addEventListener("keydown",onKey,true);
  return()=>document.removeEventListener("keydown",onKey,true);
 },[open,onClose]);
 const present=useMemo(()=>new Set([...existingIds.map(x=>"id:"+x),...existingLinks.map(x=>"link:"+x)]),[existingIds,existingLinks]);
 const already=(item:LibraryReference)=>present.has("id:"+item.id) || (!!item.url&&present.has("link:"+item.url)) || (!!item.media_path&&present.has("link:"+item.media_path));
 const filtered=useMemo(()=>{
  const q=normalize(query.trim());
  return data.items.filter(item=>(collection==="all"||item.collection_id===collection||collection==="none"&&!item.collection_id)&&(!q||normalize([item.title,item.site||"",item.notes,...(item.auto_tags||[])].join(" ")).includes(q)));
 },[data.items,collection,query]);
 const validSelected=chosen.filter(id=>data.items.some(item=>item.id===id&&!already(item)));
 const atLimit=validSelected.length>=capacity;
 const toggle=(item:LibraryReference)=>{
  if(already(item))return;
  setChosen(curr=>curr.includes(item.id)?curr.filter(x=>x!==item.id):curr.length>=capacity?curr:[...curr,item.id]);
 };
 const submit=()=>{
  const selected=validSelected.map(id=>data.items.find(item=>item.id===id)).filter((item):item is LibraryReference=>Boolean(item));
  if(!selected.length)return;
  onAdd(selected);
  onClose();
 };
 if(!open)return null;
 return <div className="cl-lib-backdrop" onPointerDown={event=>event.stopPropagation()} onClick={event=>{if(event.currentTarget===event.target)onClose()}}>
  <section className="cl-lib-dialog" role="dialog" aria-modal="true" aria-label="Añadir referencias desde Library">
   <header className="cl-lib-head">
    <div className="cl-lib-heading">
     <span className="cl-lib-eyebrow"><LibraryBig size={13}/> REFERENCE LIB / CREATIVE LAB</span>
     <h2>Añadir desde Library<span>.</span></h2>
     <p>Elige las referencias de tu biblioteca que quieres colocar en este mapa.</p>
    </div>
    <button type="button" className="cl-lib-close" aria-label="Cerrar biblioteca" onClick={onClose}><X size={19}/></button>
   </header>
   <div className="cl-lib-tools">
    <label className="cl-lib-search"><Search size={17}/><input ref={searchRef} placeholder="Buscar campañas, imágenes, vídeos, ideas..." aria-label="Buscar en Library" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <select aria-label="Filtrar por colección" value={collection} onChange={event=>setCollection(event.target.value)}>
     <option value="all">Todas las colecciones</option>
     <option value="none">Sin colección</option>
     {data.collections.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
    </select>
   </div>
   <div className="cl-lib-results" aria-live="polite">
    {loading?<div className="cl-lib-empty"><Loader2 className="cl-lib-spinner" size={25}/> Cargando tu biblioteca…</div>:
     error?<div className="cl-lib-empty cl-lib-error"><span>{error}</span><button type="button" onClick={onClose}>Cerrar</button></div>:
     filtered.length===0?<div className="cl-lib-empty"><LibraryBig size={28}/>{data.items.length?"No hay referencias para esta búsqueda.":"Todavía no tienes referencias guardadas en Library."}</div>:
     <div className="cl-lib-grid">
      {filtered.map(item=>{
       const exists=already(item),checked=chosen.includes(item.id),disabled=exists||(!checked&&atLimit);
       return <button type="button" key={item.id} className={"cl-lib-item"+(checked?" is-selected":"")+(exists?" is-present":"")} disabled={disabled} aria-pressed={checked||exists} onClick={()=>toggle(item)}>
        <div className="cl-lib-cover"><LibraryThumb item={item}/><span className={"cl-lib-check"+(checked||exists?" checked":"")}>{checked||exists?<Check size={14}/>:<span/>}</span></div>
        <div className="cl-lib-card-body"><strong title={item.title}>{item.title}</strong><small>{exists?"Ya está en este mapa":data.collections.find(c=>c.id===item.collection_id)?.name||item.site||item.kind}</small></div>
       </button>;
      })}
     </div>}
   </div>
   <footer className="cl-lib-foot">
    <span>{loading?"Cargando…":data.items.length+" referencias"} · {validSelected.length} seleccionadas</span>
    <div><button type="button" className="cl-lib-cancel" onClick={onClose}>Cancelar</button>
     <button type="button" className="cl-lib-insert" disabled={!validSelected.length||loading} onClick={submit}><Check size={16}/> Añadir {validSelected.length||""} al mapa</button>
    </div>
   </footer>
  </section>
 </div>;
}
