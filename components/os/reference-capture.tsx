"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ImagePlus, Link2, Loader2, X } from "lucide-react";

type Preview={title?:string;image?:string;site?:string;kind?:string};
type Collection={id:string;name:string};
export function ReferenceCapture({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved?:()=>void}){
 const [url,setUrl]=useState("");const [file,setFile]=useState<File|null>(null);
 const [title,setTitle]=useState("");const [notes,setNotes]=useState("");const [collection,setCollection]=useState("");
 const [collections,setCollections]=useState<Collection[]>([]);const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);
 const [localImage,setLocalImage]=useState("");
 useEffect(()=>{if(!open)return;fetch("/api/references",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(d?.collections)setCollections(d.collections)}).catch(()=>{});},[open]);
 useEffect(()=>{if(!file){setLocalImage("");return}const objectUrl=URL.createObjectURL(file);setLocalImage(objectUrl);return()=>URL.revokeObjectURL(objectUrl)},[file]);
 useEffect(()=>{if(!open||file||!/^https:\/\//i.test(url))return;let active=true;const timer=setTimeout(async()=>{
 try{const r=await fetch("/api/references/preview?url="+encodeURIComponent(url));const d=await r.json();let p:Preview|null=d.preview||null;
 if(!p){const second=await fetch("/api/creative/preview?url="+encodeURIComponent(url));if(second.ok){const res=await second.json();p=res.preview||null}}
 if(active){setPreview(p);if(p?.title)setTitle(v=>v||p.title||"")}}
 catch{if(active)setPreview(null)}
 },500);return()=>{active=false;clearTimeout(timer)}},[open,url,file]);
 const close=()=>{if(busy)return;onClose();setDone(false);setError("")};
 const save=async(e:React.FormEvent)=>{
 e.preventDefault();setBusy(true);setError("");
 try{
 let mediaPath="";
 if(file){const form=new FormData();form.set("file",file);const r=await fetch("/api/references/upload",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw Error(d.error||"No se pudo subir");mediaPath=d.path}
 const r=await fetch("/api/references",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:url.trim()||null,media_path:mediaPath||null,title:title.trim()||file?.name||preview?.title||"",notes,collection_id:collection||null,image_url:preview?.image||null,site:preview?.site||null,kind:file?"image":preview?.kind||undefined})});
 const d=await r.json();if(!r.ok)throw Error(d.error||"No se pudo guardar");
 setDone(true);setFile(null);setUrl("");setTitle("");setPreview(null);setNotes("");setCollection("");
 window.dispatchEvent(new Event("reference-lib:changed"));onSaved?.();
 }catch(e){setError(e instanceof Error?e.message:"Error desconocido")}
 finally{setBusy(false)}
 };
 if(!open)return null;
 return <div className="rc-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
  <section className="rc-dialog" role="dialog" aria-modal="true" aria-label="Guardar referencia">
   <header className="rc-heading"><div><span className="rc-eyebrow">REFERENCE LIB / CAPTURA</span><h2>Guardar una referencia<span>.</span></h2></div><button className="rc-close" aria-label="Cerrar" onClick={close}><X size={19}/></button></header>
   {done?<div className="rc-success"><Check size={24}/><strong>Guardada en tu biblioteca.</strong><p>Ya puedes encontrarla desde cualquier espacio del OS.</p><button className="rc-main" onClick={()=>{setDone(false);onClose()}}>Continuar</button></div>:
   <form onSubmit={save}>
    <label className="rc-label" htmlFor="rc-url">ENLACE</label>
    <div className="rc-url"><Link2 size={17}/><input id="rc-url" type="url" value={url} placeholder="Pega una URL de vídeo, imagen, campaña..." onChange={e=>{setUrl(e.target.value);setPreview(null);setTitle("")}} disabled={!!file}/></div>
    <div className="rc-divider"><span>O</span></div>
    <label className="rc-upload"><ImagePlus size={20}/><span>{file?file.name:"Subir imagen (JPG, PNG, WebP o GIF)"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);if(f){setUrl("");setTitle(f.name.replace(/\.[^.]+$/,""));setPreview(null)}}}/></label>
    {(localImage||preview?.image)&&<div className="rc-preview"><img src={localImage||preview?.image} alt="Vista previa"/><span>{preview?.site||"Archivo local"}</span></div>}
    <label className="rc-label" htmlFor="rc-title">TÍTULO <small>opcional</small></label>
    <input className="rc-field" id="rc-title" value={title} placeholder="Detectado automáticamente cuando sea posible" onChange={e=>setTitle(e.target.value)} maxLength={180}/>
    <label className="rc-label" htmlFor="rc-note">¿POR QUÉ LA GUARDAS? <small>opcional</small></label>
    <textarea className="rc-field" id="rc-note" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Puedes dejarlo vacío. No te vamos a obligar a catalogar la vida."/>
    {collections.length>0&&<><label className="rc-label" htmlFor="rc-collection">COLECCIÓN <small>opcional</small></label><select className="rc-field" id="rc-collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="">Sin colección</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></>}
    {error&&<p className="rc-error" role="alert">{error}</p>}
    <button className="rc-main" disabled={busy||(!url.trim()&&!file)} type="submit">{busy?<Loader2 size={17} className="rc-spin"/>:<ArrowUpRight size={17}/>} {busy?"Guardando...":"Guardar referencia"}</button>
    <p className="rc-footnote">Sin etiquetas obligatorias. Disponible en Work, Life y Creative Lab.</p>
   </form>}
  </section>
 </div>;
}