import { NextResponse } from "next/server";

export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageURL=(id:string)=>"https://www.artic.edu/iiif/2/"+id+"/full/843,/0/default.jpg";

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const id=params.get("id")||"";
 if(!UUID.test(id))return new Response("Imagen no válida",{status:400});
 try{
  const remote=await fetch(imageURL(id),{
   signal:AbortSignal.timeout(10000),
   headers:{Accept:"image/jpeg,image/*;q=0.8", "User-Agent":"ReferenceLib/1.0 (personal creative inspiration browser)"},
   next:{revalidate:86400}
  });
  const mime=remote.headers.get("content-type")||"";
  if(params.has("check"))return NextResponse.json({status:remote.status,mime,ok:remote.ok});
  if(!remote.ok||!mime.startsWith("image/")||!remote.body)return new Response("Imagen no disponible",{status:404,headers:{"Cache-Control":"public, max-age=60"}});
  return new Response(remote.body,{status:200,headers:{"Content-Type":mime,"Cache-Control":"public, max-age=86400, stale-while-revalidate=604800","X-Content-Type-Options":"nosniff"}});
 }catch(e){
  if(params.has("check"))return NextResponse.json({ok:false,error:String(e)},{status:502});
  return new Response("Origen no disponible",{status:502,headers:{"Cache-Control":"public, max-age=60"}});
 }
}
