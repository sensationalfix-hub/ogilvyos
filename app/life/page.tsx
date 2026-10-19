"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check,
  ChevronLeft, ChevronRight, CircleDollarSign, Clapperboard, Dumbbell, FolderKanban,
  Gamepad2, HeartPulse, House, LayoutDashboard, ListTodo, Pencil, Plus, Sparkles,
  Target, Trash2, WalletCards, X, User, Bike, Film, NotebookPen,
} from "lucide-react";
import { ModeLogo } from "@/components/os/mode-logo";
import styles from "./life.module.css";

type Kind = "journal" | "finance" | "subscription" | "media" | "health" | "plan";
type Section = "today" | "journal" | "money" | "culture" | "health" | "agenda" | "areas" | "tasks";
type Entry = { id:string; kind:Kind; title:string; note:string; entry_date:string; amount:number|null; category:string|null; status:string|null; billing_day:number|null; metadata:Record<string,unknown>; created_at:string };
type Area = {id:string; name:string;slug:string;accent:string|null;icon:string|null;position:number};
type Task = {id:string;title:string;area_id:string|null;status:string;due_date:string|null;starts_at:string|null;priority:string};
type LifeState = {areas:Area[];tasks:Task[];goals:unknown[];projects:unknown[]};
type Draft = {id?:string;kind:Kind;title:string;note:string;entry_date:string;amount:string;category:string;status:string;billing_day:string;progress:string;mood:string;metric:string};
const nav:{id:Section;label:string;icon:typeof LayoutDashboard}[] = [
  {id:"today",label:"Hoy",icon:LayoutDashboard},
  {id:"journal",label:"Diario",icon:BookOpen},
  {id:"money",label:"Dinero",icon:WalletCards},
  {id:"culture",label:"Cultura",icon:Gamepad2},
  {id:"health",label:"Salud",icon:Activity},
  {id:"agenda",label:"Agenda",icon:CalendarDays},
  {id:"areas",label:"Áreas",icon:Sparkles},
  {id:"tasks",label:"Tareas",icon:ListTodo},
];
const kinds:Record<Kind,string>={journal:"Entrada de diario",finance:"Movimiento",subscription:"Suscripción",media:"Título de cultura",health:"Registro de salud",plan:"Plan personal"};
const areaIcons:Record<string,typeof User>={User,WalletCards,Activity,House,Bike,Sparkles,Gamepad2};
const areaColors:Record<string,string>={personal:"#e7ff3f",dinero:"#dfe6dc",salud:"#f5d3d7",casa:"#e9dfcf",moto:"#d8d7ef",creatividad:"#f3e5a9",ocio:"#d7eadf"};
const localDay=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const parseDay=(s:string)=>new Date(s+"T12:00:00");
const prettyDay=(s:string,opts?:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat("es-ES",opts||{day:"numeric",month:"long"}).format(parseDay(s));
const euro=(n:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n);
const monthKey=(s:string)=>s.slice(0,7);
const short=(value:string,limit=95)=>value.length>limit?value.slice(0,limit).trimEnd()+"…":value;
const metaString=(entry:Entry,key:string)=>String(entry.metadata?.[key]??"");
const capital=(s:string)=>s?s.slice(0,1).toUpperCase()+s.slice(1):s;
function blank(kind:Kind,date=localDay()):Draft {
 return {kind,title:"",note:"",entry_date:date,amount:"",category:kind==="media"?"videojuego":kind==="health"?"entreno":"general",status:kind==="media"?"now":kind==="finance"?"expense":"active",billing_day:String(new Date().getDate()),progress:"0",mood:"normal",metric:""};
}
function fromEntry(e:Entry):Draft {
 return {id:e.id,kind:e.kind,title:e.title,note:e.note,entry_date:e.entry_date,amount:e.amount===null?"":String(Math.abs(Number(e.amount))),category:e.category||"",status:e.status||(e.kind==="finance"?"expense":"active"),billing_day:e.billing_day?String(e.billing_day):"",progress:metaString(e,"progress")||"0",mood:metaString(e,"mood")||"normal",metric:metaString(e,"metric")};
}
function PanelHead({title,action,click}:{title:string;action?:string;click?:()=>void}){
 return <div className={styles.panelHead}><h2>{title}</h2>{action&&click&&<button type="button" onClick={click}>{action}<ArrowUpRight size={16}/></button>}</div>;
}
function Placeholder({children}:{children:React.ReactNode}){return <div className={styles.placeholder}>{children}</div>;}
export default function LifePage(){
 const [section,setSection]=useState<Section>("today");
 const [state,setState]=useState<LifeState>({areas:[],tasks:[],goals:[],projects:[]});
 const [entries,setEntries]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [capture,setCapture]=useState("");
 const [creating,setCreating]=useState(false);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [saving,setSaving]=useState(false);
 const [activeDate,setActiveDate]=useState(localDay());
 const [filter,setFilter]=useState("all");
 const today=localDay();
 const thisMonth=monthKey(today);
 const go=useCallback((id:Section)=>{
   setSection(id);setFilter("all");
   const url="/life"+(id==="today"?"":"?section="+id);
   window.history.pushState(null,"",url);
 },[]);
 const load=useCallback(async(first=false)=>{
   if(first)setLoading(true);
   try{
    const [a,b]=await Promise.all([fetch("/api/life/state",{cache:"no-store"}),fetch("/api/life/entries",{cache:"no-store"})]);
    if(!a.ok||!b.ok){const bad=await (!a.ok?a:b).json().catch(()=>({}));throw new Error(bad.error||"No se han podido cargar tus datos");}
    setState(await a.json() as LifeState);setEntries((await b.json() as {entries:Entry[]}).entries);
    setError("");
   }catch(e){setError(e instanceof Error?e.message:"Error de conexión");}
   finally{if(first)setLoading(false);}
 },[]);
 useEffect(()=>{
   const sync=()=>{const s=new URLSearchParams(window.location.search).get("section");setSection(nav.some(x=>x.id===s)?s as Section:"today");};
   sync();window.addEventListener("popstate",sync);
   void load(true);
   return ()=>window.removeEventListener("popstate",sync);
 },[load]);
 useEffect(()=>{
   const current=nav.find(n=>n.id===section);
   try { window.localStorage.setItem("os.recent.life",JSON.stringify({app:"life",title:current?.label||"Hoy",subtitle:"Life · "+current?.label,href:"/life"+(section==="today"?"":"?section="+section),at:Date.now()}));}catch{}
 },[section]);
 useEffect(()=>{
   if(!draft)return;
   const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!saving)setDraft(null);};
   document.addEventListener("keydown",onKey);return ()=>document.removeEventListener("keydown",onKey);
 },[draft,saving]);
 const start=(kind:Kind,entry?:Entry,date?:string)=>{setError("");setDraft(entry?fromEntry(entry):blank(kind,date));};
 const put=(field:keyof Draft,value:string)=>setDraft(d=>d?{...d,[field]:value}:d);
 async function submit(e:FormEvent){
   e.preventDefault();if(!draft||saving)return;setSaving(true);setError("");
   try{
     const amt=draft.amount===""?null:Number(draft.amount);
     if(amt!==null&&(!Number.isFinite(amt)||amt<0))throw new Error("Introduce un importe positivo");
     const payload={
       ...(draft.id?{id:draft.id}:{}),kind:draft.kind,
       title:draft.title.trim()||(draft.kind==="journal"?"Diario · "+prettyDay(draft.entry_date):""),
       note:draft.note,entry_date:draft.entry_date,
       amount:amt===null?null:draft.kind==="finance"&&draft.status==="expense"?-amt:amt,
       category:draft.category,status:draft.status,
       billing_day:draft.kind==="subscription"?Number(draft.billing_day)||null:null,
       metadata:{...(draft.kind==="media"?{progress:Number(draft.progress)||0}:{}),...(draft.kind==="journal"?{mood:draft.mood}:{}),...(draft.kind==="health"?{metric:draft.metric}: {})},
     };
     const r=await fetch("/api/life/entries",{method:draft.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
     const result=await r.json().catch(()=>({}));
     if(!r.ok)throw new Error(result.error||"No se pudo guardar");
     setDraft(null);await load();
   }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}
   finally{setSaving(false);}
 }
 async function remove(e:Entry){
   if(!window.confirm("¿Eliminar «"+e.title+"»?"))return;
   try{
    const r=await fetch("/api/life/entries?id="+encodeURIComponent(e.id),{method:"DELETE"});
    if(!r.ok)throw new Error((await r.json()).error||"Error al eliminar");
    setDraft(null);await load();
   }catch(x){setError(x instanceof Error?x.message:"No se pudo eliminar");}
 }
 async function quickCapture(){
   if(!capture.trim()||creating)return;setCreating(true);
   try{
    const r=await fetch("/api/life/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:capture.trim()})});
    if(!r.ok)throw new Error((await r.json()).error||"Error al guardar");
    setCapture("");await load();
   }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}
   finally{setCreating(false);}
 }
 const journals=entries.filter(e=>e.kind==="journal");
 const finance=entries.filter(e=>e.kind==="finance");
 const subscriptions=entries.filter(e=>e.kind==="subscription"&&e.status!=="cancelled");
 const media=entries.filter(e=>e.kind==="media");
 const wellness=entries.filter(e=>e.kind==="health");
 const plans=entries.filter(e=>e.kind==="plan");
 const spent=finance.filter(e=>monthKey(e.entry_date)===thisMonth&&Number(e.amount)<0).reduce((s,e)=>s+Math.abs(Number(e.amount)),0);
 const earned=finance.filter(e=>monthKey(e.entry_date)===thisMonth&&Number(e.amount)>0).reduce((s,e)=>s+Number(e.amount),0);
 const recurring=subscriptions.filter(e=>e.status!=="paused").reduce((s,e)=>s+Number(e.amount||0),0);
 const activeMedia=media.filter(e=>e.status==="now");
 const nextPlans=plans.filter(e=>e.entry_date>=today).sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
 const todayJournal=journals.find(e=>e.entry_date===today);
 const selectedJournal=journals.find(e=>e.entry_date===activeDate);
 const weekHealth=wellness.filter(e=>parseDay(e.entry_date).getTime()>=Date.now()-7*86400000);
 const monthEntries=entries.filter(e=>monthKey(e.entry_date)===monthKey(activeDate));
 const calendarDays=useMemo(()=>{
   const d=parseDay(activeDate),start=new Date(d.getFullYear(),d.getMonth(),1),offset=(start.getDay()+6)%7;
   return Array.from({length:42},(_,i)=>{const date=new Date(d.getFullYear(),d.getMonth(),1-offset+i);return localDay(date);});
 },[activeDate]);
 const moveMonth=(offset:number)=>{const d=parseDay(activeDate);setActiveDate(localDay(new Date(d.getFullYear(),d.getMonth()+offset,Math.min(d.getDate(),28))));};
 const EntryRows=({items,empty}:{items:Entry[];empty:string})=><div className={styles.entryRows}>{items.length?items.map(entry=>
  <button key={entry.id} type="button" className={styles.entryRow} onClick={()=>start(entry.kind,entry)}>
   <span className={styles.entryDate}>{prettyDay(entry.entry_date,{day:"2-digit",month:"short"})}</span>
   <span className={styles.entryCopy}><strong>{entry.title}</strong><small>{entry.note?short(entry.note,100):entry.category||capital(entry.status||"")}</small></span>
   {entry.amount!==null&&<b className={Number(entry.amount)<0?styles.negative:styles.positive}>{euro(Number(entry.amount))}</b>}
   <ChevronRight size={15}/>
  </button>):<Placeholder>{empty}</Placeholder>}</div>;
 return <div className={styles.shell}>
   <aside className={styles.sidebar}>
    <div className={styles.logoWrap}><ModeLogo mode="life"/></div>
    <div className={styles.navLabel}>LIFE <small>Personal · Supabase</small></div>
    <a className={styles.navHome} href="/"><House size={18}/> Home</a>
    <nav className={styles.nav} aria-label="Secciones LifeOS">
      {nav.map(({id,label,icon:Icon},i)=><button type="button" key={id} className={(section===id?styles.navActive:"")+" "+(i===6?styles.navSeparated:"")} onClick={()=>go(id)}><Icon size={18}/>{label}</button>)}
    </nav>
    <div className={styles.source}><i/><div><strong>SUPABASE</strong><small>{loading?"Conectando…":error?"Comprueba la conexión":"Vida sincronizada"}</small></div></div>
   </aside>
   <main className={styles.main}>
    <header className={styles.header}>
      <div className={styles.breadcrumb}><span>LIFE</span><ChevronRight size={12}/><strong>{nav.find(x=>x.id===section)?.label}</strong></div>
      <div className={styles.capture}><Plus size={17}/><input value={capture} onChange={e=>setCapture(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void quickCapture();}} placeholder="Captura una tarea o idea…" aria-label="Captura rápida"/><button type="button" disabled={!capture.trim()||creating} onClick={()=>void quickCapture()}>{creating?"…":"Guardar"}</button></div>
    </header>
    {error&&<div className={styles.error} role="alert">{error}<button type="button" onClick={()=>setError("")}><X size={15}/></button></div>}
    <div className={styles.scrollArea}>
     {section==="today"&&<div className={styles.dashboard}>
       <div className={styles.dashboardTop}><div className={styles.dateBlock}><small>{new Intl.DateTimeFormat("es-ES",{weekday:"long",month:"long",year:"numeric"}).format(parseDay(today))}</small><strong>{new Date().getDate()}</strong></div><span className={styles.todayHint}>Lo que importa, en un vistazo.</span></div>
       <div className={styles.homeGrid}>
         <section className={styles.card+" "+styles.journalCard} style={{"--accent":areaColors.personal} as CSSProperties}>
           <PanelHead title="Diario" action="Abrir diario" click={()=>go("journal")}/>
           <div className={styles.bigDate}>{prettyDay(today,{weekday:"long",day:"numeric",month:"long"})}</div>
           <div className={styles.weekStrip}>{Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const date=localDay(d);return <button type="button" key={date} onClick={()=>{setActiveDate(date);go("journal");}} className={date===today?styles.dayCurrent:""}><span>{new Intl.DateTimeFormat("es-ES",{weekday:"short"}).format(d).replace(".","")}</span><b>{d.getDate()}</b><i className={journals.some(e=>e.entry_date===date)?styles.marked:""}/></button>;})}</div>
           {todayJournal?<button type="button" className={styles.journalExcerpt} onClick={()=>start("journal",todayJournal)}><Pencil size={16}/><span>{short(todayJournal.note||todayJournal.title,175)}</span><ChevronRight size={16}/></button>:<button type="button" className={styles.addBig} onClick={()=>start("journal",undefined,today)}><Plus size={18}/> Escribir el día de hoy</button>}
         </section>
         <section className={styles.card+" "+styles.moneyCard} style={{"--accent":areaColors.dinero} as CSSProperties}>
          <PanelHead title="Dinero" action="Ver movimientos" click={()=>go("money")}/>
          <div className={styles.metricCaption}>BALANCE REGISTRADO · {prettyDay(today,{month:"long",year:"numeric"}).toUpperCase()}</div>
          <div className={styles.bigMoney}>{euro(earned-spent)}</div>
          <div className={styles.moneyColumns}><div><ArrowDownLeft size={17}/><span>Ingresos</span><strong>{euro(earned)}</strong></div><div><ArrowUpRight size={17}/><span>Gastos</span><strong>{euro(spent)}</strong></div></div>
          <div className={styles.nextBilling}><span>Suscripciones previstas / mes</span><strong>{euro(recurring)}</strong></div>
          <div className={styles.actionRow}><button onClick={()=>start("finance")}><Plus size={15}/> Movimiento</button><button onClick={()=>start("subscription")}><Plus size={15}/> Suscripción</button></div>
         </section>
         <section className={styles.card+" "+styles.cultureCard} style={{"--accent":areaColors.ocio} as CSSProperties}>
          <PanelHead title="Cultura" action="Mi biblioteca" click={()=>go("culture")}/>
          <div className={styles.cardCounter}>{activeMedia.length.toString().padStart(2,"0")}<small>EN CURSO</small></div>
          <div className={styles.miniStack}>{activeMedia.slice(0,3).map(e=><button key={e.id} onClick={()=>start("media",e)}><Gamepad2 size={16}/><span>{e.title}</span><ChevronRight size={14}/></button>)}
          {!activeMedia.length&&<Placeholder>Todavía no estás siguiendo ningún juego, película o serie.</Placeholder>}</div>
          <button className={styles.softAction} onClick={()=>start("media")}><Plus size={15}/> Añadir título</button>
         </section>
         <section className={styles.card+" "+styles.healthCard} style={{"--accent":areaColors.salud} as CSSProperties}>
          <PanelHead title="Salud" action="Ver registros" click={()=>go("health")}/>
          <div className={styles.cardCounter}>{weekHealth.length.toString().padStart(2,"0")}<small>REGISTROS · 7 DÍAS</small></div>
          <div className={styles.miniStack}>{wellness.slice(0,3).map(e=><button key={e.id} onClick={()=>start("health",e)}><HeartPulse size={16}/><span>{e.title}</span><small>{prettyDay(e.entry_date)}</small></button>)}
          {!wellness.length&&<Placeholder>Registra un entrenamiento, una comida o tu peso.</Placeholder>}</div>
          <button className={styles.softAction} onClick={()=>start("health")}><Plus size={15}/> Añadir registro</button>
         </section>
         <section className={styles.card+" "+styles.agendaCard} style={{"--accent":areaColors.moto} as CSSProperties}>
          <PanelHead title="Próximos planes" action="Abrir agenda" click={()=>go("agenda")}/>
          <div className={styles.planList}>{nextPlans.slice(0,3).map(e=><button key={e.id} onClick={()=>start("plan",e)}><b>{parseDay(e.entry_date).getDate()}<small>{prettyDay(e.entry_date,{month:"short"})}</small></b><span>{e.title}</span><ChevronRight size={15}/></button>)}
          {!nextPlans.length&&<Placeholder>Tu agenda personal está despejada.</Placeholder>}</div>
          <button className={styles.softAction} onClick={()=>start("plan")}><Plus size={15}/> Añadir plan</button>
         </section>
         <section className={styles.card+" "+styles.tasksCard} style={{"--accent":areaColors.creatividad} as CSSProperties}>
          <PanelHead title="Por resolver" action="Ver tareas" click={()=>go("tasks")}/>
          <div className={styles.taskSummary}><b>{state.tasks.length.toString().padStart(2,"0")}</b><span>tareas personales pendientes</span></div>
          <div className={styles.miniStack}>{state.tasks.slice(0,3).map(t=><div className={styles.taskMini} key={t.id}><span className={styles.taskDot}/>{t.title}</div>)}{!state.tasks.length&&<Placeholder>No hay tareas personales pendientes.</Placeholder>}</div>
         </section>
       </div>
      </div>}
     {section==="journal"&&<div className={styles.contentLayout}>
       <div className={styles.sectionActions}><div><small>HOBONICHI DIGITAL</small><h1>Diario</h1></div><button className={styles.primary} onClick={()=>start("journal",selectedJournal,activeDate)}><Plus size={17}/>{selectedJournal?"Editar día":"Escribir"}</button></div>
       <div className={styles.journalLayout}>
         <section className={styles.card+" "+styles.calendarCard} style={{"--accent":areaColors.personal} as CSSProperties}>
          <div className={styles.calendarHead}><button onClick={()=>moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft/></button><strong>{capital(prettyDay(activeDate,{month:"long",year:"numeric"}))}</strong><button onClick={()=>moveMonth(1)} aria-label="Mes siguiente"><ChevronRight/></button></div>
          <div className={styles.calendarGrid}>{["L","M","X","J","V","S","D"].map((d,i)=><span className={styles.weekName} key={i}>{d}</span>)}
           {calendarDays.map(date=><button key={date} onClick={()=>setActiveDate(date)} className={(date===activeDate?styles.selectedDate:"")+" "+(monthKey(date)!==monthKey(activeDate)?styles.outMonth:"")}><b>{parseDay(date).getDate()}</b><i className={journals.some(e=>e.entry_date===date)?styles.marked:""}/></button>)}
          </div>
          <div className={styles.calendarFoot}>{monthEntries.filter(e=>e.kind==="journal").length} días registrados este mes <button onClick={()=>setActiveDate(today)}>Hoy</button></div>
         </section>
         <section className={styles.card+" "+styles.selectedJournal} style={{"--accent":areaColors.personal} as CSSProperties}>
          <PanelHead title={prettyDay(activeDate,{weekday:"long",day:"numeric",month:"long"})}/>
          {selectedJournal?<><div className={styles.moodTag}>{capital(metaString(selectedJournal,"mood")||"normal")}</div><h2>{selectedJournal.title}</h2><p>{selectedJournal.note||"Sin notas añadidas."}</p><button className={styles.softAction} onClick={()=>start("journal",selectedJournal)}><Pencil size={15}/> Editar entrada</button></>:<div className={styles.emptyJournal}><NotebookPen size={34}/><h2>Página en blanco</h2><p>Un día no necesita ser extraordinario para merecer unas líneas.</p><button className={styles.primary} onClick={()=>start("journal",undefined,activeDate)}><Plus size={16}/> Escribir este día</button></div>}
         </section>
       </div>
       <section className={styles.card}><PanelHead title="Últimas páginas"/><EntryRows items={journals.slice(0,12)} empty="Todavía no has escrito ninguna página."/></section>
      </div>}
     {section==="money"&&<div className={styles.contentLayout}>
       <div className={styles.sectionActions}><div><small>CONTROL PERSONAL</small><h1>Dinero</h1></div><div className={styles.actionRow}><button className={styles.primary} onClick={()=>start("finance")}><Plus size={16}/> Movimiento</button><button onClick={()=>start("subscription")}><Plus size={16}/> Suscripción</button></div></div>
       <div className={styles.financeStats}>
        <div className={styles.card} style={{"--accent":areaColors.dinero} as CSSProperties}><small>INGRESOS · ESTE MES</small><strong>{euro(earned)}</strong></div>
        <div className={styles.card} style={{"--accent":areaColors.salud} as CSSProperties}><small>GASTOS REGISTRADOS</small><strong>{euro(spent)}</strong></div>
        <div className={styles.card} style={{"--accent":areaColors.personal} as CSSProperties}><small>BALANCE REGISTRADO</small><strong>{euro(earned-spent)}</strong></div>
       </div>
       <div className={styles.twoColumns}>
        <section className={styles.card}><PanelHead title="Movimientos"/><div className={styles.filterRow}><button className={filter==="all"?styles.filterActive:""} onClick={()=>setFilter("all")}>Todos</button><button className={filter==="month"?styles.filterActive:""} onClick={()=>setFilter("month")}>Este mes</button></div><EntryRows items={finance.filter(e=>filter!=="month"||monthKey(e.entry_date)===thisMonth)} empty="Añade tu primer ingreso o gasto para empezar a calcular."/></section>
        <section className={styles.card}><PanelHead title="Suscripciones" action="Añadir" click={()=>start("subscription")}/><div className={styles.subscriptionTotal}><small>IMPORTE MENSUAL ACTIVO</small><strong>{euro(recurring)}</strong></div><div className={styles.entryRows}>{subscriptions.length?subscriptions.sort((a,b)=>(a.billing_day||0)-(b.billing_day||0)).map(e=><button key={e.id} className={styles.subscriptionRow} onClick={()=>start("subscription",e)}><span className={styles.billDay}>{e.billing_day||"·"}<small>día</small></span><span><strong>{e.title}</strong><small>{e.status==="paused"?"Pausada":e.category||"Mensual"}</small></span><b>{e.amount!==null?euro(Number(e.amount)):"—"}</b><ChevronRight size={15}/></button>):<Placeholder>Añade tus suscripciones y su día de cobro.</Placeholder>}</div><p className={styles.footnote}>Las suscripciones son previsiones. No se descuentan dos veces del balance registrado.</p></section>
       </div>
      </div>}
     {section==="culture"&&<div className={styles.contentLayout}>
       <div className={styles.sectionActions}><div><small>JUEGOS · CINE · SERIES</small><h1>Cultura</h1></div><button className={styles.primary} onClick={()=>start("media")}><Plus size={16}/> Añadir título</button></div>
       <div className={styles.filterRow}>{[{id:"all",label:"Todo"},{id:"now",label:"En curso"},{id:"backlog",label:"Backlog"},{id:"wishlist",label:"Wishlist"},{id:"completed",label:"Terminados"}].map(x=><button key={x.id} className={filter===x.id?styles.filterActive:""} onClick={()=>setFilter(x.id)}>{x.label}</button>)}</div>
       <div className={styles.mediaGrid}>{media.filter(e=>filter==="all"||e.status===filter).map(e=><button key={e.id} className={styles.mediaCard+" "+styles.card} onClick={()=>start("media",e)} style={{"--accent":areaColors.ocio} as CSSProperties}><span className={styles.mediaIcon}>{e.category==="película"?<Film/>:e.category==="serie"?<Clapperboard/>:<Gamepad2/>}</span><small>{capital(e.category||"videojuego")} · {e.status==="now"?"En curso":e.status==="completed"?"Terminado":e.status==="wishlist"?"Wishlist":"Backlog"}</small><strong>{e.title}</strong><div className={styles.progressBar}><i style={{width:(Number(metaString(e,"progress"))||0)+"%"}}/></div><span className={styles.progressCaption}>{metaString(e,"progress")||0}% · {e.entry_date?prettyDay(e.entry_date):""}</span></button>)}{!media.filter(e=>filter==="all"||e.status===filter).length&&<div className={styles.emptySpan}><Placeholder>No hay títulos en esta categoría. Añade el primero.</Placeholder></div>}</div>
      </div>}
     {section==="health"&&<div className={styles.contentLayout}>
       <div className={styles.sectionActions}><div><small>CUERPO · HÁBITOS · COMIDAS</small><h1>Salud</h1></div><button className={styles.primary} onClick={()=>start("health")}><Plus size={16}/> Registrar</button></div>
       <div className={styles.financeStats}><div className={styles.card} style={{"--accent":areaColors.salud} as CSSProperties}><small>ÚLTIMOS 7 DÍAS</small><strong>{weekHealth.length} <em>registros</em></strong></div><div className={styles.card} style={{"--accent":areaColors.personal} as CSSProperties}><small>ENTRENAMIENTOS · 7 DÍAS</small><strong>{weekHealth.filter(e=>e.category==="entreno").length}</strong></div><div className={styles.card} style={{"--accent":areaColors.dinero} as CSSProperties}><small>ÚLTIMO PESO REGISTRADO</small><strong>{wellness.find(e=>e.category==="peso")?.metadata?.metric ? String(wellness.find(e=>e.category==="peso")?.metadata.metric)+" kg":"—"}</strong></div></div>
       <section className={styles.card}><PanelHead title="Registro personal"/><div className={styles.filterRow}>{[{id:"all",label:"Todo"},{id:"entreno",label:"Entrenamientos"},{id:"comida",label:"Comidas"},{id:"peso",label:"Peso"},{id:"otro",label:"Otros"}].map(x=><button key={x.id} className={filter===x.id?styles.filterActive:""} onClick={()=>setFilter(x.id)}>{x.label}</button>)}</div><EntryRows items={wellness.filter(e=>filter==="all"||e.category===filter)} empty="Sin registros todavía. Empieza por el próximo entrenamiento o comida."/></section>
      </div>}
     {section==="agenda"&&<div className={styles.contentLayout}>
       <div className={styles.sectionActions}><div><small>FUERA DEL TRABAJO</small><h1>Agenda personal</h1></div><button className={styles.primary} onClick={()=>start("plan")}><Plus size={16}/> Nuevo plan</button></div>
       <div className={styles.twoColumns}>
        <section className={styles.card}><PanelHead title="Próximos planes"/><EntryRows items={nextPlans} empty="Nada planificado. Un hueco libre tampoco es una tragedia."/></section>
        <section className={styles.card}><PanelHead title="Historial"/><EntryRows items={plans.filter(e=>e.entry_date<today)} empty="Aquí aparecerán tus planes pasados."/></section>
       </div>
      </div>}
     {section==="areas"&&<div className={styles.contentLayout}><div className={styles.sectionActions}><div><small>TUS CONTEXTOS</small><h1>Áreas</h1></div></div><div className={styles.areasGrid}>{state.areas.map(a=>{const Icon=areaIcons[a.icon||""]||Sparkles;return <div key={a.id} className={styles.card+" "+styles.areaTile} style={{"--accent":a.accent||areaColors[a.slug]||areaColors.personal} as CSSProperties}><Icon size={23}/><strong>{a.name}</strong><small>{state.tasks.filter(t=>t.area_id===a.id).length} tareas pendientes</small></div>;})}</div></div>}
     {section==="tasks"&&<div className={styles.contentLayout}><div className={styles.sectionActions}><div><small>CAPTURA UNIVERSAL</small><h1>Tareas personales</h1></div></div><section className={styles.card}><PanelHead title="Pendientes"/>{state.tasks.length?state.tasks.map(t=><div className={styles.taskListRow} key={t.id}><ListTodo size={18}/><strong>{t.title}</strong><span>{t.due_date?prettyDay(t.due_date):"Backlog"}</span></div>):<Placeholder>Sin tareas. Puedes añadirlas desde la captura rápida de arriba.</Placeholder>}</section></div>}
    </div>
   </main>
   {draft&&<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setDraft(null);}}>
    <form className={styles.editor} onSubmit={e=>void submit(e)}>
      <div className={styles.editorHead}><div><small>{draft.id?"EDITAR":"NUEVO REGISTRO"}</small><h2>{kinds[draft.kind]}</h2></div><button type="button" onClick={()=>setDraft(null)} aria-label="Cerrar"><X size={20}/></button></div>
      <div className={styles.editorBody}>
       <label>Fecha<input required type="date" value={draft.entry_date} onChange={e=>put("entry_date",e.target.value)}/></label>
       {draft.kind==="journal"&&<label>¿Cómo fue el día?<select value={draft.mood} onChange={e=>put("mood",e.target.value)}><option value="bien">Bien</option><option value="normal">Normal</option><option value="regular">Regular</option><option value="difícil">Difícil</option><option value="increíble">Increíble</option></select></label>}
       {draft.kind==="finance"&&<label>Tipo<select value={draft.status} onChange={e=>put("status",e.target.value)}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>}
       {draft.kind==="subscription"&&<label>Estado<select value={draft.status} onChange={e=>put("status",e.target.value)}><option value="active">Activa</option><option value="paused">Pausada</option><option value="cancelled">Cancelada</option></select></label>}
       {draft.kind==="media"&&<><label>Medio<select value={draft.category} onChange={e=>put("category",e.target.value)}><option value="videojuego">Videojuego</option><option value="película">Película</option><option value="serie">Serie</option></select></label><label>Estado<select value={draft.status} onChange={e=>put("status",e.target.value)}><option value="now">En curso</option><option value="backlog">Backlog</option><option value="wishlist">Wishlist</option><option value="completed">Terminado</option></select></label><label>Progreso (%)<input type="number" min="0" max="100" value={draft.progress} onChange={e=>put("progress",e.target.value)}/></label></>}
       {draft.kind==="health"&&<><label>Tipo<select value={draft.category} onChange={e=>put("category",e.target.value)}><option value="entreno">Entrenamiento</option><option value="comida">Comida</option><option value="peso">Peso</option><option value="otro">Otro</option></select></label>{draft.category==="peso"&&<label>Peso (kg)<input type="number" min="0" max="400" step=".1" value={draft.metric} onChange={e=>put("metric",e.target.value)}/></label>}</>}
       {draft.kind!=="journal"&&<label>Título<input required maxLength={180} placeholder={{finance:"Ej. Compra semanal",subscription:"Ej. Spotify",media:"Ej. Resident Evil 4",health:"Ej. Entreno de fuerza",plan:"Ej. Cine el sábado"}[draft.kind]||"Título"} value={draft.title} onChange={e=>put("title",e.target.value)}/></label>}
       {draft.kind==="journal"&&<label>Título (opcional)<input maxLength={180} placeholder="Una pequeña victoria, un día normal…" value={draft.title} onChange={e=>put("title",e.target.value)}/></label>}
       {(draft.kind==="finance"||draft.kind==="subscription")&&<label>Importe (€)<input type="number" min="0" step=".01" required placeholder="0,00" value={draft.amount} onChange={e=>put("amount",e.target.value)}/></label>}
       {draft.kind==="subscription"&&<label>Día de cobro (1–31)<input type="number" min="1" max="31" required value={draft.billing_day} onChange={e=>put("billing_day",e.target.value)}/></label>}
       {draft.kind==="finance"&&<label>Categoría<input maxLength={60} placeholder="Alimentación, ocio, vivienda…" value={draft.category} onChange={e=>put("category",e.target.value)}/></label>}
       <label className={styles.fullField}>{draft.kind==="journal"?"Tu página":"Notas"}<textarea rows={draft.kind==="journal"?9:4} placeholder={draft.kind==="journal"?"Escribe lo que quieras recordar…":"Detalles, comentarios…"} value={draft.note} onChange={e=>put("note",e.target.value)} /></label>
      </div>
      <div className={styles.editorFooter}>{draft.id&&<button className={styles.deleteButton} type="button" onClick={()=>{const item=entries.find(e=>e.id===draft.id);if(item)void remove(item);}}><Trash2 size={16}/> Eliminar</button>}<button type="button" onClick={()=>setDraft(null)}>Cancelar</button><button className={styles.primary} type="submit" disabled={saving}><Check size={16}/>{saving?"Guardando…":"Guardar"}</button></div>
    </form>
   </div>}
 </div>;
}
