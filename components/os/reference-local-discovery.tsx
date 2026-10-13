"use client";
import {useEffect,useRef,useState} from "react";
import {BrainCircuit,Loader2,Sparkles,X} from "lucide-react";
import {cosine,localHash,localText,type LocalReference,type LocalVector} from "./reference-local-engine";

type Concept={name:string;query:string;description:string};
const concepts:Concept[]=[
 {name:"El ritual",query:"ritual",description:"Gestos que convierten lo cotidiano en ceremonia"},
 {name:"Poder invisible",query:"power",description:"Autoridad y dominio contados sin enseñar al protagonista"},
 {name:"La metamorfosis",query:"transformation",description:"Cambios físicos como símbolo de una transformación interior"},
 {name:"Lo inevitable",query:"fate",description:"Señales que convierten la historia en destino"},
 {name:"Belleza inquietante",query:"surrealism",description:"Una imagen familiar que contiene algo imposible"},
 {name:"La obsesión",query:"obsession",description:"Un impulso que vuelve una y otra vez"},
 {name:"Escala sobrehumana",query:"monument",description:"Personas diminutas frente a algo monumental"},
 {name:"Memoria colectiva",query:"memory",description:"Huella, herencia y experiencia compartida"},
 {name:"Movimiento",query:"movement",description:"El dinamismo como lenguaje narrativo"},
 {name:"Sombra y revelación",query:"shadow",description:"Ocultar información para darle fuerza a lo que aparece"},
 {name:"Mitología cotidiana",query:"mythology",description:"Convertir una escena corriente en un mito"},
 {name:"Lo absurdo",query:"absurd",description:"El choque inesperado de dos mundos"},
 {name:"Rebelión",query:"rebellion",description:"Romper códigos visuales como forma de identidad"},
 {name:"Ausencia",query:"absence",description:"Contar algo mostrando lo que falta"},
 {name:"Naturaleza invasora",query:"nature",description:"La naturaleza reapropiándose de espacios humanos"},
 {name:"Ecos del futuro",query:"future",description:"La promesa de algo aún por descubrir"},
 {name:"El símbolo",query:"symbolism",description:"Ideas complejas comprimidas en una imagen"},
 {name:"El sacrificio",query:"sacrifice",description:"La renuncia como motor dramático"}
];
type Direction=Concept&{reason:string;strength:number};
export function LocalDiscovery({items,onSelect}:{items:LocalReference[];onSelect:(query:string)=>void}){
 const [results,setResults]=useState<Direction[]>([]);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 const [error,setError]=useState("");
 const worker=useRef<Worker|null>(null);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;worker.current?.terminate()},[]);
 const cancel=()=>{generation.current++;worker.current?.terminate();worker.current=null;setBusy(false);setStatus("Búsqueda cancelada")};
 const explore=async()=>{
  if(!items.length){setError("Guarda al menos una referencia para personalizar los descubrimientos.");return}
  const turn=++generation.current;setBusy(true);setStatus("Leyendo tu archivo...");setError("");setResults([]);
  try{
   const response=await fetch("/api/references/local",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"No se pudo leer la memoria");
   const known=new Map<string,number[]>();
   const cached=new Map<string,LocalVector>((data.vectors||[]).map((v:LocalVector)=>[v.reference_id,v]));
   const missing=items.slice(0,100).map(ref=>({id:ref.id,source_hash:localHash(localText(ref)),text:localText(ref)})).filter(ref=>{
    const hit=cached.get(ref.id);
    if(hit&&hit.model==="paraphrase-multilingual-MiniLM-L12-v2-q8"&&hit.source_hash===ref.source_hash){known.set(ref.id,hit.embedding);return false}
    return true;
   });
   const prompts=concepts.map((c,index)=>({id:"concept-"+index,source_hash:"00000000",text:c.name+". "+c.description+". "+c.query+". Arte, cine, fotografía, publicidad."}));
   setStatus("Ejecutando modelo semántico en tu dispositivo...");
   const w=new Worker("/workers/reference-local-model.js",{type:"module"});worker.current=w;
   await new Promise<void>((resolve,reject)=>{
    w.onmessage=async event=>{
     if(turn!==generation.current){resolve();return}
     const m=event.data||{};
     if(m.type==="status")setStatus(m.message);
     if(m.type==="download")setStatus("Descargando modelo local: "+m.value+"%");
     if(m.type==="progress")setStatus("Comparando conceptos "+m.value+"/"+m.total+"...");
     if(m.type==="error")reject(Error(m.error||"El modelo no ha podido ejecutarse"));
     if(m.type==="result"){
      try{
       const vectors=(m.vectors||[]) as LocalVector[];
       const derived=vectors.filter(v=>!v.reference_id.startsWith("concept-"));
       for(let p=0;p<derived.length;p+=30){
        await fetch("/api/references/local",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"embeddings",vectors:derived.slice(p,p+30)})});
       }
       for(const v of derived)known.set(v.reference_id,v.embedding);
       const valid=items.filter(ref=>known.has(ref.id));
       const discoveries:Direction[]=concepts.map((c,index)=>{
        const found=vectors.find(v=>v.reference_id==="concept-"+index);
        if(!found)return null;
        const neighbors=valid.map(r=>({ref:r,score:cosine(found.embedding,known.get(r.id)??[])})).sort((a,b)=>b.score-a.score);
        const nearest=neighbors[0];
        if(!nearest)return null;
        const novelty=Math.max(0,1-Math.abs(nearest.score-.4)*1.9);
        const quality=nearest.score*.55+novelty*.45;
        return {...c,strength:quality,reason:"A partir de «"+nearest.ref.title+"», esta ruta propone explorar "+c.description.toLowerCase()+"."};
       }).filter((x):x is Direction=>!!x).sort((a,b)=>b.strength-a.strength).slice(0,3);
       if(turn===generation.current){setResults(discoveries);setStatus(discoveries.length?"Tres territorios para salir de tu biblioteca. Selecciona uno para buscar obras reales.":"No se han encontrado direcciones relacionadas.");}
       resolve();
      }catch(err){reject(err)}
     }
    };
    w.onerror=e=>reject(Error(e.message||"Error de descarga del modelo local"));
    w.postMessage({type:"embed",id:turn,items:[...missing,...prompts]});
   });
  }catch(e){if(turn===generation.current)setError(e instanceof Error?e.message:"No se pudo completar la exploración");}
  finally{if(turn===generation.current){setBusy(false);worker.current?.terminate();worker.current=null}}
 };
 return <section className="rl-ai-discovery rl-local-discovery">
  <div className="rl-ai-discovery-heading"><div><BrainCircuit size={17}/><strong>Explora con IA local</strong><p>Busca territorios nuevos a partir de tus referencias, sin consumir créditos de IA. La búsqueda final consulta obras reales del museo.</p></div>
  {busy?<button onClick={cancel} type="button"><X size={15}/> Cancelar</button>:<button onClick={explore} type="button"><Sparkles size={15}/> Sugerirme rutas gratis</button>}</div>
  {!!status&&<p className="rl-local-status" role="status">{busy&&<Loader2 size={14} className="rl-rotate"/>}{status}</p>}
  {!!error&&<p className="rl-ai-discovery-error" role="alert">{error}</p>}
  {!!results.length&&<div className="rl-ai-directions">{results.map(item=><button key={item.query} type="button" onClick={()=>onSelect(item.query)}><span>{item.name}</span><p>{item.reason}</p><small>Explorar: {item.query} ↗</small></button>)}</div>}
  <small className="rl-local-footnote">Las asociaciones se calculan solo en tu navegador. La primera descarga del modelo puede superar los 100 MB. No se han analizado las imágenes ni el contenido de los vídeos.</small>
 </section>
}
