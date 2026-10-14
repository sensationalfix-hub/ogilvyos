/* Entire visual inference runs inside the browser. Files / sampled frames do not reach Vercel. */
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
env.allowLocalModels=false;
env.allowRemoteModels=true;
env.useBrowserCache=true;
if(env.backends?.onnx?.wasm)env.backends.onnx.wasm.numThreads=1;

const MODEL="Xenova/clip-vit-base-patch32";
let task=null;
async function classifier(){
 if(!task){
  self.postMessage({type:"status",message:"Preparando CLIP local. La primera descarga es grande y queda en la caché del navegador."});
  task=pipeline("zero-shot-image-classification",MODEL,{
   device:"wasm",dtype:"q8",
   progress_callback:p=>{if(p?.status==="progress"&&Number.isFinite(p.progress))self.postMessage({type:"download",value:Math.round(p.progress)});}
  }).catch(err=>{task=null;throw err});
 }
 return task;
}
self.onmessage=async(event)=>{
 const {type,id,frames,labels}=event.data||{};
 if(type!=="analyze"||!Array.isArray(frames)||frames.length<1||frames.length>3||!Array.isArray(labels)||labels.length<3||labels.length>70)return;
 try{
  if(frames.some(f=>!(f instanceof Blob)||f.size===0||f.size>8_000_000))throw Error("Imagen demasiado grande para analizar localmente.");
  if(labels.some(x=>!x||typeof x.id!=="string"||typeof x.prompt!=="string"||typeof x.group!=="string"))throw Error("Vocabulario no válido");
  const model=await classifier();
  const scores=new Map(labels.map(l=>[l.id,0]));
  for(let i=0;i<frames.length;i++){
   const predictions=await model(frames[i],labels.map(l=>l.prompt),{top_k:labels.length});
   for(const result of predictions){
    const label=labels.find(l=>l.prompt===result.label);
    if(label)scores.set(label.id,(scores.get(label.id)||0)+Number(result.score||0)/frames.length);
   }
   self.postMessage({type:"progress",value:i+1,total:frames.length});
  }
  const groups=[...new Set(labels.map(l=>l.group))];
  const proposed=[];
  for(const group of groups){
   const ranked=labels.filter(l=>l.group===group).map(l=>({...l,score:scores.get(l.id)||0})).sort((a,b)=>b.score-a.score);
   const sum=ranked.reduce((a,b)=>a+b.score,0);
   for(let index=0;index<Math.min(2,ranked.length);index++){
    const label=ranked[index];
    const relative=sum>0?label.score/sum:0;
    if(label.score>=0.034&&relative>=(index===0?.15:.24))proposed.push({id:label.id,group:label.group,name:label.name,score:label.score,relative});
   }
  }
  proposed.sort((a,b)=>b.score-a.score);
  const selected=proposed.slice(0,7).map(({id,group,name,score})=>({id,group,name,score:Math.round(score*1000)/1000}));
  self.postMessage({type:"result",id,concepts:selected,model:MODEL,frames:frames.length});
 }catch(error){self.postMessage({type:"error",id,error:error instanceof Error?error.message:String(error)});}
};
