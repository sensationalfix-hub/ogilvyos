import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";
type Artwork={id:number;title:string;artist_title:string|null;date_display:string|null;image_id:string|null;is_public_domain:boolean};
export async function GET(request:Request){
 if(!await lifeSession(request))return NextResponse.json({error:"Sin autorización"},{status:401});
 const raw=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,110);
 if(!raw)return NextResponse.json({works:[],query:""});
 try{
  const url=new URL("https://api.artic.edu/api/v1/artworks/search");
  url.searchParams.set("q",raw);
  url.searchParams.set("limit","45");
  url.searchParams.set("fields","id,title,artist_title,date_display,image_id,is_public_domain");
  const r=await fetch(url,{signal:AbortSignal.timeout(8500),headers:{Accept:"application/json"},cache:"no-store"});
  if(!r.ok)return NextResponse.json({works:[],query:raw,error:"El museo no responde."});
  const json=await r.json();
  const works=((json.data||[]) as Artwork[]).filter(a=>a.is_public_domain&&a.image_id&&Number.isInteger(a.id)).slice(0,12).map(a=>({
   id:a.id,title:a.title,artist:a.artist_title||"Artista desconocido",date:a.date_display||"",
   image:"https://www.artic.edu/iiif/2/"+encodeURIComponent(a.image_id!)+"/full/600,/0/default.jpg",
   url:"https://www.artic.edu/artworks/"+a.id,site:"Art Institute of Chicago",kind:"image"
  }));
  return NextResponse.json({works,query:raw,source:"Art Institute of Chicago · dominio público"});
 }catch{return NextResponse.json({works:[],query:raw,error:"No se ha podido consultar el catálogo externo."})}
}