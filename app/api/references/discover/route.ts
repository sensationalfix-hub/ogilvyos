import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";

export const runtime="nodejs";
type CMAImage={url?:string};
type CMACreator={description?:string;name?:string};
type CMAArtwork={
 id:number;title:string;accession_number?:string;url?:string;creation_date?:string;
 creators?:CMACreator[];images?:{web?:CMAImage};share_license_status?:string;
};
const validImage=(value:string|undefined)=>{
 if(!value)return null;
 try{const url=new URL(value);return url.protocol==="https:" && url.hostname==="openaccess-cdn.clevelandart.org"?url.href:null}catch{return null}
};
export async function GET(request:Request){
 if(!await lifeSession(request))return NextResponse.json({error:"Sin autorización"},{status:401});
 const raw=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,110);
 if(!raw)return NextResponse.json({works:[],query:""});
 try{
  const endpoint=new URL("https://openaccess-api.clevelandart.org/api/artworks/");
  endpoint.searchParams.set("q",raw);
  endpoint.searchParams.set("has_image","1");
  endpoint.searchParams.set("limit","36");
  endpoint.searchParams.append("cc0","");
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(11000),headers:{Accept:"application/json"},next:{revalidate:3600}});
  if(!response.ok)return NextResponse.json({works:[],query:raw,error:"La colección del museo no está disponible temporalmente."});
  const result=await response.json() as {data?:CMAArtwork[]};
  const works=(Array.isArray(result.data)?result.data:[])
   .filter(a=>a&&Number.isInteger(a.id)&&a.share_license_status==="CC0"&&validImage(a.images?.web?.url))
   .slice(0,15).map(a=>({
    id:a.id,title:a.title||"Obra sin título",
    artist:a.creators?.find(c=>c.description||c.name)?.description||a.creators?.[0]?.name||"Artista desconocido",
    date:a.creation_date||"",
    image:validImage(a.images?.web?.url)!,
    url:a.url&&a.url.startsWith("https://")?a.url:"https://www.clevelandart.org/art/"+encodeURIComponent(a.accession_number||String(a.id)),
    site:"Cleveland Museum of Art",
    kind:"image"
   }));
  return NextResponse.json({works,query:raw,source:"Cleveland Museum of Art · obras CC0"},{headers:{"Cache-Control":"private, max-age=600"}});
 }catch(error){
  return NextResponse.json({works:[],query:raw,error:"No se ha podido consultar el catálogo externo."});
 }
}
