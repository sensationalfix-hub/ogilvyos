import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";
const clean=(v:string)=>{try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port?u:null}catch{return null}};
export async function GET(request:Request){
 if(!await lifeSession(request))return NextResponse.json({error:"Sin autorización"},{status:401});
 const url=clean(new URL(request.url).searchParams.get("url")||"");
 if(!url)return NextResponse.json({preview:null},{status:400});
 const host=url.hostname.replace(/^www\./,"").toLowerCase();
 const match=(host==="youtube.com"||host==="m.youtube.com")?url.searchParams.get("v"):host==="youtu.be"?url.pathname.slice(1):null;
 if(match&&/^[\w-]{11}$/.test(match)){
  let title="Vídeo de YouTube";let site="YouTube";
  try{const o=new URL("https://www.youtube.com/oembed");o.searchParams.set("url",url.href);o.searchParams.set("format","json");
   const r=await fetch(o,{signal:AbortSignal.timeout(5000),cache:"no-store"});if(r.ok){const d=await r.json();title=String(d.title||title).slice(0,180);site=String(d.author_name||site).slice(0,80)}}catch{}
  return NextResponse.json({preview:{title,site,kind:"video",image:"https://img.youtube.com/vi/"+match+"/hqdefault.jpg"}});
 }
 const direct=/\.(jpe?g|png|webp|gif)$/i.test(url.pathname);
 if(direct)return NextResponse.json({preview:{title:decodeURIComponent(url.pathname.split("/").pop()||"Imagen").slice(0,150),site:host,kind:"image",image:url.href}});
 if(/\.mp4$/i.test(url.pathname))return NextResponse.json({preview:{title:decodeURIComponent(url.pathname.split("/").pop()||"Vídeo").slice(0,150),site:host,kind:"video",image:null}});
 return NextResponse.json({preview:null});
}