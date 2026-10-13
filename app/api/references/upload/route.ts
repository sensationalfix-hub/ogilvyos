import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/lib/supabase-auth";

export const runtime="nodejs";
const allowed:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
export async function POST(request:Request){
 const session=await lifeSession(request);
 if(!session)return NextResponse.json({error:"Inicia sesión con Supabase."},{status:401});
 const form=await request.formData().catch(()=>null);
 const file=form?.get("file");
 if(!(file instanceof File))return NextResponse.json({error:"Selecciona una imagen."},{status:400});
 if(!allowed[file.type]||file.size>10*1024*1024||file.size===0)return NextResponse.json({error:"Solo imágenes JPG, PNG, WebP o GIF hasta 10 MB."},{status:400});
 const path=session.userId+"/"+crypto.randomUUID()+"."+allowed[file.type];
 const r=await fetch(SUPABASE_URL+"/storage/v1/object/reference-assets/"+path,{
  method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken,"Content-Type":file.type,"x-upsert":"false"},
  body:await file.arrayBuffer(),cache:"no-store"
 });
 if(!r.ok)return NextResponse.json({error:"No se pudo subir el archivo: "+(await r.text()).slice(0,250)},{status:r.status});
 return NextResponse.json({path,kind:"image"});
}
