"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  Bike,
  CalendarDays,
  Check,
  ChevronRight,
  FolderKanban,
  Gamepad2,
  House,
  LayoutDashboard,
  ListTodo,
  Plus,
  Sparkles,
  Target,
  User,
  WalletCards,
} from "lucide-react";
import { ModeLogo } from "@/components/os/mode-logo";
import styles from "./life.module.css";

type Area = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  accent: string | null;
  position: number;
};

type Goal = {
  id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  progress: number;
};

type Project = {
  id: string;
  area_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  progress: number;
};

type Task = {
  id: string;
  area_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  title: string;
  status: string;
  priority: string;
  starts_at: string | null;
  ends_at: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  energy: string | null;
};

type LifeState = {
  source: "supabase";
  areas: Area[];
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  counts: {
    areas: number;
    goals: number;
    projects: number;
    tasks: number;
  };
};

type Section = "today" | "areas" | "goals" | "projects" | "tasks";

const iconMap = {
  User,
  WalletCards,
  Activity,
  House,
  Bike,
  Sparkles,
  Gamepad2,
} as const;

function AreaIcon({ name }: { name: string | null }) {
  const Icon = name && name in iconMap ? iconMap[name as keyof typeof iconMap] : Sparkles;
  return <Icon />;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value + (value.includes("T") ? "" : "T12:00:00"));
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

export default function LifePage() {
  const [data, setData] = useState<LifeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("today");
  const [capture, setCapture] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadLife() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/life/state", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo cargar LifeOS");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar LifeOS");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLife();
  }, []);

  async function createCapture() {
    const title = capture.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/life/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo guardar");
      setCapture("");
      await loadLife();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setCreating(false);
    }
  }

  const areasById = useMemo(
    () => new Map((data?.areas || []).map((area) => [area.id, area])),
    [data?.areas],
  );

  const attentionTasks = useMemo(() => {
    const priority = { critical: 4, high: 3, medium: 2, low: 1 } as Record<string, number>;
    return [...(data?.tasks || [])]
      .sort((a, b) => (priority[b.priority] || 0) - (priority[a.priority] || 0))
      .slice(0, 5);
  }, [data?.tasks]);

  const nav = [
    { id: "today" as const, label: "Hoy", icon: LayoutDashboard },
    { id: "areas" as const, label: "Áreas", icon: Sparkles },
    { id: "goals" as const, label: "Objetivos", icon: Target },
    { id: "projects" as const, label: "Proyectos", icon: FolderKanban },
    { id: "tasks" as const, label: "Tareas", icon: ListTodo },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <ModeLogo mode="life" href="/" />
        </div>

        <div className={styles.navLabel}>
          <span>LIFE</span>
          <small>Supabase</small>
        </div>

        <nav className={styles.nav}>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? styles.navActive : ""}
              onClick={() => setSection(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.future}>
          <span>DESPUÉS</span>
          <button disabled><WalletCards /> Dinero <small>próx.</small></button>
          <button disabled><Activity /> Salud <small>próx.</small></button>
          <button disabled><CalendarDays /> Agenda global <small>próx.</small></button>
        </div>

        <div className={styles.source}>
          <i />
          <div>
            <strong>SUPABASE</strong>
            <small>{loading ? "Conectando…" : error ? "Sin conexión" : "Life sincronizado"}</small>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <span>LIFEOS · {section === "today" ? "HOY" : section.toUpperCase()}</span>
            <h1>{section === "today" ? "Tu vida, sin convertirla en una hoja de cálculo." : nav.find((item) => item.id === section)?.label}</h1>
            <p>
              {section === "today"
                ? "Un espacio separado de Work para decidir qué merece atención fuera del trabajo."
                : "Datos personales en Supabase, completamente separados del workspace de Ogilvy."}
            </p>
          </div>
          <div className={styles.capture}>
            <Plus />
            <input
              value={capture}
              onChange={(event) => setCapture(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void createCapture(); }}
              placeholder="Captura algo rápido…"
              aria-label="Captura rápida"
            />
            <button disabled={!capture.trim() || creating} onClick={() => void createCapture()}>
              {creating ? "…" : "Guardar"}
            </button>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        {section === "today" && (
          <div className={styles.today}>
            <section className={styles.stats}>
              <article><span>ÁREAS</span><strong>{data?.counts.areas ?? "—"}</strong><small>contextos de vida</small></article>
              <article><span>OBJETIVOS</span><strong>{data?.counts.goals ?? "—"}</strong><small>activos</small></article>
              <article><span>PROYECTOS</span><strong>{data?.counts.projects ?? "—"}</strong><small>en marcha</small></article>
              <article className={styles.statAccent}><span>INBOX</span><strong>{data?.counts.tasks ?? "—"}</strong><small>cosas por ordenar</small></article>
            </section>

            <section className={styles.dashboard}>
              <article className={styles.areasPanel}>
                <div className={styles.panelHead}>
                  <div><span>RADAR</span><h2>Áreas</h2></div>
                  <button onClick={() => setSection("areas")}>Ver todas <ChevronRight /></button>
                </div>
                <div className={styles.areaGrid}>
                  {(data?.areas || []).map((area) => {
                    const related = (data?.tasks || []).filter((task) => task.area_id === area.id).length;
                    return (
                      <button
                        key={area.id}
                        className={styles.areaCard}
                        style={{ "--area-accent": area.accent || "#e7ff3f" } as CSSProperties}
                        onClick={() => setSection("areas")}
                      >
                        <span className={styles.areaIcon}><AreaIcon name={area.icon} /></span>
                        <strong>{area.name}</strong>
                        <small>{related ? related + " pendientes" : "En calma"}</small>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className={styles.focusPanel}>
                <div className={styles.panelHead}>
                  <div><span>ATENCIÓN</span><h2>En foco</h2></div>
                  <ListTodo />
                </div>
                <div className={styles.focusList}>
                  {attentionTasks.map((task, index) => (
                    <div key={task.id} className={styles.focusRow}>
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <div>
                        <strong>{task.title}</strong>
                        <small>{task.area_id ? areasById.get(task.area_id)?.name || "Personal" : "Inbox"} · {formatDate(task.due_date || task.starts_at)}</small>
                      </div>
                      <span>{task.priority}</span>
                    </div>
                  ))}
                  {!loading && attentionTasks.length === 0 && (
                    <div className={styles.empty}><Check /><span>No hay nada reclamando atención todavía.</span></div>
                  )}
                </div>
              </article>

              <article className={styles.goalPanel}>
                <div className={styles.panelHead}>
                  <div><span>DIRECCIÓN</span><h2>Objetivos</h2></div>
                  <Target />
                </div>
                <div className={styles.goalList}>
                  {(data?.goals || []).slice(0, 4).map((goal) => (
                    <div key={goal.id} className={styles.goalRow}>
                      <div>
                        <strong>{goal.title}</strong>
                        <small>{goal.area_id ? areasById.get(goal.area_id)?.name || "Personal" : "Personal"}</small>
                      </div>
                      <span>{goal.progress}%</span>
                      <i><b style={{ width: goal.progress + "%" }} /></i>
                    </div>
                  ))}
                  {!loading && (data?.goals.length || 0) === 0 && (
                    <div className={styles.empty}><Target /><span>Aún no has definido objetivos. Mejor que inventar KPIs para respirar.</span></div>
                  )}
                </div>
              </article>
            </section>
          </div>
        )}

        {section === "areas" && (
          <section className={styles.sectionPage}>
            <div className={styles.sectionTitle}><span>ESTRUCTURA</span><h2>Áreas de tu vida</h2><p>Son contextos estables. Los proyectos empiezan y terminan; las áreas siguen ahí molestando con admirable constancia.</p></div>
            <div className={styles.areaGridLarge}>
              {(data?.areas || []).map((area) => (
                <article key={area.id} style={{ "--area-accent": area.accent || "#e7ff3f" } as CSSProperties}>
                  <span><AreaIcon name={area.icon} /></span>
                  <strong>{area.name}</strong>
                  <small>{(data?.projects || []).filter((item) => item.area_id === area.id).length} proyectos · {(data?.tasks || []).filter((item) => item.area_id === area.id).length} tareas</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === "goals" && (
          <section className={styles.sectionPage}>
            <div className={styles.sectionTitle}><span>DIRECCIÓN</span><h2>Objetivos</h2><p>La capa que conecta lo que haces con por qué demonios lo estás haciendo.</p></div>
            <div className={styles.listPage}>
              {(data?.goals || []).map((goal) => (
                <article key={goal.id}>
                  <Target />
                  <div><strong>{goal.title}</strong><small>{goal.area_id ? areasById.get(goal.area_id)?.name || "Personal" : "Personal"} · {goal.target_date ? formatDate(goal.target_date) : "Sin fecha límite"}</small></div>
                  <span>{goal.progress}%</span>
                </article>
              ))}
              {!loading && (data?.goals.length || 0) === 0 && <div className={styles.pageEmpty}>Todavía no hay objetivos. El sistema acaba de nacer, tampoco hace falta exigirle propósito vital en su primer minuto.</div>}
            </div>
          </section>
        )}

        {section === "projects" && (
          <section className={styles.sectionPage}>
            <div className={styles.sectionTitle}><span>MOVIMIENTO</span><h2>Proyectos personales</h2><p>Cosas con principio y final. Una distinción sorprendentemente útil para los humanos.</p></div>
            <div className={styles.listPage}>
              {(data?.projects || []).map((project) => (
                <article key={project.id}>
                  <FolderKanban />
                  <div><strong>{project.title}</strong><small>{project.area_id ? areasById.get(project.area_id)?.name || "Personal" : "Personal"} · {project.status}</small></div>
                  <span>{project.progress}%</span>
                </article>
              ))}
              {!loading && (data?.projects.length || 0) === 0 && <div className={styles.pageEmpty}>No hay proyectos personales todavía.</div>}
            </div>
          </section>
        )}

        {section === "tasks" && (
          <section className={styles.sectionPage}>
            <div className={styles.sectionTitle}><span>OPERATIVA</span><h2>Tareas personales</h2><p>La captura rápida entra aquí como Backlog hasta que decidamos qué hacer con ella.</p></div>
            <div className={styles.listPage}>
              {(data?.tasks || []).map((task) => (
                <article key={task.id}>
                  <ListTodo />
                  <div><strong>{task.title}</strong><small>{task.area_id ? areasById.get(task.area_id)?.name || "Personal" : "Inbox"} · {task.status}</small></div>
                  <span>{task.priority}</span>
                </article>
              ))}
              {!loading && (data?.tasks.length || 0) === 0 && <div className={styles.pageEmpty}>Sin tareas. Disfruta estos cuatro segundos históricos.</div>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
