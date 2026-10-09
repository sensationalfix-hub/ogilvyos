"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2,
  Clock3, FolderKanban, Images, LayoutGrid, LogOut, Orbit, Sparkles, SunMedium,
  Workflow,
} from "lucide-react";
import styles from "./home.module.css";

type AppKey = "work" | "life" | "creative";
type RecentVisit = { app: AppKey; title: string; subtitle: string; href: string; at: number };
type WorkState = {
  counts?: { activeProjects?: number; activeTasks?: number };
  tasks?: Array<{ name: string; dateStart?: string|null; date?: string|null; status?: string }>;
};
type CreativeBoard = { id: string; title: string; updated_at: string; nodes?: unknown[] };
type LifeState = { counts?: { tasks?: number; goals?: number } };
type OverviewData = { work?: WorkState; boards?: CreativeBoard[]; life?: LifeState };
const recentKeys = ["os.recent.work", "os.recent.life", "os.recent.creative"] as const;
const permitted = ["/work", "/life", "/creative"];
const appTitle: Record<AppKey, string> = { work: "Work", life: "Life", creative: "Creative Lab" };

function validRecent(value: unknown): value is RecentVisit {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RecentVisit>;
  return (v.app === "work" || v.app === "life" || v.app === "creative")
    && typeof v.title === "string" && typeof v.subtitle === "string"
    && typeof v.at === "number" && Number.isFinite(v.at)
    && typeof v.href === "string"
    && permitted.some(prefix => (v.href as string) === prefix || (v.href as string).startsWith(prefix + "?") || (v.href as string).startsWith(prefix + "/"));
}
function prettyDate(date: Date, full = false) {
  return new Intl.DateTimeFormat("es-ES", full
    ? { weekday: "long", day: "numeric", month: "long" }
    : { day: "numeric", month: "short" }).format(date).replace(".", "");
}
function dateOf(value?: string|null): Date|null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function AppIcon({app}:{app:AppKey|"library"}) {
  if (app === "work") return <BriefcaseBusiness aria-hidden="true"/>;
  if (app === "life") return <SunMedium aria-hidden="true"/>;
  if (app === "creative") return <Workflow aria-hidden="true"/>;
  return <Images aria-hidden="true"/>;
}
function RecentIcon({app}:{app:AppKey}) {
  if (app === "work") return <CalendarDays aria-hidden="true"/>;
  if (app === "creative") return <Orbit aria-hidden="true"/>;
  return <Activity aria-hidden="true"/>;
}

export default function HomePage() {
  const [now, setNow] = useState<Date|null>(null);
  const [firstName, setFirstName] = useState("");
  const [overview, setOverview] = useState<OverviewData>({});
  const [recents, setRecents] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setNow(new Date());
    try {
      const existing = recentKeys
        .map(key => { try { return JSON.parse(window.localStorage.getItem(key) || "null") as unknown; } catch { return null; } })
        .filter(validRecent);
      setRecents(existing.sort((a, b) => b.at - a.at));
    } catch { /* Some private browsers restrict browser storage */ }

    let active = true;
    const get = async (url: string): Promise<unknown> => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Service unavailable");
      return response.json();
    };
    Promise.allSettled([
      get("/api/auth/session"),
      get("/api/notion/state"),
      get("/api/creative"),
      get("/api/life/state"),
    ]).then(results => {
      if (!active) return;
      const user = results[0];
      if (user.status === "fulfilled") {
        const name = (user.value as { name?: string }).name || "";
        setFirstName(name.trim().split(/\s+/)[0] || "");
      }
      setOverview({
        work: results[1].status === "fulfilled" ? results[1].value as WorkState : undefined,
        boards: results[2].status === "fulfilled" && Array.isArray((results[2].value as { boards?: CreativeBoard[] }).boards)
          ? (results[2].value as { boards: CreativeBoard[] }).boards : undefined,
        life: results[3].status === "fulfilled" ? results[3].value as LifeState : undefined,
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const nameSuffix = firstName ? ", " + firstName : "";
  const nextTask = useMemo(() => {
    if (!overview.work?.tasks || !now) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return overview.work.tasks
      .filter(task => !["Terminado", "Cancelado", "Completado"].includes(task.status || ""))
      .map(task => ({ ...task, when: dateOf(task.dateStart || task.date) }))
      .filter((task): task is typeof task & { when: Date } => Boolean(task.when && task.when.getTime() >= today))
      .sort((a, b) => a.when.getTime() - b.when.getTime())[0] || null;
  }, [overview.work, now]);

  const newestBoard = useMemo(() => {
    const boards = overview.boards || [];
    return [...boards].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  }, [overview.boards]);

  const continueCards = useMemo(() => {
    const cards = [...recents];
    if (newestBoard && !cards.some(r => r.app === "creative")) {
      cards.push({
        app: "creative", title: newestBoard.title,
        subtitle: "Creative Lab · mapa de ideas",
        href: "/creative?board=" + encodeURIComponent(newestBoard.id),
        at: Date.parse(newestBoard.updated_at) || 0,
      });
    }
    if (!cards.some(r => r.app === "work")) cards.push({
      app: "work", title: "Mi semana", subtitle: "Work · planner",
      href: "/work?view=week", at: 0,
    });
    if (!cards.some(r => r.app === "life")) cards.push({
      app: "life", title: "Vista general", subtitle: "Life · tu espacio personal",
      href: "/life", at: 0,
    });
    if (!cards.some(r => r.app === "creative")) cards.push({
      app: "creative", title: "Mis mapas", subtitle: "Creative Lab · ideas",
      href: "/creative", at: 0,
    });
    return cards.sort((a, b) => b.at - a.at).slice(0, 3);
  }, [recents, newestBoard]);

  const activeProjects = overview.work?.counts?.activeProjects;
  const activeTasks = overview.work?.counts?.activeTasks;
  const boardCount = overview.boards?.length;

  const apps = [
    { id: "work" as const, title: "Work", detail: "Proyectos y operaciones", href: "/work", tone: styles.tileWork },
    { id: "life" as const, title: "Life", detail: "Tu espacio personal", href: "/life", tone: styles.tileLife },
    { id: "creative" as const, title: "Creative Lab", detail: "Ideas conectadas", href: "/creative", tone: styles.tileCreative },
  ];

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.chrome}>
          <a className={styles.logo} href="/" aria-label="Home">
            <span className={styles.logoSymbol} aria-hidden="true"><i/><i/><i/><i/></span>
            <strong className={styles.logoText}>HOME.</strong>
            <span className={styles.logoSub}>Tu espacio</span>
          </a>
          <div className={styles.chromeRight}>
            <span className={styles.privateTag}><span/> Espacio privado</span>
            <div className={styles.profile} aria-label="Perfil de usuario">{firstName ? firstName.slice(0, 2).toUpperCase() : "OS"}</div>
            <form method="post" action="/api/auth/logout">
              <button type="submit" className={styles.logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut/></button>
            </form>
          </div>
        </header>

        <section className={styles.welcome} aria-label="Bienvenida y pulso general">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>UN SOLO LUGAR · TODO CONECTADO</span>
            <h1 className={styles.headline}>{greeting}{nameSuffix}<span>.</span></h1>
            <p className={styles.intro}>
              Tu trabajo, tus ideas y tu vida, cada uno con su espacio.
              Todo a mano, sin tener que abrir diez pestañas.
            </p>
            <div className={styles.heroFooter}>
              <span className={styles.todayPill}><CalendarDays aria-hidden="true"/>{now ? prettyDate(now, true) : "Tu jornada de hoy"}</span>
            </div>
          </div>
          <div className={styles.summary}>
            <div className={styles.summaryTop}><i/> OVERVIEW · EN VIVO</div>
            <h2 className={styles.summaryHeading}>{nextTask ? "Lo siguiente en tu radar" : "Tu centro de operaciones"}</h2>
            <p className={styles.summaryDescription}>
              {nextTask ? nextTask.name + " · " + prettyDate(nextTask.when) :
                "Una vista ligera para orientarte antes de entrar en cada espacio."}
            </p>
            <div className={styles.summaryStats}>
              <div className={styles.metric}><strong>{loading ? "·" : activeProjects ?? "—"}</strong><span>Proyectos activos</span></div>
              <div className={styles.metric}><strong>{loading ? "·" : activeTasks ?? "—"}</strong><span>Tareas activas</span></div>
              <div className={styles.metric}><strong>{loading ? "·" : boardCount ?? "—"}</strong><span>Mapas creativos</span></div>
            </div>
            <a href="/work?view=week" className={styles.summaryLink}>Ver mi semana <ArrowRight aria-hidden="true"/></a>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="apps-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>UN ECOSISTEMA, VARIAS HERRAMIENTAS</p>
              <h2 id="apps-title" className={styles.sectionTitle}>Tus aplicaciones.</h2>
            </div>
            <span className={styles.sectionMeta}>03 ACTIVAS · 01 EN CAMINO</span>
          </div>
          <nav className={styles.appDock} aria-label="Abrir aplicaciones">
            {apps.map(app => (
              <a key={app.id} href={app.href} className={styles.dockApp} title={app.detail}>
                <span className={styles.dockIcon + " " + app.tone}>
                  <span className={styles.dockIconGlyph}><AppIcon app={app.id}/></span>
                </span>
                <span className={styles.dockName}>{app.title}</span>
              </a>
            ))}
            <div className={styles.dockApp + " " + styles.dockDisabled} title="Biblioteca de referencias, próximamente">
              <span className={styles.dockIcon + " " + styles.tileLibrary}>
                <span className={styles.dockIconGlyph}><AppIcon app="library"/></span>
              </span>
              <span className={styles.dockName}>Biblioteca</span>
              <span className={styles.dockSoon}>Próximamente</span>
            </div>
          </nav>
        </section>

        <section className={styles.section} aria-labelledby="continue-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>SIN PERDER EL HILO</p>
              <h2 id="continue-title" className={styles.sectionTitle}>{recents.length || newestBoard ? "Continuar donde lo dejaste." : "Accesos rápidos."}</h2>
            </div>
            <span className={styles.sectionMeta}>VOLVER A LO IMPORTANTE</span>
          </div>
          <div className={styles.continueGrid}>
            {continueCards.map(item => (
              <a key={item.app} href={item.href} className={styles.continueCard}>
                <div className={styles.continueIcon}><RecentIcon app={item.app}/></div>
                <div className={styles.continueBottom}>
                  <div>
                    <div className={styles.continueMeta}>{appTitle[item.app]}</div>
                    <h3 className={styles.continueTitle}>{item.title}</h3>
                    <p className={styles.continueSubtitle}>{item.subtitle}</p>
                  </div>
                  <ArrowUpRight aria-hidden="true" className={styles.continueArrow}/>
                </div>
              </a>
            ))}
          </div>
        </section>

        <footer className={styles.bottom}>
          <span>HOME. · UN MISMO SISTEMA, MUCHAS POSIBILIDADES.</span>
          <div className={styles.bottomRight}>
            <span><CheckCircle2 aria-hidden="true"/> Work / Notion</span>
            <span><CheckCircle2 aria-hidden="true"/> Life + Lab / Supabase</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
