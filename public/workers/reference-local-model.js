/* This worker performs ALL inference on the user's device.
   No private reference text is sent to a hosted inference endpoint.
   The first run downloads a public, quantized model into the browser cache. */
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels=false;
env.allowRemoteModels=true;
env.useBrowserCache=true;
if(env.backends?.onnx?.wasm)env.backends.onnx.wasm.numThreads=1;
const MODEL="Xenova/paraphrase-multilingual-MiniLM-L12-v2";
let extractorPromise=null;
async function extractor(){
 if(!extractorPromise){
  self.postMessage({type:"status",message:"Descargando modelo multilingüe. La primera vez puede tardar..."});
  extractorPromise=pipeline("feature-extraction",MODEL,{
   device:"wasm",dtype:"q8",
   progress_callback:progress=>{
    if(progress?.status==="progress"&&Number.isFinite(progress.progress))self.postMessage({type:"download",value:Math.round(progress.progress)});
   }
  }).catch(error=>{extractorPromise=null;throw error});
 }
 return extractorPromise;
}
self.onmessage=async event=>{
 const {type,id,items}=event.data||{};
 if(type!=="embed"||!Array.isArray(items)||items.length>180)return;
 try{
  const pipe=await extractor();
  const vectors=[];
  for(let i=0;i<items.length;i++){
   const ref=items[i];
   const content=String(ref.text||"").slice(0,3000);
   const output=await pipe(content||String(ref.title||""),{pooling:"mean",normalize:true});
   const embedding=Array.from(output.data||[]);
   if(embedding.length!==384)throw Error("Dimensión inesperada del modelo: "+embedding.length);
   vectors.push({reference_id:ref.id,source_hash:ref.source_hash,embedding});
   self.postMessage({type:"progress",value:i+1,total:items.length});
  }
  self.postMessage({type:"result",id,vectors});
 }catch(err){
  self.postMessage({type:"error",id,error:err instanceof Error?err.message:String(err)});
 }
};
