import { lifeSession } from "@/app/lib/life-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/lib/supabase-auth";
export async function GET(request:Request){
 const session=await lifeSession(request);
 if(!session)return new Response("No autorizado",{status:401});
 const path=new URL(request.url).searchParams.get("path")||"";
 if(!new RegExp("^"+session.userId.replace(/-/g,"\\-")+"/[0-9a-f-]{36}\\.(jpg|png|webp|gif)$","i").test(path))return new Response("Ruta incorrecta",{status:400});
 const r=await fetch(SUPABASE_URL+"/storage/v1/object/authenticated/reference-assets/"+path,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.accessToken},cache:"no-store"});
 if(!r.ok)return new Response("Imagen no disponible",{status:r.status});
 return new Response(r.body,{headers:{"Content-Type":r.headers.get("content-type")||"image/jpeg","Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
}
