import { NextResponse } from "next/server";
import { lifeSession } from "@/app/lib/life-store";

export const runtime = "nodejs";

type MediaType = "videojuego" | "película" | "serie";
type MediaResult = {
  id:string; type:MediaType; title:string; year:string|null; image:string|null;
  fallbackImage:string|null; description:string; genres:string[];
  platforms:string[]; rating:number|null; ratingLabel:string|null;
  source:string; sourceUrl:string;
};
type Dictionary = Record<string,unknown>;
const record=(value:unknown):Dictionary=>
  value && typeof value==="object"&&!Array.isArray(value)?value as Dictionary:{};
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const string=(v:unknown)=>typeof v==="string"?v:"";
const safeUrl=(v:unknown):string|null=>{
 if(typeof v!=="string")return null;
 try{const url=new URL(v);if(url.protocol!=="https:")return null;
  const host=url.hostname.toLowerCase();
  if(["upload.wikimedia.org","images.weserv.nl","image.tmdb.org","static.tvmaze.com","api.tvmaze.com","media.rawg.io","shared.fastly.steamstatic.com","cdn.cloudflare.steamstatic.com","steamcdn-a.akamaihd.net","steamcommunity.com"].some(allowed=>host===allowed)||/^is\d+(?:-ssl)?\.mzstatic\.com$/.test(host))return url.href;
 }catch{}
 return null;
};
const yearOf=(value:unknown):string|null=>{
 const s=string(value);const match=s.match(/^(18|19|20|21)\d{2}/);return match?match[0]:null;
};
const strip=(s:string)=>s.replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp|quot|#39);/g," ").replace(/\s+/g," ").trim().slice(0,1100);
const get=async(url:string,headers?:Record<string,string>):Promise<Dictionary>=>{
 try{
  const response=await fetch(url,{
   headers:{"Accept":"application/json","User-Agent":"LifeOS-Culture/1.0 (https://ogilvy-os.vercel.app/life; personal library)",...(headers||{})},
   signal:AbortSignal.timeout(6000),next:{revalidate:60*60}
  });
  if(!response.ok)return {};
  return record(await response.json());
 }catch{return {};}
};
const sortByName=(items:MediaResult[],q:string)=>{
 const key=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
 const target=key(q);
 return items.sort((a,b)=>{
  const rank=(x:MediaResult)=>{const name=key(x.title);return (name===target?100:name.startsWith(target)?55:name.includes(target)?35:0)+(x.image?4:0)+(x.year?1:0);};
  return rank(b)-rank(a);
 });
};
async function wikiSearch(q:string,type:MediaType):Promise<MediaResult[]> {
 const suffix=type==="videojuego"?" video game":type==="película"?" film":" television series";
 const url="https://en.wikipedia.org/w/rest.php/v1/search/page?q="+encodeURIComponent(q+suffix)+"&limit=14";
 const data=await get(url,{"Api-User-Agent":"LifeOS-Culture/1.0 (https://ogilvy-os.vercel.app/life)"});
 return array(data.pages).map(value=>{
  const item=record(value), description=string(item.description),title=string(item.title);
  const excerpt=strip(string(item.excerpt));
  const thumb=record(item.thumbnail);
  const text=(description+" "+title).toLowerCase();
  const matches=type==="videojuego"?
   /video game|videogame|gaming|nintendo|playstation|xbox|game series|action-adventure game/.test(text):
   type==="película"?/film|movie|cinema|motion picture/.test(text):
   /television|tv series|anime|streaming series|miniseries|sitcom/.test(text);
  const years=(title+" "+description).match(/(?:18|19|20)\d{2}/);
  if(!matches)return null;
  const filename=string(item.key)||title.replace(/ /g,"_");
  return {
   id:"wiki:"+filename,type,title:title.replace(/\s+\((?:film|video game|TV series|television series|series)\)$/i,""),
   year:years?years[0]:null,
   image:safeUrl(thumb.url),fallbackImage:null,
   description:description?description+(excerpt? ". "+excerpt : ""):excerpt,
   genres:[],platforms:[],rating:null,ratingLabel:null,
   source:"Wikipedia",sourceUrl:"https://en.wikipedia.org/wiki/"+encodeURIComponent(filename),
  } as MediaResult;
 }).filter((x):x is MediaResult=>Boolean(x)).slice(0,10);
}
async function steamSearch(q:string):Promise<MediaResult[]>{
 const data=await get("https://store.steampowered.com/api/storesearch/?term="+encodeURIComponent(q)+"&l=spanish&cc=ES");
 return array(data.items).slice(0,10).map(x=>{
  const e=record(x),id=Number(e.id);
  if(!Number.isFinite(id)||!string(e.name))return null;
  const platforms=record(e.platforms);
  const platformNames=["windows","mac","linux"].filter(k=>platforms[k]===true).map(k=>k==="windows"?"PC":k==="mac"?"Mac":"Linux");
  const rating=Number(e.metascore);
  return {id:"steam:"+id,type:"videojuego" as const,title:string(e.name),
   year:null,image:safeUrl("https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/"+id+"/library_600x900.jpg"),
   fallbackImage:safeUrl(e.tiny_image),description:"",genres:[],platforms:platformNames,
   rating:Number.isFinite(rating)&&rating>0?rating:null,ratingLabel:rating>0?"Metacritic vía Steam":null,
   source:"Steam",sourceUrl:"https://store.steampowered.com/app/"+id+"/"} as MediaResult;
 }).filter((x):x is MediaResult=>Boolean(x));
}
async function tvMazeSearch(q:string):Promise<MediaResult[]>{
 try{
 const response=await fetch("https://api.tvmaze.com/search/shows?q="+encodeURIComponent(q),{
  headers:{"Accept":"application/json","User-Agent":"LifeOS-Culture/1.0 (https://ogilvy-os.vercel.app/life)"},
  next:{revalidate:3600},signal:AbortSignal.timeout(6000)
 });
 if(!response.ok)return [];
 const list=await response.json() as unknown;
 return array(list).slice(0,14).map(x=>{
  const show=record(record(x).show),image=record(show.image);
  const id=Number(show.id);if(!Number.isFinite(id)||!string(show.name))return null;
  const rating=Number(record(show.rating).average);
  return {id:"tvmaze:"+id,type:"serie" as const,title:string(show.name),year:yearOf(show.premiered),
   image:safeUrl(image.original)||safeUrl(image.medium),fallbackImage:safeUrl(image.medium),
   description:strip(string(show.summary)),genres:array(show.genres).map(string).filter(Boolean),
   platforms:[],rating:Number.isFinite(rating)&&rating>0?rating:null,
   ratingLabel:rating>0?"TVmaze / 10":null,source:"TVmaze",
   sourceUrl:string(show.url)||"https://www.tvmaze.com/shows/"+id} as MediaResult;
 }).filter((x):x is MediaResult=>Boolean(x));
 }catch{return [];}
}
async function rawgSearch(q:string):Promise<MediaResult[]>{
 const key=process.env.RAWG_API_KEY;if(!key)return [];
 const d=await get("https://api.rawg.io/api/games?search="+encodeURIComponent(q)+"&page_size=12&key="+encodeURIComponent(key));
 return array(d.results).map(x=>{
  const v=record(x),id=Number(v.id);if(!Number.isFinite(id)||!string(v.name))return null;
  const score=Number(v.metacritic);
  return {id:"rawg:"+id,type:"videojuego" as const,title:string(v.name),year:yearOf(v.released),
   image:safeUrl(v.background_image),fallbackImage:null,description:"",
   genres:array(v.genres).map(g=>string(record(g).name)).filter(Boolean),
   platforms:array(v.platforms).map(p=>string(record(record(p).platform).name)).filter(Boolean),
   rating:Number.isFinite(score)&&score>0?score:null,ratingLabel:score>0?"Metacritic":null,
   source:"RAWG",sourceUrl:"https://rawg.io/games/"+string(v.slug)} as MediaResult;
 }).filter((x):x is MediaResult=>Boolean(x));
}
async function tmdbSearch(q:string,type:MediaType):Promise<MediaResult[]>{
 const bearer=process.env.TMDB_READ_ACCESS_TOKEN, key=process.env.TMDB_API_KEY;
 if(!bearer&&!key)return [];
 const url=new URL("https://api.themoviedb.org/3/search/"+(type==="serie"?"tv":"movie"));
 url.searchParams.set("query",q);url.searchParams.set("language","es-ES");url.searchParams.set("include_adult","false");
 if(!bearer)url.searchParams.set("api_key",key||"");
 const d=await get(url.toString(),bearer?{"Authorization":"Bearer "+bearer}:undefined);
 return array(d.results).slice(0,12).map(x=>{
   const v=record(x),id=Number(v.id),title=string(v.title)||string(v.name);
   if(!Number.isFinite(id)||!title)return null;
   const date=type==="serie"?v.first_air_date:v.release_date;
   const poster=string(v.poster_path);
   const score=Number(v.vote_average);
   return {id:"tmdb:"+type+":"+id,type,title,year:yearOf(date),
     image:poster?safeUrl("https://image.tmdb.org/t/p/w500"+poster):null,
     fallbackImage:poster?safeUrl("https://image.tmdb.org/t/p/w342"+poster):null,
     description:string(v.overview),genres:[],platforms:[],
     rating:Number.isFinite(score)&&score>0?Number(score.toFixed(1)):null,ratingLabel:score>0?"TMDB / 10":null,
     source:"TMDB",sourceUrl:"https://www.themoviedb.org/"+(type==="serie"?"tv":"movie")+"/"+id
   } as MediaResult;
 }).filter((x):x is MediaResult=>Boolean(x));
}
function dedupe(all:MediaResult[]){
 const used=new Set<string>();
 return all.filter(x=>{
  const key=x.type+":"+x.title.toLowerCase().replace(/[^a-z0-9]/g,"")+":"+(x.year||"");
  if(used.has(key))return false;used.add(key);return true;
 });
}
const normal=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s*\([^)]*\)/g,"").replace(/[^a-z0-9]+/g," ").trim();
const biggerAppleArt=(v:unknown):string|null=>{
 const original=safeUrl(v);
 if(!original)return null;
 try{
  const url=new URL(original);
  const resized=url.pathname.replace(/\/\d+x\d+(?:bb|sr)(?=\.)/i,"/600x900bb");
  const result=new URL(resized,url.origin);
  return safeUrl(result.href)||original;
 }catch{return original;}
};
async function itunesMovies(q:string):Promise<MediaResult[]>{
 const d=await get("https://itunes.apple.com/search?term="+encodeURIComponent(q)+"&media=movie&entity=movie&country=us&limit=20");
 return array(d.results).map(v=>{
  const e=record(v),name=string(e.trackName),id=Number(e.trackId);
  if(!name||!Number.isFinite(id))return null;
  const image=biggerAppleArt(e.artworkUrl100);
  const year=yearOf(e.releaseDate);
  const genres=string(e.primaryGenreName)?[string(e.primaryGenreName)]:[];
  return {id:"itunes:movie:"+id,type:"película" as const,title:name,year,image,
    fallbackImage:safeUrl(e.artworkUrl100),description:strip(string(e.longDescription)||string(e.shortDescription)),
    genres,platforms:[],rating:null,ratingLabel:null,source:"Apple TV / iTunes",
    sourceUrl:string(e.trackViewUrl)||"https://itunes.apple.com/search?term="+encodeURIComponent(name)} as MediaResult;
 }).filter((v):v is MediaResult=>Boolean(v)&&Boolean(v.image));
}
async function wikiPagePoster(page:string):Promise<{image:string|null;fallbackImage:string|null}>{
 if(!/^[^\r\n?#]{1,140}$/.test(page))return {image:null,fallbackImage:null};
 const title=page.replace(/ /g,"_");
 const summary=await get("https://en.wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(title));
 const sthumb=record(summary.thumbnail),soriginal=record(summary.originalimage);
 let image=safeUrl(soriginal.source)||safeUrl(sthumb.source);
 let fallbackImage=safeUrl(sthumb.source);
 if(!image){
  const d=await get("https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail%7Coriginal&pithumbsize=800&titles="+encodeURIComponent(title));
  const pages=array(record(d.query).pages);
  const pageInfo=record(pages[0]);
  image=safeUrl(record(pageInfo.original).source)||safeUrl(record(pageInfo.thumbnail).source);
  fallbackImage=safeUrl(record(pageInfo.thumbnail).source);
 }
 return {image,fallbackImage};
}
async function repairPoster(sourceId:string,title:string,mediaType:MediaType,year:string){
 // Apple supplies official movie artwork even when Wikipedia's search page has no thumbnail.
 if(mediaType==="película"){
  const results=await itunesMovies(title);
  const exact=results.filter(e=>normal(e.title)===normal(title));
  const match=exact.find(e=>e.year===year)||exact[0];
  if(match)return {image:match.image,fallbackImage:match.fallbackImage,posterSource:"Apple TV / iTunes"};
 }
 if(sourceId.startsWith("wiki:")){
  const wiki=await wikiPagePoster(sourceId.slice(5));
  if(wiki.image)return {...wiki,posterSource:"Wikipedia"};
 }
 if(mediaType==="serie"){
  const matches=await tvMazeSearch(title);
  const exact=matches.filter(e=>normal(e.title)===normal(title));
  const match=exact.find(e=>e.year===year)||exact[0];
  if(match?.image)return {image:match.image,fallbackImage:match.fallbackImage,posterSource:"TVmaze"};
 }
 if(mediaType==="videojuego"){
  const matches=await steamSearch(title);
  const match=matches.find(e=>normal(e.title)===normal(title));
  if(match?.image)return {image:match.image,fallbackImage:match.fallbackImage,posterSource:"Steam"};
 }
 return {image:null,fallbackImage:null,posterSource:null};
}
async function steamDetail(id:string){
 const data=await get("https://store.steampowered.com/api/appdetails?appids="+id+"&l=spanish&cc=ES");
 const item=record(data[id]);
 if(item.success!==true)return {};
 const details=record(item.data);
 const date=string(record(details.release_date).date);
 const year=date.match(/(?:19|20)\d{2}/)?.[0]||null;
 const genres=array(details.genres).map(x=>string(record(x).description)).filter(Boolean).slice(0,8);
 const platforms=record(details.platforms);
 const os=["windows","mac","linux"].filter(k=>platforms[k]===true).map(k=>k==="windows"?"PC":k==="mac"?"Mac":"Linux");
 return {year,description:strip(string(details.short_description)||string(details.detailed_description)).slice(0,1050),genres,platforms:os};
}
export async function GET(request:Request){
 const session=await lifeSession(request);
 if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
 const params=new URL(request.url).searchParams;
 const detail=params.get("detail")||"";
 if(detail.startsWith("wiki:") || detail.startsWith("itunes:") || detail.startsWith("tvmaze:") || detail.startsWith("steam:")){
  const type=params.get("type") as MediaType;
  const title=(params.get("title")||"").trim().slice(0,120);
  const year=(params.get("year")||"").trim().slice(0,4);
  if(title.length>1&&["videojuego","película","serie"].includes(type)){
   const details=await repairPoster(detail,title,type,year);
   return NextResponse.json({details},{headers:{"Cache-Control":"private, max-age=0"}});
  }
 }
 if(/^steam:[0-9]{1,12}$/.test(detail)){
  const details=await steamDetail(detail.slice(6));
  return NextResponse.json({details},{headers:{"Cache-Control":"private, max-age=0"}});
 }
 const q=(params.get("q")||"").trim().slice(0,75);
 const type=params.get("type") as MediaType;
 if(!["videojuego","película","serie"].includes(type))return NextResponse.json({error:"Tipo no válido"},{status:400});
 if(q.length<2)return NextResponse.json({results:[]});
 const promises=type==="videojuego"?[rawgSearch(q),steamSearch(q),wikiSearch(q,type)]:
  type==="serie"?[tmdbSearch(q,type),tvMazeSearch(q),wikiSearch(q,type)]:
  [tmdbSearch(q,type),itunesMovies(q),wikiSearch(q,type)];
 const results=await Promise.allSettled(promises);
 const matches=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
 const sorted=dedupe(sortByName(matches,q)).slice(0,24);
 return NextResponse.json({results:sorted,providers:[...new Set(sorted.map(x=>x.source))]},{headers:{"Cache-Control":"private, max-age=0"}});
}
