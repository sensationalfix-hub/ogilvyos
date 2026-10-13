"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ReferenceCapture } from "@/components/os/reference-capture";
import { LayoutGrid, House, BriefcaseBusiness, HeartPulse, Network, LibraryBig, Plus, X } from "lucide-react";

const apps = [
 {label:"Home",href:"/",Icon:House},
 {label:"Work",href:"/work",Icon:BriefcaseBusiness},
 {label:"Life",href:"/life",Icon:HeartPulse},
 {label:"Lab",href:"/creative",Icon:Network},
 {label:"Library",href:"/references",Icon:LibraryBig},
];

export function OSDock() {
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const [capture,setCapture]=useState(false);
 useEffect(()=>setOpen(false),[pathname]);
 if(pathname.startsWith("/creative/share") || pathname.startsWith("/login")) return null;
 return <><nav className={"os-dock"+(open?" os-dock-open":"")} aria-label="Cambiar de aplicación">
  {open&&<div className="os-dock-apps" id="os-dock-apps">
   {apps.map(({label,href,Icon})=><Link key={href} href={href} className={"os-dock-app"+(pathname===href||(href!=="/"&&pathname.startsWith(href+"/"))?" is-current":"")} title={label} aria-current={pathname===href?"page":undefined}>
    <span className="os-dock-app-icon"><Icon size={21} strokeWidth={1.9}/></span>
    <span className="os-dock-app-name">{label}</span>
   </Link>)}
   <button className="os-dock-add" title="Guardar referencia desde cualquier app" aria-label="Guardar referencia" onClick={()=>{setOpen(false);setCapture(true)}}><Plus size={21}/><span>Guardar</span></button>
  </div>}
  <button className="os-dock-toggle" type="button" aria-label={open?"Cerrar Dock":"Abrir Dock"} aria-expanded={open} aria-controls={open?"os-dock-apps":undefined} onClick={()=>setOpen(v=>!v)}>
   {open?<X size={19}/>:<LayoutGrid size={19}/>}<span>Dock</span>
  </button>
 </nav><ReferenceCapture open={capture} onClose={()=>setCapture(false)}/></>;
}
