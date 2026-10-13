export type LocalReference={id:string;title:string;kind?:string;notes?:string;site?:string|null;auto_tags?:string[];project_id?:string|null};
export type LocalVector={reference_id:string;source_hash:string;embedding:number[];model?:string};
export type LocalDecision={source_id:string;target_id:string;status:string;relation?:string;explanation?:string;model?:string};
export function localText(ref:LocalReference){
 const title=(ref.title||"").trim();
 const notes=(ref.notes||"").trim().slice(0,2000);
 const tags=(ref.auto_tags||[]).slice(0,8).join(", ");
 return ["Referencia: "+title,notes?"Notas: "+notes:"",tags?"Conceptos: "+tags:"",ref.kind?"Formato: "+ref.kind:""].filter(Boolean).join(". ").slice(0,3000);
}
export function localHash(value:string){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16).padStart(8,"0");
}
export function cosine(a:number[],b:number[]){
 if(a.length!==b.length||!a.length)return 0;
 let sum=0,ma=0,mb=0;
 for(let i=0;i<a.length;i++){sum+=a[i]*b[i];ma+=a[i]*a[i];mb+=b[i]*b[i]}
 return ma>0&&mb>0?sum/Math.sqrt(ma*mb):0;
}
const ignored=new Set(["para","como","entre","desde","sobre","hasta","cosas","escena","video","referencia","referencias","porque","tiene","algo","cosa","esta","esto","esas","the","with","from","this","that","image","video","reference","ideas","ideas","nombre","nuevo","nueva"]);
function keyTerms(r:LocalReference){
 return new Set((localText(r).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z]{5,}/g)||[]).filter(t=>!ignored.has(t)));
}
export function localSuggestions(source:LocalReference,items:LocalReference[],vectors:Map<string,number[]>,decisions:LocalDecision[],distance:number){
 const center=vectors.get(source.id);
 if(!center)return [];
 const existing=new Set(decisions.filter(d=>d.status!=="pending").flatMap(d=>d.source_id===source.id?[d.target_id]:d.target_id===source.id?[d.source_id]:[]));
 const pending=new Set(decisions.filter(d=>d.status==="pending"&&d.source_id===source.id).map(d=>d.target_id));
 const favorites=decisions.filter(d=>d.status==="accepted"&&(d.source_id===source.id||d.target_id===source.id)).map(d=>vectors.get(d.source_id===source.id?d.target_id:d.source_id)).filter((v):v is number[]=>!!v);
 const dislikes=decisions.filter(d=>d.status==="rejected"&&(d.source_id===source.id||d.target_id===source.id)).map(d=>vectors.get(d.source_id===source.id?d.target_id:d.source_id)).filter((v):v is number[]=>!!v);
 const sourceWords=keyTerms(source);
 const results=items.filter(x=>x.id!==source.id&&!existing.has(x.id)&&!pending.has(x.id)).map(item=>{
  const vector=vectors.get(item.id);if(!vector)return null;
  const similarity=cosine(center,vector);
  const preference=(favorites.length?Math.max(...favorites.map(v=>cosine(v,vector)))*.09:0)-(dislikes.length?Math.max(...dislikes.map(v=>cosine(v,vector)))*.13:0);
  const words=Array.from(keyTerms(item));
  const common=words.filter(t=>sourceWords.has(t)).slice(0,3);
  // At maximum distance: keep only plausible semantic relationships, prefer surprising connections.
  const targetSimilarity=.72-distance*.004;
  const confidence=similarity+preference;
  const ranking=confidence-(Math.abs(similarity-targetSimilarity)*.45);
  const relation=common.length>0?"Territorio compartido":similarity>.55?"Resonancia conceptual":"Analogía por explorar";
  const explanation=common.length>0
    ?"Comparten el territorio "+common.join(", ")+". La proximidad semántica también sugiere una posible asociación; puedes validarla o descartarla."
    :"El modelo multilingüe ejecutado en tu dispositivo detecta proximidad entre sus descripciones. Es una hipótesis de conexión, no un análisis de sus imágenes o vídeos.";
  return {item,similarity,ranking,relation,explanation,distance:Math.round((1-Math.max(0,Math.min(1,similarity)))*100)};
 }).filter((value):value is NonNullable<typeof value>=>value!==null&&value.similarity>.14).sort((a,b)=>b.ranking-a.ranking);
 return results.slice(0,5);
}
