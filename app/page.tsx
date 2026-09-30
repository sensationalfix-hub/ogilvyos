"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight,
  CalendarRange, ChevronLeft, CircleGauge, Clock3, FolderKanban, GripVertical,
  Check, LayoutDashboard, ListTodo, Plus, Save, Search, Sparkles, Star,
  Target, TrendingUp, Users, X, Play, Pause, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { PageContent } from "@/components/workos/page-content";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type View = "dashboard" | "week" | "timeline" | "calendar" | "accounts" | "projects" | "tasks" | "team" | "holidays";
type Priority = string;
type TaskStatus = string;
type ProjectStatus = string;
type CalendarFilter = "all" | "task" | "project" | "holiday";
type DimensionKey = "quality" | "timing" | "collaboration" | "autonomy" | "impact";

type LiveOption = { id: string; name: string; color: string; group?: string };
type LiveSchema = {
  source: "notion";
  loadedAt: string;
  accounts: { status: LiveOption[]; priority: LiveOption[]; contract: LiveOption[] };
  projects: { status: LiveOption[]; priority: LiveOption[]; type: LiveOption[]; complexity: LiveOption[]; rating: LiveOption[] };
  tasks: { status: LiveOption[]; priority: LiveOption[]; effort: LiveOption[]; rating: LiveOption[] };
  team: { role: LiveOption[]; rating: LiveOption[]; assignment: LiveOption[]; contract: LiveOption[]; skills: LiveOption[]; weaknesses: LiveOption[] };
  holidays: { year: LiveOption[]; segment: LiveOption[]; absenceType: LiveOption[] };
  evaluations: { type: LiveOption[] };
  health: Record<string, Array<{ name: string; ok: boolean; type: string | null }>>;
};

type Task = {
  id: string; name: string; status: TaskStatus; priority: Priority; project: string;
  account: string; date: string; dateStart?: string | null; dateEnd?: string | null; people: string[]; url: string;
};
type Project = {
  id: string; name: string; status: ProjectStatus; account: string; timing: string;
  timingStart?: string | null; timingEnd?: string | null;
  type: string; people: string[]; priority: Priority; url: string;
};
type Detail = ({ kind: "task" } & Task) | ({ kind: "project" } & Project) | null;
type Evaluation = { kind: "task" | "project"; id: string; name: string; people: string[] };
type CalendarEvent = {
  key: string; month: number; day: number; kind: Exclude<CalendarFilter, "all">;
  title: string; meta: string; account?: string; id?: string;
};
type Account = {
  id?: string; name: string; status?: string; priority: Priority; contract: string;
  color: string; projects: number; tasks?: number; activity?: number; pulse: number; url: string;
};
type TeamPerson = {
  id: string; url: string; name: string; role: string; assignment: string; tier: string | null;
  skills: string[]; growth: string[]; joined: string | null; initials: string; tone: string;
  load: number; activeTasks: number; activeProjects: number; projects: number;
  activeProjectNames: string[]; activeTaskNames: string[];
  completedTasks: number; completedProjects: number; score: number | null;
  taskScore: number | null; projectScore: number | null; evaluations: number;
  evidence: number; ratedTasks: number; ratedProjects: number; ratio: number | null;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  dimensions: Record<DimensionKey, number | null>;
};
type Holiday = {
  id?: string; name: string; type: string; start: string; end: string; label: string; color: string; url: string;
};
type LiveState = {
  source: "notion"; loadedAt: string;
  counts: {
    accounts: number; projects: number; activeProjects: number; tasks: number; activeTasks: number;
    team: number; holidays: number; evaluations: number; ratedTasks?: number; ratedProjects?: number;
  };
  accounts: Account[]; projects: Project[]; tasks: Task[]; allTasks: Task[]; team: TeamPerson[]; holidays: Holiday[];
};

const initialProjects: Project[] = [];
const initialTasks: Task[] = [];
const fallbackAccounts: Account[] = [];
const fallbackTeam: TeamPerson[] = [];
const fallbackHolidays: Holiday[] = [];

const navigation = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "week", label: "Mi semana", icon: CalendarDays },
  { value: "timeline", label: "Timeline", icon: TrendingUp },
  { value: "calendar", label: "Calendario", icon: CalendarRange },
  { value: "accounts", label: "Cuentas", icon: BriefcaseBusiness },
  { value: "projects", label: "Proyectos", icon: FolderKanban },
  { value: "tasks", label: "Tareas", icon: ListTodo },
  { value: "team", label: "Equipo", icon: Users },
  { value: "holidays", label: "Vacaciones", icon: CalendarDays },
] as const;

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "HOY · NOTION LIVE", title: "Todo bajo control. Más o menos.", description: "El pulso real de cuentas, equipo y fechas sin bucear por seis bases de datos." },
  week: { eyebrow: "FOCO · ESTA SEMANA", title: "Mi semana", description: "Entregas, hitos, ausencias y carga crítica. Lo que merece atención antes de que sea tarde." },
  timeline: { eyebrow: "MAPA TEMPORAL", title: "Timeline", description: "Todo lo activo colocado en el tiempo sin obligarte a viajar horizontalmente hasta noviembre." },
  calendar: { eyebrow: "AGENDA MAESTRA", title: "Calendario", description: "Entregas, presentaciones y ausencias ordenadas en el tiempo. Por fin, septiembre con subtítulos." },
  accounts: { eyebrow: "VISIÓN MACRO", title: "Cuentas", description: "Prioridad, volumen y temperatura creativa en una sola vista." },
  projects: { eyebrow: "PIPELINE", title: "Proyectos", description: "Arrastra cada proyecto a su siguiente fase. El papeleo que se mueva solo, gracias." },
  tasks: { eyebrow: "OPERATIVA", title: "Tareas", description: "Un tablero para mover el trabajo, no para contemplarlo." },
  team: { eyebrow: "CAPACIDAD", title: "Equipo", description: "Carga visible antes de que alguien empiece a arder en silencio." },
  holidays: { eyebrow: "AUSENCIAS", title: "Vacaciones", description: "Solapes, puentes y planes B sin montar un comité de crisis." },
};

const calendarMonths = [
  { name: "Agosto", short: "AGO", year: 2026, days: 31, offset: 5 },
  { name: "Septiembre", short: "SEP", year: 2026, days: 30, offset: 1 },
  { name: "Octubre", short: "OCT", year: 2026, days: 31, offset: 3 },
] as const;
const monthIndexByCode: Record<string, number> = { AGO: 0, SEP: 1, OCT: 2 };
const positiveSignals = ["Ideas", "Craft", "Autonomía", "Velocidad", "Presentación", "Implicación"];
const frictionSignals = ["Brief confuso", "Retrasos", "Falta de foco", "Poco craft", "Dependencia", "Mala coordinación"];
const dimensionLabels: Record<DimensionKey, { label: string; hint: string }> = {
  quality: { label: "Calidad", hint: "Nivel final del trabajo" },
  timing: { label: "Timing", hint: "Cumplimiento y agilidad" },
  collaboration: { label: "Colaboración", hint: "Cómo funcionó el equipo" },
  autonomy: { label: "Autonomía", hint: "Capacidad de resolver" },
  impact: { label: "Impacto", hint: "Valor creativo o de negocio" },
};

function priorityClass(priority: Priority) {
  if (priority === "Urgente" || priority === "Alta") return "priority-high";
  if (priority === "Media") return "priority-mid";
  if (priority === "Baja") return "priority-low";
  return "priority-none";
}
function timelinePosition(start: string, end: string) {
  const rangeStart = Date.UTC(2026, 7, 31);
  const rangeEnd = Date.UTC(2026, 9, 21);
  const startMs = Math.max(rangeStart, Date.parse(start + "T00:00:00Z"));
  const endMs = Math.min(rangeEnd, Date.parse(end + "T00:00:00Z"));
  const total = rangeEnd - rangeStart;
  return { left: Math.max(0, ((startMs - rangeStart) / total) * 100), width: Math.max(2, ((endMs - startMs + 86400000) / total) * 100) };
}
function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
function confidence(count: number) {
  if (count >= 8) return "Muestra alta";
  if (count >= 3) return "Muestra media";
  if (count > 0) return "Muestra baja";
  return "Sin muestra";
}
function oneDecimal(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";
}
function StarPicker({ value, onChange, compact = false }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return <div className={compact ? "star-picker compact" : "star-picker"}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={value >= star ? "active" : ""} aria-label={star + " de 5"} onClick={() => onChange(star)}><Star /></button>)}</div>;
}
function accountContrast(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#111111";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#171917" : "#ffffff";
}
function AccountMark({ name }: { name: string }) {
  return <span className="account-mark">{name.slice(0, 2).toUpperCase()}</span>;
}
function PeopleStack({ people }: { people: string[] }) {
  return <div className="people-stack" aria-label={`Equipo: ${people.join(", ")}`}>
    {people.slice(0, 3).map((person, index) => <span key={`${person}-${index}`} title={person}>{person === "Por asignar" ? "?" : person.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>)}
    {people.length > 3 && <span>+{people.length - 3}</span>}
  </div>;
}
function TaskCard({ task, onOpen, onDragStart, onAssignPerson }: { task: Task; onOpen: () => void; onDragStart: () => void; onAssignPerson: (person: string) => void }) {
  return <article className="work-card" draggable tabIndex={0}
    onDragStart={(event) => { event.dataTransfer.setData("text/plain", `task:${task.id}`); onDragStart(); }}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { const [kind, person] = event.dataTransfer.getData("text/plain").split(":"); if (kind === "person") { event.preventDefault(); event.stopPropagation(); onAssignPerson(person); } }}
    onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
    <div className="work-card-top"><span className={`priority-dot ${priorityClass(task.priority)}`} /><span className="client-label">{task.account}</span><GripVertical className="drag-handle" /></div>
    <h3>{task.name}</h3><p>{task.project}</p>
    <div className="work-card-footer"><span className={task.date === "26 AGO" ? "date-chip overdue" : "date-chip"}><Clock3 /> {task.date}</span><PeopleStack people={task.people} /></div>
  </article>;
}
function ProjectCard({ project, onOpen, onDragStart, onAssignPerson }: { project: Project; onOpen: () => void; onDragStart: () => void; onAssignPerson: (person: string) => void }) {
  return <article className="project-card" draggable tabIndex={0}
    onDragStart={(event) => { event.dataTransfer.setData("text/plain", `project:${project.id}`); onDragStart(); }}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { const [kind, person] = event.dataTransfer.getData("text/plain").split(":"); if (kind === "person") { event.preventDefault(); event.stopPropagation(); onAssignPerson(person); } }}
    onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
    <div className="project-account"><AccountMark name={project.account} /><span>{project.account}</span><GripVertical className="drag-handle" /></div>
    <h3>{project.name}</h3><div className="project-meta"><span>{project.type}</span><span>{project.timing}</span></div>
    <div className="project-people"><PeopleStack people={project.people} /><span className={`mini-priority ${priorityClass(project.priority)}`}>{project.priority}</span></div>
  </article>;
}
function EmptyDrop() { return <div className="empty-drop">Suelta aquí</div>; }
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}
function plannerMinutes(value: string | null | undefined, fallback = 9 * 60) {
  if (!value || !value.includes("T")) return fallback;
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}
function localPlannerIso(day: string, minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const date = new Date(day + "T00:00:00");
  date.setHours(Math.floor(safe / 60), safe % 60, 0, 0);
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const tz = sign + String(Math.floor(abs / 60)).padStart(2, "0") + ":" + String(abs % 60).padStart(2, "0");
  return day + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":00" + tz;
}
function plannerTimeLabel(minutes: number) {
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}
function taskIsAllDay(task: Pick<Task, "dateStart">) {
  return Boolean(task.dateStart && !task.dateStart.includes("T"));
}
const PLANNER_START = 9 * 60;
const PLANNER_END = 19 * 60;
const PLANNER_HOUR_PX = 64;
function mondayForOperationalWeek(base = new Date()) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const delta = day === 0 ? 1 : 1 - day;
  date.setDate(date.getDate() + delta);
  return date;
}
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function timelinePercent(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return null;
  const date = new Date(value + "T00:00:00");
  const total = end.getTime() - start.getTime();
  if (!total) return 0;
  return clamp(((date.getTime() - start.getTime()) / total) * 100);
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [allTasks, setAllTasks] = useState<Task[]>(initialTasks);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [accounts, setAccounts] = useState<Account[]>(fallbackAccounts);
  const [team, setTeam] = useState<TeamPerson[]>(fallbackTeam);
  const [holidays, setHolidays] = useState<Holiday[]>(fallbackHolidays);
  const [liveCounts, setLiveCounts] = useState<LiveState["counts"] | null>(null);
  const [dataState, setDataState] = useState<"loading" | "live" | "error">("loading");
  const [liveSchema, setLiveSchema] = useState<LiveSchema | null>(null);
  const [schemaState, setSchemaState] = useState<"loading" | "live" | "error">("loading");
  const [detail, setDetail] = useState<Detail>(null);
  const [search, setSearch] = useState("");
  const [queuedChanges, setQueuedChanges] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragVisual, setDragVisual] = useState<{ title: string; meta: string; x: number; y: number } | null>(null);
  const [quickType, setQuickType] = useState("task");
  const [quickName, setQuickName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(1);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");
  const [calendarTaskDate, setCalendarTaskDate] = useState<string | null>(null);
  const [calendarTaskName, setCalendarTaskName] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<TeamPerson | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedProjectPage, setSelectedProjectPage] = useState<Project | null>(null);
  const [timelineWeeks, setTimelineWeeks] = useState(8);
  const [projectTaskName, setProjectTaskName] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [score, setScore] = useState(0);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [frictions, setFrictions] = useState<string[]>([]);
  const [evaluationNote, setEvaluationNote] = useState("");
  const [detailedMode, setDetailedMode] = useState(false);
  const [dimensionScores, setDimensionScores] = useState<Partial<Record<DimensionKey, number>>>({});
  const [individualMode, setIndividualMode] = useState(false);
  const [individualScores, setIndividualScores] = useState<Record<string, number>>({});
  const [ratingBoosts, setRatingBoosts] = useState<Record<string, { sum: number; count: number }>>({});
  const [signalBoosts, setSignalBoosts] = useState<Record<string, { positive: Record<string, number>; negative: Record<string, number> }>>({});
  const [dimensionBoosts, setDimensionBoosts] = useState<Record<string, Partial<Record<DimensionKey, { sum: number; count: number }>>>>({});
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const current = viewCopy[activeView];

  useEffect(() => {
    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "fixed",
      left: "-9999px",
      top: "-9999px",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(ghost);

    let source: HTMLElement | null = null;

    const start = (event: DragEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[draggable="true"]') as HTMLElement | null : null;
      if (!target) return;
      source = target;
      source.classList.add("is-being-dragged");

      const title =
        target.querySelector("h3")?.textContent?.trim() ||
        target.querySelector(".dashboard-project-copy strong")?.textContent?.trim() ||
        target.querySelector(".team-copy h2")?.textContent?.trim() ||
        target.querySelector(".roster-person strong")?.textContent?.trim() ||
        target.querySelector(".week-item strong")?.textContent?.trim() ||
        target.querySelector("strong")?.textContent?.trim() ||
        "Elemento";

      const meta =
        target.querySelector(".client-label")?.textContent?.trim() ||
        target.querySelector("p")?.textContent?.trim() ||
        target.querySelector("small")?.textContent?.trim() ||
        "Arrastrando";

      event.dataTransfer?.setDragImage(ghost, 0, 0);
      setDragVisual({ title, meta, x: event.clientX, y: event.clientY });
    };

    const move = (event: DragEvent) => {
      if (!event.clientX && !event.clientY) return;
      setDragVisual((visual) => visual ? { ...visual, x: event.clientX, y: event.clientY } : visual);
    };

    const end = () => {
      source?.classList.remove("is-being-dragged");
      source = null;
      setDragVisual(null);
    };

    document.addEventListener("dragstart", start, true);
    window.addEventListener("dragover", move, true);
    document.addEventListener("dragend", end, true);
    document.addEventListener("drop", end, true);

    return () => {
      document.removeEventListener("dragstart", start, true);
      window.removeEventListener("dragover", move, true);
      document.removeEventListener("dragend", end, true);
      document.removeEventListener("drop", end, true);
      source?.classList.remove("is-being-dragged");
      ghost.remove();
    };
  }, []);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => {
      setFocusSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setFocusRunning(false);
          toast.success("Focus terminado", { description: "25 minutos. La civilización sigue en pie." });
          return 25 * 60;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  useEffect(() => {
    if (!selectedProjectPage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !detail && !evaluation) setSelectedProjectPage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedProjectPage, detail, evaluation]);

  useEffect(() => {
    let active = true;
    fetch("/api/notion/schema", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<LiveSchema>;
      })
      .then((schema) => {
        if (!active) return;
        setLiveSchema(schema);
        setSchemaState("live");
      })
      .catch(() => {
        if (!active) return;
        setSchemaState("error");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/notion/state", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<LiveState>;
      })
      .then((state) => {
        if (!active) return;
        setAccounts(state.accounts.filter((account) => account.status === "Activa"));
        setProjects(state.projects);
        setTasks(state.tasks);
        setAllTasks(state.allTasks || state.tasks);
        setTeam(state.team);
        setHolidays(state.holidays);
        setLiveCounts(state.counts);
        setDataState("live");
      })
      .catch(() => {
        if (!active) return;
        setDataState("error");
      });
    return () => { active = false; };
  }, []);

  const taskStatusOptions = liveSchema?.tasks.status.map((option) => option.name) ?? Array.from(new Set(tasks.map((task) => task.status).filter(Boolean)));
  const projectStatusOptions = liveSchema?.projects.status.map((option) => option.name) ?? Array.from(new Set(projects.map((project) => project.status).filter(Boolean)));
  const taskPriorityOptions = liveSchema?.tasks.priority.map((option) => option.name) ?? Array.from(new Set(tasks.map((task) => task.priority).filter(Boolean)));
  const projectPriorityOptions = liveSchema?.projects.priority.map((option) => option.name) ?? Array.from(new Set(projects.map((project) => project.priority).filter(Boolean)));
  const projectTypeOptions = liveSchema?.projects.type.map((option) => option.name) ?? Array.from(new Set(projects.map((project) => project.type).filter(Boolean)));
  const desiredTaskBoardOrder = ["En progreso", "Pausa", "Pendiente"];
  const taskBoardStatuses = desiredTaskBoardOrder.filter((status) => taskStatusOptions.includes(status));
  const desiredProjectBoardOrder = ["Standby", "Brief", "Ideas", "Pre-Producción", "Producción", "Seguimiento"];
  const projectBoardStatuses = desiredProjectBoardOrder.filter((status) => projectStatusOptions.includes(status));
  const schemaChecks = liveSchema
    ? Object.entries(liveSchema.health).flatMap(([source, checks]) => checks.map((check) => ({ ...check, source })))
    : [];
  const schemaIssues = schemaChecks.filter((check) => !check.ok);
  const operationalWeekStart = useMemo(() => mondayForOperationalWeek(), []);
  const operationalWeekDays = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(operationalWeekStart, index)), [operationalWeekStart]);
  const operationalWeekEnd = useMemo(() => addDays(operationalWeekStart, 4), [operationalWeekStart]);
  const weeklyTasks = useMemo(() => allTasks.filter((task) => {
    const day = dateOnly(task.dateStart);
    return Boolean(day && day >= isoDate(operationalWeekStart) && day <= isoDate(operationalWeekEnd));
  }), [allTasks, operationalWeekStart, operationalWeekEnd]);
  const weeklyProjectMilestones = useMemo(() => projects.flatMap((project) => {
    const events: Array<{ id: string; date: string; label: string; project: Project; kind: "start" | "end" }> = [];
    if (project.timingStart && project.timingStart >= isoDate(operationalWeekStart) && project.timingStart <= isoDate(operationalWeekEnd)) events.push({ id: project.id + "-start", date: project.timingStart, label: "Arranque", project, kind: "start" });
    if (project.timingEnd && project.timingEnd >= isoDate(operationalWeekStart) && project.timingEnd <= isoDate(operationalWeekEnd)) events.push({ id: project.id + "-end", date: project.timingEnd, label: "Cierre", project, kind: "end" });
    return events;
  }), [projects, operationalWeekStart, operationalWeekEnd]);
  const weeklyHolidays = useMemo(() => holidays.filter((holiday) => holiday.start <= isoDate(operationalWeekEnd) && holiday.end >= isoDate(operationalWeekStart)), [holidays, operationalWeekStart, operationalWeekEnd]);

  const weekPlannerStats = useMemo(() => {
    const timedTasks = weeklyTasks.filter((task) => !taskIsAllDay(task));
    const dayMinutes = operationalWeekDays.map((day) => {
      const key = isoDate(day);
      return timedTasks
        .filter((task) => dateOnly(task.dateStart) === key)
        .reduce((sum, task) => {
          const start = plannerMinutes(task.dateStart);
          const end = plannerMinutes(task.dateEnd, start + 60);
          return sum + Math.max(30, end - start);
        }, 0);
    });

    let conflicts = 0;
    operationalWeekDays.forEach((day) => {
      const key = isoDate(day);
      const items = timedTasks
        .filter((task) => dateOnly(task.dateStart) === key)
        .map((task) => {
          const start = plannerMinutes(task.dateStart);
          return { start, end: plannerMinutes(task.dateEnd, start + 60) };
        })
        .sort((a, b) => a.start - b.start);
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          if (items[j].start >= items[i].end) break;
          if (items[j].start < items[i].end && items[j].end > items[i].start) conflicts += 1;
        }
      }
    });

    const freeSlots: Array<{ key: string; label: string; start: number; end: number; duration: number }> = [];
    operationalWeekDays.forEach((day) => {
      const key = isoDate(day);
      const items = timedTasks
        .filter((task) => dateOnly(task.dateStart) === key)
        .map((task) => {
          const start = Math.max(PLANNER_START, plannerMinutes(task.dateStart));
          const end = Math.min(PLANNER_END, plannerMinutes(task.dateEnd, start + 60));
          return { start, end };
        })
        .filter((item) => item.end > PLANNER_START && item.start < PLANNER_END)
        .sort((a, b) => a.start - b.start);

      const merged: Array<{ start: number; end: number }> = [];
      items.forEach((item) => {
        const last = merged[merged.length - 1];
        if (!last || item.start > last.end) merged.push({ ...item });
        else last.end = Math.max(last.end, item.end);
      });

      let cursor = PLANNER_START;
      merged.forEach((item) => {
        if (item.start - cursor >= 60) {
          freeSlots.push({
            key,
            label: day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase(),
            start: cursor,
            end: item.start,
            duration: item.start - cursor,
          });
        }
        cursor = Math.max(cursor, item.end);
      });
      if (PLANNER_END - cursor >= 60) {
        freeSlots.push({
          key,
          label: day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase(),
          start: cursor,
          end: PLANNER_END,
          duration: PLANNER_END - cursor,
        });
      }
    });

    const totalMinutes = dayMinutes.reduce((sum, value) => sum + value, 0);
    const maxDayMinutes = Math.max(1, ...dayMinutes);

    const todayKey = isoDate(new Date());
    const todayTasks = timedTasks.filter((task) => dateOnly(task.dateStart) === todayKey);
    const todayMinutes = todayTasks.reduce((sum, task) => {
      const start = plannerMinutes(task.dateStart);
      const end = plannerMinutes(task.dateEnd, start + 60);
      return sum + Math.max(30, end - start);
    }, 0);
    const nextToday = [...todayTasks].sort((a, b) => plannerMinutes(a.dateStart) - plannerMinutes(b.dateStart))[0] ?? null;

    return {
      timedTasks,
      dayMinutes,
      totalMinutes,
      maxDayMinutes,
      conflicts,
      freeSlots: freeSlots.slice(0, 3),
      todayMinutes,
      todayTasks,
      nextToday,
      todayPercent: Math.round((todayMinutes / (PLANNER_END - PLANNER_START)) * 100),
    };
  }, [weeklyTasks, operationalWeekDays]);


  const globalTimelineStart = operationalWeekStart;
  const globalTimelineEnd = useMemo(() => addDays(globalTimelineStart, timelineWeeks * 7), [globalTimelineStart, timelineWeeks]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return tasks
      .filter((task) => task.dateStart && new Date(task.dateStart).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.dateStart || 0).getTime() - new Date(b.dateStart || 0).getTime())
      .slice(0, 3);
  }, [tasks]);
  const accountViewStats = useMemo(() => {
    const now = Date.now();
    const items = accounts.map((account) => {
      const accountProjects = projects.filter((project) => project.account === account.name);
      const accountTasks = allTasks.filter((task) => task.account === account.name);
      const activeProjects = accountProjects.filter((project) => {
        const status = project.status.trim().toLocaleLowerCase("es");
        const type = project.type.trim().toLocaleLowerCase("es");
        return status !== "terminado" && status !== "cancelado" && status !== "daily" && type !== "daily";
      });
      const activeTasks = accountTasks.filter((task) => !["Terminado", "Cancelado"].includes(task.status));
      const nextDeadline = accountTasks
        .filter((task) => task.dateStart && new Date(task.dateStart).getTime() >= now)
        .sort((a,b) => new Date(a.dateStart || 0).getTime() - new Date(b.dateStart || 0).getTime())[0] ?? null;
      const people = Array.from(new Set([...accountProjects.flatMap((project) => project.people), ...accountTasks.flatMap((task) => task.people)]))
        .filter((name) => name && name !== "Por asignar");
      return {
        ...account,
        activeProjects: activeProjects.length,
        activeTasks: activeTasks.length,
        nextDeadline,
        people,
        activityScore: activeProjects.length * 3 + activeTasks.length + (account.activity ?? 0),
      };
    });
    const totalProjects = items.reduce((sum,item) => sum + item.activeProjects,0);
    const totalTasks = items.reduce((sum,item) => sum + item.activeTasks,0);
    const highPriority = items.filter((item) => item.priority.trim().toLocaleLowerCase("es") === "alta").length;
    const moving = [...items].sort((a,b) => b.activityScore - a.activityScore).slice(0,3);
    return { items, totalProjects, totalTasks, highPriority, moving };
  }, [accounts, projects, allTasks]);

  const q = search.trim().toLocaleLowerCase("es");
  const filteredTasks = useMemo(() => tasks.filter((task) => !q || `${task.name} ${task.project} ${task.account} ${task.people.join(" ")}`.toLowerCase().includes(q)), [tasks, q]);
  const filteredProjects = useMemo(() => projects.filter((project) => !q || `${project.name} ${project.account} ${project.type} ${project.people.join(" ")}`.toLowerCase().includes(q)), [projects, q]);
  const dashboardProjects = useMemo(() => projects.filter((project) => {
    const status = project.status.trim().toLocaleLowerCase("es");
    const type = project.type.trim().toLocaleLowerCase("es");
    return status !== "daily" && type !== "daily";
  }), [projects]);
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const taskEvents = tasks.flatMap((task) => {
      const match = task.date.match(/^(\d{1,2})\s+(AGO|SEP|OCT)$/i);
      if (!match) return [];
      return [{ key: `task-${task.id}`, month: monthIndexByCode[match[2].toUpperCase()], day: Number(match[1]), kind: "task" as const, title: task.name, meta: task.project, account: task.account, id: task.id }];
    });
    const projectEvents = projects.flatMap((project) => {
      const match = project.timing.match(/(\d{1,2})\s+(AGO|SEP|OCT)/i);
      if (!match) return [];
      return [{ key: `project-${project.id}`, month: monthIndexByCode[match[2].toUpperCase()], day: Number(match[1]), kind: "project" as const, title: project.name, meta: "Inicio de proyecto", account: project.account, id: project.id }];
    });
    const holidayEvents: CalendarEvent[] = holidays.flatMap((holiday) => {
      const date = new Date(holiday.start + "T00:00:00Z");
      const month = date.getUTCMonth() - 7;
      if (month < 0 || month > 2) return [];
      return [{ key: `holiday-${holiday.url}`, month, day: date.getUTCDate(), kind: "holiday", title: holiday.name, meta: `${holiday.type} · ${holiday.label}` }];
    });
    return [...taskEvents, ...projectEvents, ...holidayEvents].sort((a, b) => a.month - b.month || a.day - b.day || a.title.localeCompare(b.title));
  }, [tasks, projects, holidays]);
  const visibleCalendarEvents = calendarEvents.filter((event) => event.month === calendarMonth && (calendarFilter === "all" || event.kind === calendarFilter));
  const visibleEventDays = Array.from(new Set(visibleCalendarEvents.map((event) => event.day))).sort((a, b) => a - b);
  const holidayTimelineNames = Array.from(new Set(holidays.map((holiday) => holiday.name)));

  function personPerformance(person: TeamPerson) {
    const boost = ratingBoosts[person.name];
    const baseCount = person.evaluations;
    const baseSum = (person.score ?? 0) * baseCount;
    const totalCount = baseCount + (boost?.count ?? 0);
    const nextScore = totalCount ? (baseSum + (boost?.sum ?? 0)) / totalCount : null;
    return { score: nextScore, ratio: nextScore == null ? null : Math.round(nextScore * 20), count: totalCount };
  }
  function resetEvaluation() {
    setEvaluation(null); setScore(0); setStrengths([]); setFrictions([]); setEvaluationNote("");
    setDetailedMode(false); setDimensionScores({}); setIndividualMode(false); setIndividualScores({});
  }
  function startEvaluation(target: Evaluation) {
    setDetail(null); setEvaluation(target); setScore(0); setStrengths([]); setFrictions([]); setEvaluationNote("");
    setDetailedMode(false); setDimensionScores({}); setIndividualMode(false); setIndividualScores(Object.fromEntries(target.people.map((name) => [name, 0])));
  }
  async function submitEvaluation() {
    if (!evaluation || !score) return;
    const assigned = evaluation.people.filter((name) => name !== "Por asignar");
    const activeDimensions: DimensionKey[] = evaluation.kind === "task" ? ["quality", "timing", "collaboration", "autonomy"] : ["quality", "timing", "collaboration", "impact"];
    const detailedValues = activeDimensions.map((key) => dimensionScores[key]).filter((value): value is number => Boolean(value));
    const detailedAverage = detailedValues.length ? detailedValues.reduce((sum, value) => sum + value, 0) / detailedValues.length : null;
    try {
      const response = await fetch("/api/notion/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: evaluation.kind,
          id: evaluation.id,
          name: evaluation.name,
          people: assigned,
          score,
          individualScores: individualMode ? individualScores : {},
          dimensions: dimensionScores,
          strengths,
          frictions,
          note: evaluationNote,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "No se pudo guardar la evaluación");
      }
    } catch (error) {
      toast.error("No se pudo cerrar y evaluar en Notion", { description: error instanceof Error ? error.message : "Error desconocido" });
      return;
    }
    setRatingBoosts((current) => {
      const next = { ...current };
      assigned.forEach((name) => {
        const overallScore = individualMode && individualScores[name] ? individualScores[name] : score;
        const appliedScore = detailedAverage == null ? overallScore : overallScore * .5 + detailedAverage * .5;
        const previous = next[name] ?? { sum: 0, count: 0 };
        next[name] = { sum: previous.sum + appliedScore, count: previous.count + 1 };
      });
      return next;
    });
    if (detailedValues.length) setDimensionBoosts((current) => {
      const next = { ...current };
      assigned.forEach((name) => {
        const personDimensions = { ...(next[name] ?? {}) };
        activeDimensions.forEach((key) => {
          const value = dimensionScores[key];
          if (!value) return;
          const previous = personDimensions[key] ?? { sum: 0, count: 0 };
          personDimensions[key] = { sum: previous.sum + value, count: previous.count + 1 };
        });
        next[name] = personDimensions;
      });
      return next;
    });
    setSignalBoosts((current) => {
      const next = { ...current };
      assigned.forEach((name) => {
        const previous = next[name] ?? { positive: {}, negative: {} };
        const positive = { ...previous.positive };
        const negative = { ...previous.negative };
        strengths.forEach((signal) => { positive[signal] = (positive[signal] ?? 0) + 1; });
        frictions.forEach((signal) => { negative[signal] = (negative[signal] ?? 0) + 1; });
        next[name] = { positive, negative };
      });
      return next;
    });
    if (evaluation.kind === "task") setTasks((items) => items.filter((item) => item.id !== evaluation.id));
    else setProjects((items) => items.filter((item) => item.id !== evaluation.id));
    toast.success((evaluation.kind === "task" ? "Tarea" : "Proyecto") + " cerrado y evaluado", {
      description: assigned.length ? `La nota ya afecta a ${assigned.length} perfil${assigned.length === 1 ? "." : "es."}${detailedValues.length ? " También guarda el desglose." : ""}` : "Calidad guardada; falta asignar equipo para afectar ratios.",
    });
    resetEvaluation();
  }
  function toggleSignal(value: string, selected: string[], setter: (items: string[]) => void) {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  async function syncNotion(kind: "task" | "project", id: string, changes: Record<string, unknown>) {
    const response = await fetch("/api/notion/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, changes }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || "No se pudo sincronizar con Notion");
    }
  }

  async function moveTask(id: string, status: TaskStatus) {
    const previous = tasks.find((task) => task.id === id);
    setTasks((items) => items.map((task) => task.id === id ? { ...task, status } : task));
    setDragging(null);
    try {
      await syncNotion("task", id, { status });
      toast.success(`Tarea movida a ${status}`, { description: "Sincronizado con Notion." });
    } catch {
      if (previous) setTasks((items) => items.map((task) => task.id === id ? previous : task));
      toast.error("Notion rechazó el cambio", { description: "Se ha restaurado el estado anterior." });
    }
  }
  async function moveProject(id: string, status: ProjectStatus) {
    const previous = projects.find((project) => project.id === id);
    setProjects((items) => items.map((project) => project.id === id ? { ...project, status } : project));
    setDragging(null);
    try {
      await syncNotion("project", id, { status });
      toast.success(`Proyecto movido a ${status}`, { description: "Sincronizado con Notion." });
    } catch {
      if (previous) setProjects((items) => items.map((project) => project.id === id ? previous : project));
      toast.error("Notion rechazó el cambio", { description: "Se ha restaurado el estado anterior." });
    }
  }
  async function setPlannerTaskAllDay(taskId: string, destinationDate: string) {
    const previous = allTasks.find((task) => task.id === taskId);
    if (!previous) return;
    const label = new Date(destinationDate + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "");
    const next = { ...previous, dateStart: destinationDate, dateEnd: null, date: label };
    setAllTasks((items) => items.map((task) => task.id === taskId ? next : task));
    setTasks((items) => items.map((task) => task.id === taskId ? next : task));
    try {
      await syncNotion("task", taskId, { dateStart: destinationDate, dateEnd: null });
      toast.success("Tarea marcada como todo el día", { description: "Movida a la franja superior y guardada en Notion." });
    } catch {
      setAllTasks((items) => items.map((task) => task.id === taskId ? previous : task));
      setTasks((items) => items.map((task) => task.id === taskId ? previous : task));
      toast.error("No se pudo marcar como todo el día");
    }
  }

  async function movePlannerTask(taskId: string, destinationDate: string, startMinutes: number) {
    const previous = allTasks.find((task) => task.id === taskId);
    if (!previous) return;
    const oldStart = plannerMinutes(previous.dateStart);
    const oldEnd = plannerMinutes(previous.dateEnd, oldStart + 60);
    const duration = Math.max(30, oldEnd - oldStart);
    const snappedStart = Math.max(PLANNER_START, Math.min(PLANNER_END - 30, Math.round(startMinutes / 15) * 15));
    const snappedEnd = Math.min(PLANNER_END, snappedStart + duration);
    const dateStart = localPlannerIso(destinationDate, snappedStart);
    const dateEnd = localPlannerIso(destinationDate, snappedEnd);
    const label = new Date(destinationDate + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "");
    const next = { ...previous, dateStart, dateEnd, date: label };
    setAllTasks((items) => items.map((task) => task.id === taskId ? next : task));
    setTasks((items) => items.map((task) => task.id === taskId ? next : task));
    try {
      await syncNotion("task", taskId, { dateStart, dateEnd });
      toast.success("Horario actualizado", { description: `${plannerTimeLabel(snappedStart)}–${plannerTimeLabel(snappedEnd)} · guardado en Notion.` });
    } catch {
      setAllTasks((items) => items.map((task) => task.id === taskId ? previous : task));
      setTasks((items) => items.map((task) => task.id === taskId ? previous : task));
      toast.error("No se pudo guardar el horario en Notion");
    }
  }

  function startPlannerResize(task: Task, edge: "start" | "end", event: React.PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const initialY = event.clientY;
    const initialStart = plannerMinutes(task.dateStart);
    const initialEnd = plannerMinutes(task.dateEnd, initialStart + 60);
    let latestStart = initialStart;
    let latestEnd = initialEnd;

    const move = (pointerEvent: PointerEvent) => {
      const delta = Math.round(((pointerEvent.clientY - initialY) / PLANNER_HOUR_PX) * 60 / 15) * 15;
      if (edge === "start") latestStart = Math.max(PLANNER_START, Math.min(initialEnd - 30, initialStart + delta));
      else latestEnd = Math.min(PLANNER_END, Math.max(initialStart + 30, initialEnd + delta));
      const dateStart = localPlannerIso(dateOnly(task.dateStart) || isoDate(operationalWeekStart), latestStart);
      const dateEnd = localPlannerIso(dateOnly(task.dateStart) || isoDate(operationalWeekStart), latestEnd);
      setAllTasks((items) => items.map((item) => item.id === task.id ? { ...item, dateStart, dateEnd } : item));
      setTasks((items) => items.map((item) => item.id === task.id ? { ...item, dateStart, dateEnd } : item));
    };

    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const day = dateOnly(task.dateStart) || isoDate(operationalWeekStart);
      const dateStart = localPlannerIso(day, latestStart);
      const dateEnd = localPlannerIso(day, latestEnd);
      try {
        await syncNotion("task", task.id, { dateStart, dateEnd });
        toast.success("Duración actualizada", { description: `${plannerTimeLabel(latestStart)}–${plannerTimeLabel(latestEnd)} · guardado en Notion.` });
      } catch {
        setAllTasks((items) => items.map((item) => item.id === task.id ? task : item));
        setTasks((items) => items.map((item) => item.id === task.id ? task : item));
        toast.error("No se pudo guardar la duración");
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  async function moveWeekItem(event: React.DragEvent, destinationDate: string) {
    event.preventDefault();
    const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    setDragging(null);

    if (kind === "task") {
      const previous = allTasks.find((task) => task.id === id);
      if (!previous || previous.dateStart === destinationDate) return;
      const label = new Date(destinationDate + "T00:00:00")
        .toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
        .toUpperCase()
        .replace(".", "");
      const next = { ...previous, dateStart: destinationDate, date: label };
      setAllTasks((items) => items.map((task) => task.id === id ? next : task));
      setTasks((items) => items.map((task) => task.id === id ? next : task));
      try {
        await syncNotion("task", id, { dateStart: destinationDate });
        toast.success("Tarea reprogramada", { description: `Movida al ${label} en Notion.` });
      } catch {
        setAllTasks((items) => items.map((task) => task.id === id ? previous : task));
        setTasks((items) => items.map((task) => task.id === id ? previous : task));
        toast.error("No se pudo cambiar la fecha en Notion");
      }
      return;
    }

    if (kind === "project-start" || kind === "project-end") {
      const previous = projects.find((project) => project.id === id);
      if (!previous) return;
      const field = kind === "project-start" ? "timingStart" : "timingEnd";
      if (previous[field] === destinationDate) return;
      const next = { ...previous, [field]: destinationDate } as Project;
      setProjects((items) => items.map((project) => project.id === id ? next : project));
      if (selectedProjectPage?.id === id) setSelectedProjectPage(next);
      try {
        await syncNotion("project", id, { [field]: destinationDate });
        toast.success(kind === "project-start" ? "Arranque reprogramado" : "Cierre reprogramado", {
          description: "Fecha actualizada en Notion.",
        });
      } catch {
        setProjects((items) => items.map((project) => project.id === id ? previous : project));
        if (selectedProjectPage?.id === id) setSelectedProjectPage(previous);
        toast.error("No se pudo cambiar la fecha del proyecto en Notion");
      }
    }
  }

  function handleDrop(event: React.DragEvent, destination: TaskStatus | ProjectStatus) {
    event.preventDefault(); const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    if (kind === "task") moveTask(id, destination as TaskStatus);
    if (kind === "project") moveProject(id, destination as ProjectStatus);
  }
  async function assignPerson(kind: "task" | "project", id: string, person: string) {
    const currentItem = kind === "task" ? tasks.find((task) => task.id === id) : projects.find((project) => project.id === id);
    if (!currentItem) return;
    const nextPeople = currentItem.people.includes(person) ? currentItem.people : [...currentItem.people.filter((name) => name !== "Por asignar"), person];
    if (kind === "task") setTasks((items) => items.map((task) => task.id === id ? { ...task, people: nextPeople } : task));
    else setProjects((items) => items.map((project) => project.id === id ? { ...project, people: nextPeople } : project));
    setDragging(null);
    try {
      await syncNotion(kind, id, { people: nextPeople });
      toast.success(`${person} asignado`, { description: "Relación actualizada en Notion." });
    } catch {
      if (kind === "task") setTasks((items) => items.map((task) => task.id === id ? { ...task, people: currentItem.people } : task));
      else setProjects((items) => items.map((project) => project.id === id ? { ...project, people: currentItem.people } : project));
      toast.error("No se pudo asignar en Notion");
    }
  }
  async function moveToAccount(event: React.DragEvent, account: string) {
    event.preventDefault(); const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    if (kind !== "task" && kind !== "project") return;
    const previous = kind === "task" ? tasks.find((task) => task.id === id) : projects.find((project) => project.id === id);
    if (!previous) return;
    if (kind === "task") setTasks((items) => items.map((task) => task.id === id ? { ...task, account } : task));
    else setProjects((items) => items.map((project) => project.id === id ? { ...project, account } : project));
    setDragging(null);
    try {
      await syncNotion(kind, id, { account });
      toast.success(`Movido a ${account}`, { description: "Relación actualizada en Notion." });
    } catch {
      if (kind === "task") setTasks((items) => items.map((task) => task.id === id ? { ...task, account: previous.account } : task));
      else setProjects((items) => items.map((project) => project.id === id ? { ...project, account: previous.account } : project));
      toast.error("No se pudo cambiar la cuenta en Notion");
    }
  }
  async function createQuickItem() {
    const name = quickName.trim();
    if (!name) return;
    try {
      const response = await fetch("/api/notion/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: quickType, name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo crear en Notion");

      if (quickType === "task") {
        setTasks((items) => [{
          id: body.id,
          name,
          status: "Pendiente",
          priority: "Media",
          project: "Por asignar",
          account: "Sin cuenta",
          date: "SIN FECHA",
          dateStart: null,
          people: ["Por asignar"],
          url: body.url || "https://www.notion.so",
        }, ...items]);
      } else {
        setProjects((items) => [{
          id: body.id,
          name,
          status: "Brief",
          account: "Sin cuenta",
          timing: "SIN FECHA",
          timingStart: null,
          timingEnd: null,
          type: "Proyecto",
          people: ["Por asignar"],
          priority: "Media",
          url: body.url || "https://www.notion.so",
        }, ...items]);
      }
      setQuickName(""); setDialogOpen(false);
      toast.success("Creado en Notion", { description: quickType === "task" ? "Tarea real creada." : "Proyecto real creado." });
    } catch (error) {
      toast.error("No se pudo crear", { description: error instanceof Error ? error.message : "Error desconocido" });
    }
  }
  function updateDetailField(field: string, value: unknown) {
    setDetail((currentDetail) => currentDetail ? ({ ...currentDetail, [field]: value } as Detail) : currentDetail);
  }
  function scrollProjectSection(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function updateProjectWorkspace(changes: Record<string, unknown>) {
    if (!selectedProjectPage) return;
    const previous = selectedProjectPage;
    const next = { ...selectedProjectPage, ...changes } as Project;
    setSelectedProjectPage(next);
    setProjects((items) => items.map((project) => project.id === next.id ? next : project));
    try {
      await syncNotion("project", next.id, changes);
      toast.success("Proyecto actualizado", { description: "Guardado directamente en Notion." });
    } catch (error) {
      setSelectedProjectPage(previous);
      setProjects((items) => items.map((project) => project.id === previous.id ? previous : project));
      toast.error("No se pudo actualizar el proyecto");
    }
  }

  async function updateWorkspaceTask(task: Task, changes: Record<string, unknown>) {
    const next = { ...task, ...changes } as Task;
    setAllTasks((items) => items.map((item) => item.id === task.id ? next : item));
    setTasks((items) => items.map((item) => item.id === task.id ? next : item));
    try {
      await syncNotion("task", task.id, changes);
    } catch {
      setAllTasks((items) => items.map((item) => item.id === task.id ? task : item));
      setTasks((items) => items.map((item) => item.id === task.id ? task : item));
      toast.error("No se pudo actualizar la tarea");
    }
  }

  async function createTaskForSelectedProject() {
    if (!selectedProjectPage || !projectTaskName.trim()) return;
    const name = projectTaskName.trim();
    try {
      const response = await fetch("/api/notion/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "task", name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo crear la tarea");
      const task: Task = {
        id: body.id,
        name,
        status: "Pendiente",
        priority: "Media",
        project: selectedProjectPage.name,
        account: selectedProjectPage.account,
        date: "SIN FECHA",
        dateStart: null,
        people: selectedProjectPage.people.length ? selectedProjectPage.people : ["Por asignar"],
        url: body.url || "https://www.notion.so",
      };
      await syncNotion("task", task.id, {
        project: selectedProjectPage.name,
        account: selectedProjectPage.account,
        people: task.people,
      });
      setAllTasks((items) => [task, ...items]);
      setTasks((items) => [task, ...items]);
      setProjectTaskName("");
      toast.success("Tarea creada dentro del proyecto");
    } catch (error) {
      toast.error("No se pudo crear la tarea", { description: error instanceof Error ? error.message : "Error desconocido" });
    }
  }

  async function saveDetail() {
    if (!detail) return;
    const kind = detail.kind;
    if (kind === "task") {
      const nextTask: Task = { ...detail, id: detail.id, name: detail.name, status: detail.status, priority: detail.priority, project: detail.project, account: detail.account, date: detail.date, dateStart: detail.dateStart, dateEnd: detail.dateEnd, people: detail.people, url: detail.url };
      setTasks((items) => items.map((task) => task.id === nextTask.id ? nextTask : task));
      try {
        await syncNotion("task", detail.id, {
          name: detail.name,
          status: detail.status,
          priority: detail.priority,
          project: detail.project,
          account: detail.account,
          people: detail.people,
          dateStart: detail.dateStart,
          dateEnd: detail.dateEnd,
        });
        setAllTasks((items) => items.map((task) => task.id === nextTask.id ? nextTask : task));
        toast.success("Cambios guardados", { description: "Datos y relaciones sincronizados con Notion." });
      } catch {
        toast.error("No se pudieron guardar los cambios en Notion");
      }
    } else {
      const nextProject: Project = { id: detail.id, name: detail.name, status: detail.status, account: detail.account, timing: detail.timing, timingStart: detail.timingStart, timingEnd: detail.timingEnd, type: detail.type, people: detail.people, priority: detail.priority, url: detail.url };
      setProjects((items) => items.map((project) => project.id === nextProject.id ? nextProject : project));
      try {
        await syncNotion("project", detail.id, {
          name: detail.name,
          status: detail.status,
          priority: detail.priority,
          type: detail.type,
          account: detail.account,
          people: detail.people,
          timingStart: detail.timingStart,
          timingEnd: detail.timingEnd,
        });
        toast.success("Cambios guardados", { description: "Datos y relaciones sincronizados con Notion." });
      } catch {
        toast.error("No se pudieron guardar los cambios en Notion");
      }
    }
  }
  function calendarIsoDate(day: number) {
    const month = calendarMonths[calendarMonth];
    return `${month.year}-${String(calendarMonth + 8).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  async function createCalendarTask() {
    const name = calendarTaskName.trim();
    const dateStart = calendarTaskDate;
    if (!name || !dateStart) return;
    try {
      const response = await fetch("/api/notion/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "task", name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo crear la tarea");
      const date = new Date(dateStart + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "");
      const task: Task = {
        id: body.id,
        name,
        status: "Pendiente",
        priority: "Media",
        project: "Por asignar",
        account: "Sin cuenta",
        date,
        dateStart,
        people: ["Por asignar"],
        url: body.url || "https://www.notion.so",
      };
      await syncNotion("task", task.id, { dateStart });
      setTasks((items) => [task, ...items]);
      setAllTasks((items) => [task, ...items]);
      setCalendarTaskName("");
      setCalendarTaskDate(null);
      toast.success("Tarea añadida al calendario", { description: date });
    } catch (error) {
      toast.error("No se pudo crear la tarea", { description: error instanceof Error ? error.message : "Error desconocido" });
    }
  }

  function openCalendarEvent(event: CalendarEvent) {
    if (event.kind === "task") {
      const task = tasks.find((item) => item.id === event.id);
      if (task) setDetail({ kind: "task", ...task });
    } else if (event.kind === "project") {
      const project = projects.find((item) => item.id === event.id);
      if (project) setSelectedProjectPage(project);
    } else {
      setActiveView("holidays");
    }
  }

  return <Tabs value={activeView} onValueChange={(value) => setActiveView(value as View)} orientation="vertical" className="os-shell">
    <aside className="sidebar-shell">
      <div className="brand-lockup"><span>O</span><strong>OGILVY<br />OS</strong></div>
      <div className="nav-section-label"><span>ESPACIOS</span><small>9 vistas</small></div>
      <TabsList className="nav-list" variant="line" aria-label="Navegación principal">
        {navigation.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className={`nav-item ${value === "dashboard" ? "nav-dashboard" : ""}`}><Icon /><span>{label}</span>{value === "dashboard" && <small>GENERAL</small>}</TabsTrigger>)}
      </TabsList>
      <div className="sync-card"><span className="sync-dot" /><div><strong>{schemaState === "live" && dataState === "live" ? "NOTION EN VIVO" : schemaState === "error" || dataState === "error" ? "NOTION · SIN DATOS" : "CONECTANDO NOTION"}</strong><small>{schemaState === "live" && dataState === "live" ? `${liveCounts?.activeTasks ?? tasks.length} tareas · ${liveCounts?.activeProjects ?? projects.length} proyectos · opciones reales` : schemaState === "error" || dataState === "error" ? "No se muestran snapshots antiguos como si fueran actuales" : "Leyendo filas, relaciones y schema…"}</small></div></div>
      <form action="/api/auth/logout" method="post" className="user-chip"><span>JC</span><div><strong>JORGE</strong><small>Director Creativo</small></div><button type="submit" className="user-chip-logout">Salir</button></form>
    </aside>

    <main className={`main-stage main-stage-${activeView}${selectedProjectPage ? " project-page-open" : ""}`} aria-hidden={selectedProjectPage ? true : undefined}>
      <header className="topbar">
        <div className="page-heading"><span>{current.eyebrow}</span><h1>{current.title}</h1><p>{current.description}</p></div>
        <div className="top-actions">
          <label className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el OS…" /></label>
          {queuedChanges > 0 && <button className="draft-chip" onClick={() => toast.info("Cambios de prototipo", { description: "Los conectaremos a Notion en la siguiente capa." })}>{queuedChanges} cambio{queuedChanges > 1 ? "s" : ""}</button>}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="add-button"><Plus /> Añadir</Button></DialogTrigger>
            <DialogContent className="quick-dialog"><DialogHeader><DialogTitle>Añadir sin ceremonia</DialogTitle><DialogDescription>Crea una tarea o proyecto y completa después el resto de propiedades.</DialogDescription></DialogHeader>
              <div className="quick-form"><Select value={quickType} onValueChange={setQuickType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="task">Tarea</SelectItem><SelectItem value="project">Proyecto</SelectItem></SelectContent></Select><input autoFocus value={quickName} onChange={(event) => setQuickName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createQuickItem(); }} placeholder={quickType === "task" ? "¿Qué hay que hacer?" : "Nombre del proyecto"} /></div>
              <DialogFooter><Button onClick={createQuickItem}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <TabsContent value="dashboard" className="view-content dashboard-view">
        <section className="dashboard-hero-grid">
          <article className="dashboard-pulse-card">
            <div className="dashboard-hero-kicker"><span>PULSO DEL DÍA</span><i className={dataState === "live" ? "live" : ""} /></div>
            <div className="dashboard-pulse-body">
              <div className="dashboard-pulse-copy">
                <strong className="dashboard-pulse-weekday">{new Date().toLocaleDateString("es-ES", { weekday: "long" })}</strong>
                <span className="dashboard-pulse-full-date">{new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</span>
                <div className="dashboard-pulse-stats">
                  <span><b>{tasks.length.toString().padStart(2, "0")}</b><small>tareas activas</small></span>
                  <span><b>{dashboardProjects.length.toString().padStart(2, "0")}</b><small>proyectos</small></span>
                  <span><b>{team.filter((person) => person.load >= 75).length.toString().padStart(2, "0")}</b><small>carga alta</small></span>
                </div>
              </div>

              <div className="dashboard-pulse-hits">
                {upcomingDeadlines[0] ? <>
                  {upcomingDeadlines[2] && <div className="dashboard-pulse-hit-back pulse-hit-back-2" aria-hidden="true">
                    <span>{upcomingDeadlines[2].date}</span>
                    <strong>{upcomingDeadlines[2].name}</strong>
                    <small>{upcomingDeadlines[2].project}</small>
                  </div>}
                  {upcomingDeadlines[1] && <div className="dashboard-pulse-hit-back pulse-hit-back-1" aria-hidden="true">
                    <span>{upcomingDeadlines[1].date}</span>
                    <strong>{upcomingDeadlines[1].name}</strong>
                    <small>{upcomingDeadlines[1].project}</small>
                  </div>}
                  <button
                    className="dashboard-pulse-hit-card pulse-hit-main"
                    onClick={() => setDetail({ kind: "task", ...upcomingDeadlines[0] })}
                  >
                    <span>PRÓXIMO HITO</span>
                    <strong>{upcomingDeadlines[0].name}</strong>
                    <small>{upcomingDeadlines[0].project} · {upcomingDeadlines[0].date}</small>
                    <ArrowUpRight />
                  </button>
                </> : <div className="dashboard-pulse-hit-empty"><Check /><span>Sin entregas próximas</span></div>}
              </div>
            </div>
          </article>

          <article className="dashboard-focus-card">
            <header className="module-head"><div><span>EN FOCO</span><h2>Próximos movimientos</h2></div><button className="module-action" onClick={() => setActiveView("calendar")}>Agenda <ArrowUpRight /></button></header>
            <div className="dashboard-focus-accordion">
              {upcomingDeadlines.slice(0, 3).map((task, index) => <button
                key={task.id}
                className={`dashboard-focus-accordion-card focus-card-${index + 1}`}
                onClick={() => setDetail({ kind: "task", ...task })}
              >
                <span className="focus-accordion-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="focus-accordion-copy"><strong>{task.name}</strong><small>{task.project} · {task.date}</small></div>
                <ArrowUpRight />
              </button>)}
              {!upcomingDeadlines.length && <div className="dashboard-focus-empty"><Check /><span>No hay entregas próximas con fecha.</span></div>}
            </div>
          </article>

          <article className="dashboard-timer-card">
            <div className="dashboard-timer-top"><span>FOCUS</span><i className={focusRunning ? "running" : ""} /></div>
            <strong>{String(Math.floor(focusSeconds / 60)).padStart(2, "0")}:{String(focusSeconds % 60).padStart(2, "0")}</strong>
            <small>{focusRunning ? "Sesión en curso" : "Pomodoro · 25 min"}</small>
            <div className="dashboard-timer-actions">
              <button aria-label={focusRunning ? "Pausar" : "Iniciar"} onClick={() => setFocusRunning((running) => !running)}>{focusRunning ? <Pause /> : <Play />}</button>
              <button aria-label="Reiniciar" onClick={() => { setFocusRunning(false); setFocusSeconds(25 * 60); }}><RotateCcw /></button>
            </div>
            <span className="dashboard-sync-status"><i className={dataState === "live" ? "ok" : ""} /> {dataState === "live" ? "Notion sincronizado" : "Sincronizando"}</span>
          </article>
        </section>
        <section className="control-room">
          <div className="dashboard-workbench">
            <article className="ops-panel tasks-overview">
              <div className="ops-head module-head"><div><span>OPERATIVA EN VIVO</span><h2>Tareas</h2></div><button className="module-action" onClick={() => setActiveView("tasks")}>Ver tablero <ArrowUpRight /></button></div>
              <div className="mini-task-board">
                {taskBoardStatuses.map((status) => {
                  const items = tasks.filter((task) => task.status === status);
                  const total = items.length;
                  return <div key={status} className={`mini-task-lane ${dragging?.startsWith("task") ? "ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
                    <div className="mini-lane-head"><span>{status}</span><b>{total}</b></div>
                    <div className="mini-task-lane-scroll">
                      {items.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setDetail({ kind: "task", ...task })} onDragStart={() => setDragging(`task:${task.id}`)} onAssignPerson={(person) => assignPerson("task", task.id, person)} />)}
                      {items.length === 0 && <EmptyDrop />}
                    </div>
                  </div>;
                })}
              </div>
            </article>

            <article className="ops-panel projects-overview">
              <div className="ops-head module-head"><div><span>MAPA DE TRABAJO</span><h2>Proyectos activos</h2></div><button className="module-action" onClick={() => setActiveView("projects")}>Ver pipeline <ArrowUpRight /></button></div>
              <div className="project-overview-list">
                {dashboardProjects.map((project) => <div key={project.id} className="dashboard-project" draggable
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", `project:${project.id}`); setDragging(`project:${project.id}`); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { const [kind, person] = event.dataTransfer.getData("text/plain").split(":"); if (kind === "person") { event.preventDefault(); assignPerson("project", project.id, person); } }}
                  onClick={() => setSelectedProjectPage(project)}>
                  <div className="dashboard-project-top">
                    <div className="dashboard-project-client"><span className={`priority-dot ${priorityClass(project.priority)}`} /><span className="client-label">{project.account}</span></div>
                    <span className={`stage-chip stage-${project.status.toLowerCase().replace("-", "")}`}>{project.status}</span>
                    <GripVertical className="drag-handle" />
                  </div>
                  <div className="dashboard-project-copy"><strong>{project.name}</strong><small>{project.type} · {project.timing}</small></div>
                  <div className="dashboard-project-footer"><PeopleStack people={project.people} /></div>
                </div>)}
              </div>
              <div className="deadline-ribbon">
                <div className="deadline-ribbon-title"><AlertTriangle /><span>PRÓXIMAS FECHAS</span></div>
                <div className="deadline-ribbon-list">
                  {upcomingDeadlines.length ? upcomingDeadlines.slice(0, 8).map((task) => <button key={task.id} onClick={() => setDetail({ kind: "task", ...task })}>
                    <strong>{task.date}</strong><span>{task.name}</span>
                  </button>) : <small>Sin entregas próximas con fecha en Notion</small>}
                </div>
              </div>
            </article>
          </div>

          <aside className="team-roster">
            <div className="roster-head module-head"><div><span>{team.length} PERSONAS</span><h2>Equipo</h2></div><button className="module-action" onClick={() => setActiveView("team")}>Ver equipo <ArrowUpRight /></button></div>
            <div className="roster-list">{team.map((person) => { const performance = personPerformance(person); return <button key={person.name} className="roster-person" draggable
              onDragStart={(event) => { event.dataTransfer.setData("text/plain", `person:${person.name}`); setDragging(`person:${person.name}`); }}
              onDragEnd={() => setDragging(null)} onClick={() => setSelectedPerson(person)}>
              <div className={`avatar avatar-${person.tone}`}>{person.initials}</div><span><strong>{person.name}</strong><small>{person.role}</small></span><i className={person.load >= 75 ? "hot" : person.load >= 45 ? "warm" : "cool"} title={`${person.load}% de carga relativa`} /><b className="roster-ratio">{performance.ratio ?? "—"}</b>
            </button>; })}</div>
            <button className="roster-footer" onClick={() => setActiveView("team")}>Abrir fichas completas <ChevronRight /></button>
          </aside>
        </section>

        <section className="account-dock">
          <div className="account-dock-title"><span>CUENTAS</span><small>Arrastra aquí una tarea o proyecto para reasignarlo</small></div>
          <div className="account-dock-track">{accounts.map((account) => <button key={account.name} className={`account-dock-chip ${dragging?.startsWith("task") || dragging?.startsWith("project") ? "ready" : ""}`} style={{ "--account-color": account.color, "--account-contrast": accountContrast(account.color) } as React.CSSProperties}
            onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveToAccount(event, account.name)} onClick={() => setSelectedAccount(account)}>
            <span className="account-dock-copy"><strong>{account.name}</strong><small>{account.projects} proyectos · {account.tasks} tareas</small></span><i />
          </button>)}</div>
        </section>
      </TabsContent>

      <TabsContent value="week" className="view-content week-view">
        <section className="week-hero-grid">
          <article className="week-pulse-card">
            <div className="week-widget-kicker"><span>SEMANA · {operationalWeekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "").toUpperCase()} — {operationalWeekEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "").toUpperCase()}</span><i /></div>
            <div className="week-pulse-main">
              <div>
                <strong>{Math.floor(weekPlannerStats.totalMinutes / 60)}h {String(weekPlannerStats.totalMinutes % 60).padStart(2, "0")}</strong>
                <span>planificadas</span>
              </div>
              <div className="week-pulse-meta">
                <span><b>{weekPlannerStats.timedTasks.length}</b><small>tareas</small></span>
                <span><b>{weekPlannerStats.conflicts}</b><small>conflictos</small></span>
                <span><b>{weeklyTasks.filter(taskIsAllDay).length}</b><small>todo el día</small></span>
              </div>
            </div>
            <div className="week-load-bars" aria-label="Carga por día">
              {weekPlannerStats.dayMinutes.map((minutes, index) => <div key={isoDate(operationalWeekDays[index])}>
                <i><b style={{ height: `${Math.max(8, (minutes / weekPlannerStats.maxDayMinutes) * 100)}%` }} /></i>
                <span>{operationalWeekDays[index].toLocaleDateString("es-ES", { weekday: "narrow" }).toUpperCase()}</span>
              </div>)}
            </div>
          </article>

          <article className="week-free-card">
            <header className="module-head"><div><span>DISPONIBILIDAD</span><h2>Próximos huecos</h2></div><Clock3 /></header>
            <div className="week-free-list">
              {weekPlannerStats.freeSlots.map((slot) => <div key={slot.key + slot.start} className="week-free-slot">
                <span>{slot.label}</span>
                <strong>{plannerTimeLabel(slot.start)} — {plannerTimeLabel(slot.end)}</strong>
                <small>{Math.floor(slot.duration / 60)}h{slot.duration % 60 ? " " + slot.duration % 60 + "m" : ""}</small>
              </div>)}
              {!weekPlannerStats.freeSlots.length && <div className="week-free-empty"><Check /><span>Semana compacta. Sin huecos largos.</span></div>}
            </div>
          </article>

          <article className="week-today-card">
            <div className="week-widget-kicker"><span>HOY</span><i /></div>
            <strong>{Math.floor(weekPlannerStats.todayMinutes / 60)}h {String(weekPlannerStats.todayMinutes % 60).padStart(2, "0")}</strong>
            <small>planificadas · {weekPlannerStats.todayTasks.length} tarea{weekPlannerStats.todayTasks.length === 1 ? "" : "s"}</small>
            <div className="week-today-progress"><i><b style={{ width: `${Math.min(100, weekPlannerStats.todayPercent)}%` }} /></i><span>{weekPlannerStats.todayPercent}%</span></div>
            <div className="week-today-next">
              <span>{weekPlannerStats.nextToday ? "PRÓXIMA" : "ESTADO"}</span>
              <strong>{weekPlannerStats.nextToday?.name || "Día despejado"}</strong>
              <small>{weekPlannerStats.nextToday ? plannerTimeLabel(plannerMinutes(weekPlannerStats.nextToday.dateStart)) : "Sin tareas horarias hoy"}</small>
            </div>
          </article>
        </section>

        <section className="week-planner">
          <div className="week-planner-head">
            <div className="planner-time-corner"><span>HORARIO</span><small>Arrastra · estira</small></div>
            {operationalWeekDays.map((day) => {
              const key = isoDate(day);
              const count = weeklyTasks.filter((task) => dateOnly(task.dateStart) === key).length;
              return <div key={key} className="planner-day-head">
                <span>{day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase()}</span>
                <strong>{day.getDate()}</strong>
                <small>{day.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase()} · {count} tarea{count === 1 ? "" : "s"}</small>
              </div>;
            })}
          </div>

          <div className="week-planner-allday">
            <div className="planner-allday-label">TODO EL DÍA</div>
            {operationalWeekDays.map((day) => {
              const key = isoDate(day);
              const dayProjects = weeklyProjectMilestones.filter((event) => event.date === key);
              const dayHolidays = weeklyHolidays.filter((holiday) => holiday.start <= key && holiday.end >= key);
              const allDayTasks = weeklyTasks.filter((task) => dateOnly(task.dateStart) === key && taskIsAllDay(task));
              const acceptingTask = Boolean(dragging?.startsWith("task:"));
              return <div key={key} className={"planner-allday-cell " + (acceptingTask ? "task-drop-ready" : "")}
                onDragOver={(event) => { if (dragging?.startsWith("project-") || acceptingTask) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
                  setDragging(null);
                  if (kind === "task") { void setPlannerTaskAllDay(id, key); return; }
                  void moveWeekItem(event, key);
                }}>
                {allDayTasks.map((task) => <div key={task.id} className="planner-all-day-chip task" title={task.name}>
                  <i /><span><strong>{task.name}</strong><small>{task.project}</small></span>
                  <span className="planner-all-day-grip" draggable onDragStart={(dragEvent) => { dragEvent.dataTransfer.setData("text/plain", `task:${task.id}`); dragEvent.dataTransfer.effectAllowed = "move"; setDragging(`task:${task.id}`); }} onDragEnd={() => setDragging(null)}><GripVertical /></span>
                </div>)}
                {dayProjects.map((event) => <button key={event.id} draggable className="planner-all-day-chip project"
                  onDragStart={(dragEvent) => { dragEvent.dataTransfer.setData("text/plain", `project-${event.kind}:${event.project.id}`); dragEvent.dataTransfer.effectAllowed = "move"; setDragging(`project-${event.kind}:${event.project.id}`); }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => setSelectedProjectPage(event.project)}>
                  <i /><span><strong>{event.project.name}</strong><small>{event.label}</small></span>
                </button>)}
                {dayHolidays.map((holiday) => <button key={holiday.id || holiday.name} className="planner-all-day-chip holiday" onClick={() => setActiveView("holidays")}>
                  <i /><span><strong>{holiday.name}</strong><small>{holiday.type}</small></span>
                </button>)}
              </div>;
            })}
          </div>

          <div className="week-planner-scroll">
            <div className="week-planner-grid">
              <aside className="planner-time-axis">
                {Array.from({ length: 11 }, (_, index) => 9 + index).map((hour) => <span key={hour} style={{ top: `${(hour - 9) * PLANNER_HOUR_PX}px` }}>{String(hour).padStart(2, "0")}:00</span>)}
              </aside>

              {operationalWeekDays.map((day) => {
                const key = isoDate(day);
                const dayTasks = weeklyTasks.filter((task) => dateOnly(task.dateStart) === key && !taskIsAllDay(task));
                return <div key={key} className="planner-day-column"
                  onDragOver={(event) => { if (dragging?.startsWith("task:")) event.preventDefault(); }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
                    if (kind !== "task") return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
                    const minutes = PLANNER_START + (y / PLANNER_HOUR_PX) * 60;
                    setDragging(null);
                    void movePlannerTask(id, key, minutes);
                  }}>
                  <div className="planner-hour-lines" aria-hidden="true">
                    {Array.from({ length: 11 }, (_, index) => <i key={index} style={{ top: `${index * PLANNER_HOUR_PX}px` }} />)}
                  </div>

                  {dayTasks.map((task) => {
                    const startMinutes = plannerMinutes(task.dateStart);
                    const endMinutes = plannerMinutes(task.dateEnd, startMinutes + 60);
                    const visibleStart = Math.max(PLANNER_START, Math.min(PLANNER_END, startMinutes));
                    const visibleEnd = Math.max(visibleStart + 30, Math.min(PLANNER_END, endMinutes));
                    const top = ((visibleStart - PLANNER_START) / 60) * PLANNER_HOUR_PX;
                    const height = Math.max(42, ((visibleEnd - visibleStart) / 60) * PLANNER_HOUR_PX);
                    return <button key={task.id}
                      className={"planner-task-block " + (["Alta", "Urgente"].includes(task.priority) ? "critical" : "")}
                      style={{ top: `${top}px`, height: `calc(${height}px - 4px)` }}>
                      <span className="planner-resize-handle top" onPointerDown={(event) => startPlannerResize(task, "start", event)} />
                      <div className="planner-task-time">{plannerTimeLabel(startMinutes)}–{plannerTimeLabel(endMinutes)}</div>
                      <strong>{task.name}</strong>
                      <small>{task.project} · {task.account}</small>
                      <span
                        className="planner-task-grip"
                        draggable
                        role="button"
                        aria-label="Arrastrar tarea"
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(dragEvent) => {
                          dragEvent.stopPropagation();
                          dragEvent.dataTransfer.setData("text/plain", `task:${task.id}`);
                          dragEvent.dataTransfer.effectAllowed = "move";
                          setDragging(`task:${task.id}`);
                        }}
                        onDragEnd={() => setDragging(null)}
                      ><GripVertical /></span>
                      <span className="planner-resize-handle bottom" onPointerDown={(event) => startPlannerResize(task, "end", event)} />
                    </button>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="timeline" className="view-content global-timeline-view">
        <section className="global-timeline-shell timeline-v3">
          <header className="global-timeline-toolbar timeline-toolbar-v3">
            <div className="timeline-window">
              <button className="timeline-today" onClick={() => setTimelineWeeks(8)}>Hoy</button>
              <div><span>VENTANA</span><strong>{globalTimelineStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — {globalTimelineEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
            </div>
            <div className="timeline-range-switch">{[4, 8, 12].map((weeks) => <button key={weeks} className={timelineWeeks === weeks ? "active" : ""} onClick={() => setTimelineWeeks(weeks)}>{weeks} sem</button>)}</div>
          </header>

          <div className="global-timeline-scale timeline-scale-v3">
            {Array.from({ length: timelineWeeks + 1 }, (_, index) => <span key={index} style={{ left: `${(index / timelineWeeks) * 100}%` }}>{addDays(globalTimelineStart, index * 7).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>)}
          </div>

          <div className="global-timeline-groups timeline-groups-v3">
            {accounts.map((account) => {
              const visibleAccountProjects = projects
                .filter((project) => project.account === account.name)
                .map((project) => {
                  const left = timelinePercent(project.timingStart, globalTimelineStart, globalTimelineEnd);
                  const right = timelinePercent(project.timingEnd || project.timingStart, globalTimelineStart, globalTimelineEnd);
                  const visibleBar = left != null && right != null && right >= 0 && left <= 100;

                  const visibleTasks = allTasks
                    .filter((task) => task.project === project.name && task.dateStart)
                    .map((task) => ({ task, pos: timelinePercent(task.dateStart, globalTimelineStart, globalTimelineEnd) }))
                    .filter(({ pos }) => pos != null && pos >= 0 && pos <= 100) as { task: Task; pos: number }[];

                  if (!visibleBar && !visibleTasks.length) return null;
                  return { project, left, right, visibleBar, visibleTasks };
                })
                .filter(Boolean) as {
                  project: Project;
                  left: number | null;
                  right: number | null;
                  visibleBar: boolean;
                  visibleTasks: { task: Task; pos: number }[];
                }[];

              if (!visibleAccountProjects.length) return null;

              return <section key={account.name} className="timeline-account-group timeline-account-card" style={{ "--timeline-color": account.color } as React.CSSProperties}>
                <header className="timeline-account-head">
                  <span className="timeline-account-dot" />
                  <div><strong>{account.name}</strong><small>{visibleAccountProjects.length} proyecto{visibleAccountProjects.length === 1 ? "" : "s"}</small></div>
                </header>

                <div className="timeline-account-projects">
                  {visibleAccountProjects.map(({ project, left, right, visibleBar, visibleTasks }) => <button key={project.id} className="global-project-row timeline-project-row" onClick={() => setSelectedProjectPage(project)}>
                    <span className="global-project-name timeline-project-name"><strong>{project.name}</strong><small>{project.status}</small></span>

                    <span className="global-project-track timeline-project-track">
                      {visibleBar && <i className="global-project-bar timeline-project-bar" style={{ left: `${clamp(left!)}%`, width: `${Math.max(2, clamp(right!) - clamp(left!))}%` }} />}

                      {visibleTasks.map(({ task, pos }) => <b
                        key={task.id}
                        className={"global-task-marker status-" + task.status.toLowerCase().replaceAll(" ", "-")}
                        style={{ left: `${pos}%` }}
                      >
                        <span className="timeline-marker-tooltip"><strong>{task.name}</strong><small>{task.date} · {task.status}</small></span>
                      </b>)}
                    </span>

                    
                  </button>)}
                </div>
              </section>;
            })}
          </div>
        </section>
      </TabsContent>

      <TabsContent value="calendar" className="view-content calendar-view">
        <section className="calendar-shell calendar-shell-v2">
          <header className="calendar-toolbar">
            <div className="month-switcher">
              <button aria-label="Mes anterior" disabled={calendarMonth === 0} onClick={() => setCalendarMonth((month) => Math.max(0, month - 1))}><ChevronLeft /></button>
              <div><span>CRONOLOGÍA</span><strong>{calendarMonths[calendarMonth].name} {calendarMonths[calendarMonth].year}</strong></div>
              <button aria-label="Mes siguiente" disabled={calendarMonth === calendarMonths.length - 1} onClick={() => setCalendarMonth((month) => Math.min(calendarMonths.length - 1, month + 1))}><ChevronRight /></button>
              <button className="today-button" onClick={() => setCalendarMonth(1)}>Hoy</button>
            </div>
            <div className="calendar-filters" aria-label="Filtrar calendario">
              {([["all", "Todo"], ["task", "Tareas"], ["project", "Proyectos"], ["holiday", "Ausencias"]] as [CalendarFilter, string][]).map(([value, label]) => <button key={value} className={calendarFilter === value ? "active" : ""} onClick={() => setCalendarFilter(value)}>{label}</button>)}
            </div>
          </header>

          <div className="calendar-layout calendar-layout-v2">
            <section className="calendar-month-board">
              <div className="calendar-month-head module-head">
                <div><span>MES</span><h2>{calendarMonths[calendarMonth].name}</h2></div>
                <div className="calendar-legend"><span><i className="dot-task" />Tarea</span><span><i className="dot-project" />Proyecto</span><span><i className="dot-holiday" />Ausencia</span></div>
              </div>
              <div className="calendar-weekdays">{["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-month-grid">
                {Array.from({ length: calendarMonths[calendarMonth].offset }).map((_, index) => <div className="calendar-day blank" key={"blank-" + index} />)}
                {Array.from({ length: calendarMonths[calendarMonth].days }, (_, index) => index + 1).map((day) => {
                  const allDayEvents = calendarEvents.filter((event) => event.month === calendarMonth && event.day === day);
                  const dayEvents = allDayEvents.filter((event) => calendarFilter === "all" || event.kind === calendarFilter);
                  const isToday = calendarMonth === 1 && day === 30;
                  return <div key={day} className={"calendar-day" + (isToday ? " today" : "") + (dayEvents.length ? " has-events" : "")}>
                    <div className="calendar-day-head">
                      <span>{day}</span>
                      <button className="calendar-day-add" title="Añadir tarea" aria-label={`Añadir tarea el día ${day}`} onClick={() => { setCalendarTaskDate(calendarIsoDate(day)); setCalendarTaskName(""); }}><Plus /></button>
                    </div>
                    <div className="calendar-day-items">
                      {dayEvents.slice(0, 4).map((event) => <button key={event.key} className={"calendar-chip chip-" + event.kind} onClick={() => openCalendarEvent(event)} title={event.title}><i /><span>{event.title}</span></button>)}
                      {dayEvents.length > 4 && <button className="calendar-more" onClick={() => setCalendarFilter("all")}>+{dayEvents.length - 4} más</button>}
                    </div>
                  </div>;
                })}
              </div>
            </section>

            <aside className="calendar-side-stack">
              <article className="calendar-insight compact-insight"><Sparkles /><span>LECTURA RÁPIDA</span><h2>{visibleCalendarEvents.length ? `${visibleCalendarEvents.length} hitos visibles este mes.` : "Mes despejado."}</h2><p>El calendario enseña ahora el trabajo donde ocurre: dentro de cada día. Revolucionario, aparentemente.</p></article>

              <section className="chronology-card compact-chronology">
                <div className="chronology-head module-head"><div><span>AGENDA</span><h2>Fechas clave</h2></div><strong>{visibleCalendarEvents.length}</strong></div>
                <div className="chronology-list">
                  {visibleEventDays.slice(0, 8).map((day) => <div className="chronology-day" key={day}>
                    <div className="date-stamp"><strong>{day.toString().padStart(2, "0")}</strong><span>{calendarMonths[calendarMonth].short}</span></div>
                    <div className="day-events">{visibleCalendarEvents.filter((event) => event.day === day).slice(0, 2).map((event) => <button key={event.key} className={"calendar-event event-" + event.kind} onClick={() => openCalendarEvent(event)}><i /><span><strong>{event.title}</strong><small>{event.meta}{event.account ? " · " + event.account : ""}</small></span></button>)}</div>
                  </div>)}
                  {visibleEventDays.length === 0 && <div className="calendar-empty compact"><CalendarDays /><strong>Sin fechas clave</strong></div>}
                </div>
              </section>
            </aside>
          </div>
        </section>

        <Dialog open={Boolean(calendarTaskDate)} onOpenChange={(open) => { if (!open) { setCalendarTaskDate(null); setCalendarTaskName(""); } }}>
          <DialogContent className="calendar-create-dialog">
            <DialogHeader>
              <DialogTitle>Nueva tarea</DialogTitle>
              <DialogDescription>{calendarTaskDate ? new Date(calendarTaskDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : ""}</DialogDescription>
            </DialogHeader>
            <div className="calendar-create-form">
              <input autoFocus value={calendarTaskName} onChange={(event) => setCalendarTaskName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createCalendarTask(); }} placeholder="Nombre de la tarea…" />
            </div>
            <DialogFooter><Button onClick={createCalendarTask}><Plus /> Crear tarea</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="accounts" className="view-content accounts-view">
        <section className="accounts-hero-grid">
          <article className="accounts-pulse-card">
            <div className="accounts-widget-kicker"><span>PULSO DE CUENTAS</span><i /></div>
            <div className="accounts-pulse-main">
              <div>
                <strong>{accounts.length}</strong>
                <span>cuentas activas</span>
              </div>
              <div className="accounts-pulse-meta">
                <span><b>{accountViewStats.totalProjects}</b><small>proyectos activos</small></span>
                <span><b>{accountViewStats.totalTasks}</b><small>tareas abiertas</small></span>
                <span><b>{accountViewStats.highPriority}</b><small>prioridad alta</small></span>
              </div>
            </div>
            <div className="accounts-pulse-stack">
              {accountViewStats.moving.map((account,index) => <button
                key={account.name}
                className={`accounts-pulse-mini pulse-mini-${index + 1}`}
                onClick={() => setSelectedAccount(account)}
              >
                <span>{String(index + 1).padStart(2,"0")}</span>
                <div>
                  <strong>{account.name}</strong>
                  <small>{account.activeProjects} proyectos · {account.activeTasks} tareas</small>
                </div>
                <ArrowUpRight />
              </button>)}
            </div>
          </article>

          <article className="accounts-moving-card">
            <header className="module-head"><div><span>EN MOVIMIENTO</span><h2>Actividad por cuenta</h2></div><TrendingUp /></header>
            <div className="accounts-moving-list">
              {accountViewStats.moving.map((account,index) => <button key={account.name} onClick={() => setSelectedAccount(account)}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{account.name}</strong><small>{account.activeProjects} proyectos · {account.activeTasks} tareas</small></div>
                <ArrowUpRight />
              </button>)}
            </div>
          </article>

          <article className="accounts-attention-card">
            <div className="accounts-widget-kicker"><span>ATENCIÓN</span><i /></div>
            <strong>{accountViewStats.highPriority}</strong>
            <small>cuentas en prioridad alta</small>
            <div className="accounts-attention-next">
              <span>PRÓXIMA ENTREGA</span>
              {(() => {
                const next = accountViewStats.items.flatMap((account) => account.nextDeadline ? [{ account: account.name, task: account.nextDeadline }] : [])
                  .sort((a,b) => new Date(a.task.dateStart || 0).getTime() - new Date(b.task.dateStart || 0).getTime())[0];
                return next ? <><strong>{next.task.name}</strong><small>{next.account} · {next.task.date}</small></> : <><strong>Sin urgencias</strong><small>No hay fechas próximas</small></>;
              })()}
            </div>
          </article>
        </section>

        <section className="accounts-grid accounts-grid-redesign">
          {accountViewStats.items.filter((account) => !q || account.name.toLowerCase().includes(q)).map((account) => <article
            key={account.name}
            className={`account-card account-card-redesign ${dragging?.startsWith("task") || dragging?.startsWith("project") ? "is-drop-ready" : ""}`}
            style={{ "--account-color": account.color } as React.CSSProperties}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => moveToAccount(event, account.name)}
          >
            <div className="account-card-meta">
              <span className="account-micro-accent" />
              <span>{account.contract || "CUENTA"}</span>
              <span className="account-priority">{account.priority}</span>
            </div>

            <div className="account-card-center">
              <h2>{account.name}</h2>
              <p>{account.activeProjects} proyectos activos · {account.activeTasks} tareas abiertas</p>
              <div className="account-next-hit">
                <span>PRÓXIMO</span>
                <strong>{account.nextDeadline?.name || "Sin fecha próxima"}</strong>
                <small>{account.nextDeadline ? account.nextDeadline.date : "Calendario despejado"}</small>
              </div>
            </div>

            <div className="account-card-bottom">
              <div className="account-metrics">
                <span><b>{account.projects}</b><small>proyectos</small></span>
                <span><b>{account.tasks ?? account.activeTasks}</b><small>tareas</small></span>
                <span><b>{account.pulse}</b><small>pulso</small></span>
              </div>
              <div className="account-card-team"><span>EQUIPO</span><PeopleStack people={account.people} /></div>
            </div>

            <div className="account-card-hover">
              <div>
                <span>CUENTA</span>
                <h3>{account.name}</h3>
              </div>
              <div className="account-hover-projects">
                {projects.filter((project) => project.account === account.name).slice(0,2).map((project) => <span key={project.id}>{project.name}</span>)}
                {!projects.some((project) => project.account === account.name) && <span>Sin proyectos activos</span>}
              </div>
              <button onClick={() => setSelectedAccount(account)}>Abrir cuenta <ArrowUpRight /></button>
            </div>
          </article>)}
        </section>
      </TabsContent>

      <TabsContent value="projects" className="view-content board-scroll"><section className="kanban-board project-board project-board-complete">{projectBoardStatuses.map((status) => { const items = filteredProjects.filter((project) => project.status === status); return <div key={status} className={`kanban-column ${dragging?.startsWith("project") ? "is-drop-ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}><div className="column-head"><span>{status === "Standby" ? "Stand by" : status}</span><b>{items.length}</b><Plus /></div><div className="column-body">{items.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProjectPage(project)} onDragStart={() => setDragging(`project:${project.id}`)} onAssignPerson={(person) => assignPerson("project", project.id, person)} />)}{items.length === 0 && <EmptyDrop />}</div></div>; })}</section></TabsContent>

      <TabsContent value="tasks" className="view-content board-scroll"><section className="kanban-board task-board active-task-board">{taskBoardStatuses.map((status) => { const items = filteredTasks.filter((task) => task.status === status); return <div key={status} className={`kanban-column ${dragging?.startsWith("task") ? "is-drop-ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}><div className="column-head"><span>{status}</span><b>{items.length}</b><Plus /></div><div className="column-body">{items.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setDetail({ kind: "task", ...task })} onDragStart={() => setDragging(`task:${task.id}`)} onAssignPerson={(person) => assignPerson("task", task.id, person)} />)}{items.length === 0 && <EmptyDrop />}</div></div>; })}</section></TabsContent>

      <TabsContent value="team" className="view-content team-view-complete">
        <section className="people-summary">
          <article><Target /><span><b>{(liveCounts?.ratedTasks ?? 0) + (liveCounts?.ratedProjects ?? 0)}</b> elementos puntuados</span></article>
          <article><TrendingUp /><span><b>{team.filter((person) => person.evaluations >= 8).length}</b> fichas con muestra alta</span></article>
          <article><AlertTriangle /><span><b>{team.filter((person) => person.evaluations < 3).length}</b> fichas aún frágiles</span></article>
          <div><strong>Índice de desempeño</strong><small>60% ejecución de tareas + 40% calidad de proyectos. La carga va aparte.</small></div>
        </section>
        <section className="team-layout">
          <div className="team-grid">{team.filter((person) => !q || (person.name + " " + person.role + " " + person.skills.join(" ")).toLowerCase().includes(q)).map((person) => {
            const performance = personPerformance(person);
            return <button key={person.name} className="team-card employee-card" draggable onClick={() => setSelectedPerson(person)}
              onDragStart={(event) => { event.dataTransfer.setData("text/plain", `person:${person.name}`); setDragging(`person:${person.name}`); }} onDragEnd={() => setDragging(null)}>
              <div className={`avatar avatar-${person.tone}`}>{person.initials}</div><div className="team-copy"><h2>{person.name}</h2><p>{person.role} · {person.assignment}</p></div>
              <span className={`ratio-chip ${performance.ratio == null ? "empty" : ""}`}>{performance.ratio ?? "—"}<small>/100</small></span>
              <div className="profile-metrics"><span><b>{person.activeProjects}</b> proyectos</span><span><b>{person.activeTasks}</b> tareas</span><span><b>{performance.count}</b> evaluaciones</span></div>
              <div className="load-row"><span>CARGA RELATIVA</span><b>{person.load}%</b></div><Progress value={person.load} className={person.load >= 75 ? "load-progress hot" : person.load >= 45 ? "load-progress warm" : "load-progress cool"} />
              <div className="team-footer"><span>{confidence(performance.count)}</span><span>Ver ficha <ChevronRight /></span></div>
            </button>;
          })}</div>
          <aside className="capacity-note data-health-card"><Sparkles /><span>SCHEMA HEALTH · NOTION</span><h2>{schemaState === "live" ? (schemaIssues.length ? `${schemaIssues.length} propiedades requieren atención` : "Estructura sincronizada y sana") : schemaState === "error" ? "No se pudo leer el schema en vivo" : "Comprobando la estructura real…"}</h2><ul><li><Check /> {taskStatusOptions.length} estados de tarea leídos</li><li><Check /> {projectStatusOptions.length} estados de proyecto leídos</li><li><Check /> {projectTypeOptions.length} tipos de proyecto leídos</li><li><Check /> {taskPriorityOptions.length} prioridades de tarea · {projectPriorityOptions.length} de proyecto</li>{schemaIssues.slice(0, 3).map((issue) => <li key={`${issue.source}-${issue.name}`}><AlertTriangle /> {issue.source}: falta {issue.name}</li>)}</ul><p>{schemaState === "live" ? "WorkOS usa estas opciones directamente. Los cambios de schema en Notion se detectan al cargar." : "Mientras Notion no responda, la interfaz conserva un fallback local y bloquea la falsa sensación de sincronía."}</p></aside>
        </section>
      </TabsContent>

      <TabsContent value="holidays" className="view-content"><section className="holiday-panel"><div className="holiday-head module-head"><div><span>VENTANA DE 8 SEMANAS</span><h2>Ausencias reales próximas</h2></div><div className="legend"><span><i className="holiday" /> Ausencia desde Notion</span></div></div><div className="timeline-head"><span>EQUIPO</span>{["31 AGO", "7 SEP", "14 SEP", "21 SEP", "28 SEP", "5 OCT", "12 OCT", "19 OCT"].map((date) => <b key={date}>{date}</b>)}</div>{holidayTimelineNames.map((name) => { const holiday = holidays.find((item) => item.name === name); if (!holiday) return null; const position = timelinePosition(holiday.start, holiday.end); return <div className="timeline-row" key={name}><strong>{name}</strong><div className="timeline-track"><span className="holiday-block" title={`${holiday.type} · ${holiday.label}`} style={{ left: `${position.left}%`, width: `${position.width}%`, background: holiday.color }}>{holiday.label}</span></div></div>; })}<div className="timeline-callout"><AlertTriangle /><p><strong>Ausencias sincronizadas</strong>{dataState === "live" ? `${holidays.length} registros recientes o próximos leídos directamente de Notion.` : "Sin conexión live: no se muestran ausencias antiguas como actuales."}</p><button onClick={() => setActiveView("team")}>Ver carga <ChevronRight /></button></div></section></TabsContent>
    </main>

    {selectedProjectPage && (() => {
      const projectTasks = allTasks.filter((task) => task.project === selectedProjectPage.name);
      const datedTasks = projectTasks.filter((task) => task.dateStart).sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart)));
      const completedTasks = projectTasks.filter((task) => task.status === "Terminado").length;
      const cancelledTasks = projectTasks.filter((task) => task.status === "Cancelado").length;
      const activeProjectTasks = projectTasks.filter((task) => !["Terminado", "Cancelado"].includes(task.status));
      const dateValues = datedTasks.map((task) => new Date(task.dateStart + "T00:00:00").getTime());
      const start = selectedProjectPage.timingStart
        ? new Date(selectedProjectPage.timingStart + "T00:00:00")
        : dateValues.length ? new Date(Math.min(...dateValues)) : new Date();
      let end = selectedProjectPage.timingEnd
        ? new Date(selectedProjectPage.timingEnd + "T00:00:00")
        : dateValues.length ? new Date(Math.max(...dateValues)) : addDays(start, 30);
      if (end.getTime() <= start.getTime()) end = addDays(start, 1);
      const account = accounts.find((item) => item.name === selectedProjectPage.account);
      const color = account?.color || "#ef3f43";
      const contrast = accountContrast(color);
      const completionBase = projectTasks.filter((task) => task.status !== "Cancelado").length;
      const completion = completionBase ? Math.round((completedTasks / completionBase) * 100) : 0;
      const projectPeople = selectedProjectPage.people.filter((name) => name !== "Por asignar");
      const endLabel = selectedProjectPage.timingEnd
        ? new Date(selectedProjectPage.timingEnd + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
        : "Sin fecha";
      return <div
        className="project-workspace-overlay"
        inert={Boolean(detail || evaluation)}
        aria-hidden={Boolean(detail || evaluation)}
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProjectPage(null); }}
      >
        <div
          className="project-workspace-shell"
          role="dialog"
          aria-modal="true"
          aria-label={`Proyecto ${selectedProjectPage.name}`}
          style={{ "--account-color": color, "--account-contrast": contrast } as React.CSSProperties}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="project-workspace-close"
            aria-label="Cerrar proyecto"
            title="Cerrar proyecto"
            onClick={() => setSelectedProjectPage(null)}
          ><X /></button>
          <div className="project-workspace-chrome">
          <header className="project-workspace-top" style={{ "--account-color": color, "--account-contrast": contrast } as React.CSSProperties}>
            <div className="project-workspace-title">
              <span>{selectedProjectPage.account}</span>
              <input defaultValue={selectedProjectPage.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== selectedProjectPage.name) updateProjectWorkspace({ name }); }} />
              <small>{selectedProjectPage.type} · {selectedProjectPage.status}</small>
            </div>
            <div className="project-workspace-global-actions">
              <Button variant="outline" onClick={() => startEvaluation({ kind: "project", id: selectedProjectPage.id, name: selectedProjectPage.name, people: selectedProjectPage.people })}><Star /> Cerrar y evaluar</Button>
            </div>
          </header>

          <nav className="project-workspace-tabs" aria-label="Secciones del proyecto">
            <button type="button" className="active" onClick={() => scrollProjectSection("project-summary")}>Resumen</button>
            <button type="button" onClick={() => scrollProjectSection("project-tasks")}>Tareas</button>
            <button type="button" onClick={() => scrollProjectSection("project-timeline")}>Timeline</button>
            <button type="button" onClick={() => scrollProjectSection("project-details")}>Detalles</button>
          </nav>
        </div>

        <div className="project-workspace-scroll">
          <section id="project-summary" className="project-workspace-metrics">
            <article className="project-progress-card">
              <span>PROGRESO</span>
              <div className="project-progress-visual">
                <div className="project-progress-ring" style={{ "--progress": completion } as React.CSSProperties}><strong>{completion}%</strong></div>
                <div><b>{completedTasks}</b><small>de {completionBase || projectTasks.length || 0} tareas</small><Progress value={completion} /><em>{activeProjectTasks.length ? activeProjectTasks.length + " activas" : "Todo despejado"}</em></div>
              </div>
            </article>
            <article className="project-metric-editable">
              <span>ESTADO</span>
              <select value={selectedProjectPage.status} onChange={(event) => updateProjectWorkspace({ status: event.target.value })}>{projectStatusOptions.map((status) => <option key={status}>{status}</option>)}</select>
              <small>{selectedProjectPage.timingStart ? "Desde " + new Date(selectedProjectPage.timingStart + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha de inicio"}</small>
            </article>
            <article>
              <span>FECHA DE ENTREGA</span>
              <strong className="project-date-value">{endLabel}</strong>
              <small>{selectedProjectPage.timingEnd ? "Fecha objetivo del proyecto" : "Añade una fecha de fin"}</small>
            </article>
            <article className="project-metric-editable">
              <span>PRIORIDAD</span>
              <select value={selectedProjectPage.priority} onChange={(event) => updateProjectWorkspace({ priority: event.target.value })}>{projectPriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select>
              <small>Editable directamente</small>
            </article>
            <article>
              <span>EQUIPO</span>
              <div className="project-people-stack">
                {projectPeople.slice(0, 5).map((name) => {
                  const person = team.find((item) => item.name === name);
                  return <i key={name} className={person ? "avatar avatar-" + person.tone : "avatar"} title={name}>{person?.initials || name.slice(0, 2).toUpperCase()}</i>;
                })}
                {projectPeople.length > 5 && <b>+{projectPeople.length - 5}</b>}
              </div>
              <small>{projectPeople.length} {projectPeople.length === 1 ? "persona" : "personas"}</small>
            </article>
          </section>

          <section className="project-overview-grid">
            <article id="project-details" className="project-control-panel">
              <div className="workspace-section-head module-head"><span>PROYECTO</span><h2>Detalles</h2><small>Todo editable</small></div>
              <div className="project-control-grid">
                <label><span>Estado</span><select value={selectedProjectPage.status} onChange={(event) => updateProjectWorkspace({ status: event.target.value })}>{projectStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label><span>Prioridad</span><select value={selectedProjectPage.priority} onChange={(event) => updateProjectWorkspace({ priority: event.target.value })}>{projectPriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                <label><span>Tipo</span><select value={selectedProjectPage.type} onChange={(event) => updateProjectWorkspace({ type: event.target.value })}>{projectTypeOptions.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label><span>Cuenta</span><select value={selectedProjectPage.account} onChange={(event) => updateProjectWorkspace({ account: event.target.value })}>{accounts.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
                <label><span>Inicio</span><input type="date" value={selectedProjectPage.timingStart || ""} onChange={(event) => updateProjectWorkspace({ timingStart: event.target.value || null, timingEnd: selectedProjectPage.timingEnd })} /></label>
                <label><span>Fin</span><input type="date" min={selectedProjectPage.timingStart || undefined} value={selectedProjectPage.timingEnd || ""} onChange={(event) => updateProjectWorkspace({ timingStart: selectedProjectPage.timingStart, timingEnd: event.target.value || null })} /></label>
              </div>
              <div className="workspace-team-editor">
                <span>EQUIPO</span>
                <div>{projectPeople.map((name) => {
                  const person = team.find((item) => item.name === name);
                  return <button key={name} onClick={() => { const people = selectedProjectPage.people.filter((personName) => personName !== name && personName !== "Por asignar"); updateProjectWorkspace({ people: people.length ? people : ["Por asignar"] }); }}>{person && <i className={"avatar avatar-" + person.tone}>{person.initials}</i>}<strong>{name}</strong><b>×</b></button>;
                })}</div>
                <select value="" onChange={(event) => { const name = event.target.value; if (!name) return; const current = selectedProjectPage.people.filter((person) => person !== "Por asignar"); if (!current.includes(name)) updateProjectWorkspace({ people: [...current, name] }); event.currentTarget.value = ""; }}><option value="">Añadir persona…</option>{team.filter((person) => !selectedProjectPage.people.includes(person.name)).map((person) => <option key={person.id} value={person.name}>{person.name} · {person.role}</option>)}</select>
              </div>
            </article>

            <article id="project-tasks" className="project-task-workspace">
              <div className="workspace-section-head module-head"><span>TAREAS</span><h2>Tareas del proyecto</h2><small>{projectTasks.length} en total</small></div>
              <div className="project-task-create"><input value={projectTaskName} onChange={(event) => setProjectTaskName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createTaskForSelectedProject(); }} placeholder="Nueva tarea dentro de este proyecto…" /><button onClick={createTaskForSelectedProject}><Plus /> Crear</button></div>
              <div className="project-task-table">
                {projectTasks.map((task) => <div key={task.id} className="project-task-row">
                  <button className="project-task-name" onClick={() => setDetail({ kind: "task", ...task })}><span className={"project-task-check status-" + task.status.toLowerCase().replaceAll(" ", "-")}>{task.status === "Terminado" ? <Check /> : null}</span><span><strong>{task.name}</strong><small>{task.people.filter((name) => name !== "Por asignar").join(", ") || "Sin asignar"}</small></span></button>
                  <select value={task.status} onChange={(event) => updateWorkspaceTask(task, { status: event.target.value })}>{taskStatusOptions.map((status) => <option key={status}>{status}</option>)}</select>
                  <select value={task.priority} onChange={(event) => updateWorkspaceTask(task, { priority: event.target.value })}>{taskPriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select>
                  <input type="date" value={task.dateStart || ""} onChange={(event) => { const value = event.target.value || null; const label = value ? new Date(value + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "") : "SIN FECHA"; updateWorkspaceTask(task, { dateStart: value, date: label }); }} />
                  <button onClick={() => setDetail({ kind: "task", ...task })}><ChevronRight /></button>
                </div>)}
                {projectTasks.length === 0 && <div className="workspace-empty">Este proyecto todavía no tiene tareas vinculadas.</div>}
              </div>
            </article>

            <aside className="project-side-stack">
              <article id="project-timeline" className="project-timeline-panel">
                <div className="workspace-section-head module-head"><span>TIMELINE</span><h2>Hitos y tareas</h2><small>{start.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — {end.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</small></div>
                <div className="project-timeline-scale"><span>INICIO</span><i /><span>FIN</span></div>
                <div className="project-timeline-rows">
                  {datedTasks.map((task) => {
                    const pos = timelinePercent(task.dateStart, start, end) ?? 0;
                    return <button key={task.id} className={"project-timeline-row status-" + task.status.toLowerCase().replaceAll(" ", "-")} onClick={() => setDetail({ kind: "task", ...task })}>
                      <span><strong>{task.name}</strong><small>{task.status}</small></span>
                      <i className="project-timeline-line"><b style={{ left: String(pos) + "%" }} /></i>
                      <em>{task.date}</em>
                    </button>;
                  })}
                  {datedTasks.length === 0 && <div className="workspace-empty">Añade fechas a las tareas y el timeline se irá pintando solo.</div>}
                </div>
              </article>

              <article className="project-glance-card">
                <div className="workspace-section-head module-head"><span>VISTA RÁPIDA</span><h2>Estado operativo</h2></div>
                <div className="project-glance-stats">
                  <span><b>{activeProjectTasks.length}</b><small>Activas</small></span>
                  <span><b>{completedTasks}</b><small>Terminadas</small></span>
                  <span><b>{cancelledTasks}</b><small>Canceladas</small></span>
                </div>
                <p>{completion >= 75 ? "El proyecto está en fase final. Conviene cerrar flecos, no inventar nuevas reuniones porque la humanidad ya tiene suficientes." : completion >= 35 ? "El proyecto está avanzando. El foco debería estar en desbloquear las tareas activas." : "El proyecto está arrancando. Fechas, responsables y primeras entregas mandan."}</p>
              </article>
            </aside>
          </section>
        </div>
      </div>
    </div>;
    })()}

    <Dialog open={Boolean(selectedAccount)} onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}>
      <DialogContent className="full-detail-dialog detail-sheet account-overview-sheet">{selectedAccount && (() => {
        const accountProjects = projects.filter((project) => project.account === selectedAccount.name);
        const accountTasks = tasks.filter((task) => task.account === selectedAccount.name);
        const people = Array.from(new Set([...accountProjects.flatMap((project) => project.people), ...accountTasks.flatMap((task) => task.people)].filter((name) => name !== "Por asignar")));
        const datedTasks = accountTasks.filter((task) => task.dateStart).sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart))).slice(0, 5);
        const contrast = accountContrast(selectedAccount.color);
        return <>
          <DialogHeader className="account-overview-header" style={{ "--account-color": selectedAccount.color, "--account-contrast": contrast } as React.CSSProperties}>
            <div className="account-overview-brand"><AccountMark name={selectedAccount.name} /><div><span>CUENTA</span><DialogTitle>{selectedAccount.name}</DialogTitle><DialogDescription>{selectedAccount.contract} · Prioridad {selectedAccount.priority}</DialogDescription></div></div>
          </DialogHeader>
          <div className="account-overview-body">
            <section className="account-overview-metrics">
              <article><span>PROYECTOS ACTIVOS</span><strong>{accountProjects.length}</strong></article>
              <article><span>TAREAS ACTIVAS</span><strong>{accountTasks.length}</strong></article>
              <article><span>EQUIPO IMPLICADO</span><strong>{people.length}</strong></article>
              <article><span>PULSO</span><strong>{selectedAccount.pulse}%</strong></article>
            </section>

            <section className="account-overview-section">
              <div className="account-overview-title"><span>PROYECTOS</span><button onClick={() => { setSearch(selectedAccount.name); setSelectedAccount(null); setActiveView("projects"); }}>Ver pipeline <ArrowUpRight /></button></div>
              <div className="account-overview-list">{accountProjects.slice(0, 6).map((project) => <button key={project.id} onClick={() => { setSelectedAccount(null); setSelectedProjectPage(project); }}><div><strong>{project.name}</strong><small>{project.status} · {project.type}</small></div><span>{project.timing}</span></button>)}{accountProjects.length === 0 && <p>Sin proyectos activos.</p>}</div>
            </section>

            <section className="account-overview-section">
              <div className="account-overview-title"><span>PRÓXIMAS TAREAS</span><button onClick={() => { setSearch(selectedAccount.name); setSelectedAccount(null); setActiveView("tasks"); }}>Ver tareas <ArrowUpRight /></button></div>
              <div className="account-overview-list">{datedTasks.map((task) => <button key={task.id} onClick={() => setDetail({ kind: "task", ...task })}><div><strong>{task.name}</strong><small>{task.status} · {task.project}</small></div><span>{task.date}</span></button>)}{datedTasks.length === 0 && <p>Sin tareas fechadas próximas.</p>}</div>
            </section>

            <section className="account-overview-section">
              <div className="account-overview-title"><span>EQUIPO</span></div>
              <div className="account-overview-people">{people.map((name) => { const person = team.find((item) => item.name === name); return <span key={name}>{person ? <i className={`avatar avatar-${person.tone}`}>{person.initials}</i> : null}<b>{name}</b></span>; })}{people.length === 0 && <p>Sin equipo asignado.</p>}</div>
            </section>
          </div>
        </>;
      })()}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
      <DialogContent onEscapeKeyDown={(event) => event.stopPropagation()} className="full-detail-dialog detail-sheet">{detail && <>
        <DialogHeader>
          <span className="sheet-kicker">{detail.kind === "task" ? "EDITAR TAREA" : "EDITAR PROYECTO"}</span>
          <DialogTitle>{detail.name}</DialogTitle>
          <DialogDescription>Consulta el contenido y edita los datos desde aquí.</DialogDescription>
        </DialogHeader>
        <div className="sheet-body detail-editor detail-workspace-body">
          <div className="detail-properties-editor">
          <label className="editor-field full"><span>Nombre</span><input value={detail.name} onChange={(event) => updateDetailField("name", event.target.value)} /></label>
          <div className="editor-grid">
            <div className="editor-field"><span>Estado</span><Select value={detail.status} onValueChange={(value) => updateDetailField("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(detail.kind === "task" ? taskStatusOptions : projectStatusOptions).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div className="editor-field"><span>Prioridad</span><Select value={detail.priority} onValueChange={(value) => updateDetailField("priority", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(detail.kind === "task" ? taskPriorityOptions : projectPriorityOptions).map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="editor-field"><span>Cuenta</span><Select value={detail.account} onValueChange={(value) => updateDetailField("account", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.name} value={account.name}>{account.name}</SelectItem>)}</SelectContent></Select></div>
          {detail.kind === "task"
  ? <label className="editor-field"><span>Proyecto</span><Select value={detail.project} onValueChange={(value) => updateDetailField("project", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select></label>
  : <div className="editor-field"><span>Tipo</span><Select value={detail.type} onValueChange={(value) => updateDetailField("type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projectTypeOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>}
          {detail.kind === "task"
            ? <div className="editor-field full task-schedule-editor">
                <div className="task-schedule-head"><span>Planificación</span><label className="task-all-day-toggle"><span>Todo el día</span><Switch checked={taskIsAllDay(detail)} onCheckedChange={(checked) => {
                  const day = dateOnly(detail.dateStart) || new Date().toISOString().slice(0, 10);
                  updateDetailField("dateStart", checked ? day : localPlannerIso(day, 9 * 60));
                  updateDetailField("dateEnd", checked ? null : localPlannerIso(day, 10 * 60));
                  updateDetailField("date", new Date(day + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", ""));
                }} /></label></div>
                <div className="task-schedule-grid">
                  <label><small>Fecha</small><input type="date" value={dateOnly(detail.dateStart) || ""} onChange={(event) => {
                    const day = event.target.value;
                    if (!day) { updateDetailField("dateStart", null); updateDetailField("dateEnd", null); updateDetailField("date", "SIN FECHA"); return; }
                    if (taskIsAllDay(detail)) updateDetailField("dateStart", day);
                    else {
                      updateDetailField("dateStart", localPlannerIso(day, plannerMinutes(detail.dateStart, 9 * 60)));
                      updateDetailField("dateEnd", localPlannerIso(day, plannerMinutes(detail.dateEnd, 10 * 60)));
                    }
                    updateDetailField("date", new Date(day + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", ""));
                  }} /></label>
                  {!taskIsAllDay(detail) && <>
                    <label><small>Inicio</small><input type="time" step="900" value={plannerTimeLabel(plannerMinutes(detail.dateStart, 9 * 60))} onChange={(event) => {
                      const day = dateOnly(detail.dateStart) || new Date().toISOString().slice(0, 10);
                      const [h,m] = event.target.value.split(":").map(Number);
                      updateDetailField("dateStart", localPlannerIso(day, h * 60 + m));
                    }} /></label>
                    <label><small>Fin</small><input type="time" step="900" value={plannerTimeLabel(plannerMinutes(detail.dateEnd, 10 * 60))} onChange={(event) => {
                      const day = dateOnly(detail.dateStart) || new Date().toISOString().slice(0, 10);
                      const [h,m] = event.target.value.split(":").map(Number);
                      updateDetailField("dateEnd", localPlannerIso(day, h * 60 + m));
                    }} /></label>
                  </>}
                </div>
              </div>
            : <div className="editor-field full"><span>Timing</span><div className="date-range-fields"><label><small>Inicio</small><input type="date" value={detail.timingStart || ""} onChange={(event) => updateDetailField("timingStart", event.target.value || null)} /></label><label><small>Fin</small><input type="date" min={detail.timingStart || undefined} value={detail.timingEnd || ""} onChange={(event) => updateDetailField("timingEnd", event.target.value || null)} /></label></div></div>}
          <div className="editor-field full"><span>Equipo</span><div className="team-chip-editor"><div className="team-selected-chips">{detail.people.filter((name) => name !== "Por asignar").map((name) => { const person = team.find((item) => item.name === name); return <span key={name} className="team-person-chip">{person && <i className={`avatar avatar-${person.tone}`}>{person.initials}</i>}<b>{name}</b><button type="button" aria-label={`Quitar a ${name}`} onClick={() => { const nextPeople = detail.people.filter((personName) => personName !== name && personName !== "Por asignar"); updateDetailField("people", nextPeople.length ? nextPeople : ["Por asignar"]); }}>×</button></span>; })}{detail.people.filter((name) => name !== "Por asignar").length === 0 && <small className="team-empty-selection">Sin equipo asignado</small>}</div><select value="" onChange={(event) => { const name = event.target.value; if (!name) return; const current = detail.people.filter((personName) => personName !== "Por asignar"); if (!current.includes(name)) updateDetailField("people", [...current, name]); event.currentTarget.value = ""; }}><option value="">Añadir persona…</option>{team.filter((person) => !detail.people.includes(person.name)).map((person) => <option key={person.id} value={person.name}>{person.name} · {person.role}</option>)}</select></div></div>
          <div className="sheet-note"><Sparkles /><p><strong>Lectura rápida</strong>{detail.priority === "Alta" ? "Está en zona de atención. Revisa fecha y responsables antes de cerrar." : "Parece controlado. No le añadamos épica administrativa."}</p></div>
          </div>
          <PageContent key={detail.id} pageId={detail.id} />
        </div>
        <div className="sheet-actions sheet-actions-stacked"><Button className="close-evaluate-button" onClick={() => startEvaluation({ kind: detail.kind, id: detail.id, name: detail.name, people: detail.people })}><Star /> Cerrar y evaluar</Button><div><Button onClick={saveDetail} className="notion-button"><Save /> Guardar cambios</Button></div></div>
      </>}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedPerson)} onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}>
      <DialogContent className="full-detail-dialog detail-sheet employee-sheet">{selectedPerson && (() => {
        const performance = personPerformance(selectedPerson);
        const maxDistribution = Math.max(1, ...Object.values(selectedPerson.distribution));
        const sessionSignals = signalBoosts[selectedPerson.name];
        const sessionDimensions = dimensionBoosts[selectedPerson.name] ?? {};
        return <>
          <DialogHeader>
            <span className="sheet-kicker">FICHA DE EMPLEADO · DATOS REALES</span>
            <div className="employee-hero"><div className={`avatar avatar-${selectedPerson.tone}`}>{selectedPerson.initials}</div><div><DialogTitle>{selectedPerson.name}</DialogTitle><DialogDescription>{selectedPerson.role} · {selectedPerson.assignment}</DialogDescription>{selectedPerson.activeProjectNames.length > 0 && <div className="employee-projects-inline">{selectedPerson.activeProjectNames.map((project) => <span key={project}>{project}</span>)}</div>}</div><span className="employee-tier">{selectedPerson.tier ?? "—"}</span></div>
          </DialogHeader>
          <div className="sheet-body employee-body">
            <section className="employee-kpis">
              <article><span>ÍNDICE</span><strong>{performance.ratio ?? "—"}<small>/100</small></strong><p>{confidence(performance.count)}</p></article>
              <article><span>TAREAS</span><strong>{oneDecimal(selectedPerson.taskScore)}<small>/5</small></strong><p>Ejecución</p></article>
              <article><span>PROYECTOS</span><strong>{oneDecimal(selectedPerson.projectScore)}<small>/5</small></strong><p>Calidad final</p></article>
              <article><span>EVIDENCIA</span><strong>{selectedPerson.evidence}</strong><p>{selectedPerson.evaluations ? `${selectedPerson.evaluations} detalladas` : "Ratings históricos"}</p></article>
            </section>
            <section className="employee-section"><div className="employee-section-title"><CircleGauge /><div><span>TRABAJO ACTIVO</span><h3>Carga, sin mezclarla con desempeño</h3></div></div><div className="workload-big"><strong>{selectedPerson.load}%</strong><div><Progress value={selectedPerson.load} className={selectedPerson.load >= 75 ? "load-progress hot" : selectedPerson.load >= 45 ? "load-progress warm" : "load-progress cool"} /><span>{selectedPerson.activeProjects} proyectos · {selectedPerson.activeTasks} tareas activas</span></div></div>{selectedPerson.activeProjectNames.length > 0 && <div className="active-project-list"><span>PROYECTOS ACTIVOS</span>{selectedPerson.activeProjectNames.map((project) => <b key={project}>{project}</b>)}</div>}</section>
            <section className="employee-section"><div className="employee-section-title"><TrendingUp /><div><span>HISTÓRICO</span><h3>Distribución de puntuaciones</h3></div></div><div className="rating-distribution">{[5, 4, 3, 2, 1].map((rating) => { const count = selectedPerson.distribution[String(rating) as keyof typeof selectedPerson.distribution] ?? 0; return <div key={rating}><span>{rating}<Star /></span><i><b style={{ width: (count / maxDistribution) * 100 + "%" }} /></i><strong>{count}</strong></div>; })}</div><p className="history-caption">{selectedPerson.completedTasks} tareas y {selectedPerson.completedProjects} proyectos completados vinculados.</p></section>
            <section className="employee-section"><div className="employee-section-title"><Target /><div><span>RÚBRICA</span><h3>Calidad, timing, colaboración y criterio</h3></div></div><div className="dimension-profile">{(Object.keys(dimensionLabels) as DimensionKey[]).map((key) => { const session = sessionDimensions[key]; const stored = selectedPerson.dimensions[key]; const value = session?.count ? session.sum / session.count : stored; return <div key={key}><span>{dimensionLabels[key].label}<small>{dimensionLabels[key].hint}</small></span><i><b style={{ width: value ? `${value * 20}%` : "0%" }} /></i><strong>{oneDecimal(value)}</strong></div>; })}</div><p className="history-caption">Notion ya tiene estas dimensiones preparadas. Empezarán a formar histórico con los nuevos cierres detallados.</p></section>
            <section className="employee-section"><div className="employee-section-title"><Sparkles /><div><span>PERFIL</span><h3>Fortalezas y focos de desarrollo</h3></div></div><div className="skill-columns"><div><span>SKILLS</span><div className="tag-cloud">{selectedPerson.skills.length ? selectedPerson.skills.map((skill) => <b key={skill}>{skill}</b>) : <small>Sin datos</small>}</div></div><div><span>DESARROLLO</span><div className="tag-cloud growth">{selectedPerson.growth.length ? selectedPerson.growth.map((skill) => <b key={skill}>{skill}</b>) : <small>Sin señales registradas</small>}</div></div></div>{sessionSignals && <div className="session-signals"><span>SEÑALES DE ESTA SESIÓN</span><div className="tag-cloud">{Object.entries(sessionSignals.positive).map(([signal, count]) => <b key={signal}>+ {signal} · {count}</b>)}{Object.entries(sessionSignals.negative).map(([signal, count]) => <b className="negative" key={signal}>− {signal} · {count}</b>)}</div></div>}</section>
            <section className="employee-section data-gaps"><div className="employee-section-title"><AlertTriangle /><div><span>CALIDAD DE DATOS</span><h3>Qué falta para una Career Conversation sólida</h3></div></div><ul><li>Esfuerzo u horas por tarea</li><li>Autor y fecha de cada evaluación</li><li>Rol individual dentro del proyecto</li><li>Feedback textual estructurado</li>{!selectedPerson.joined && <li>Fecha de incorporación</li>}</ul></section>
          </div>
        </>;
      })()}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(evaluation)} onOpenChange={(open) => { if (!open) resetEvaluation(); }}>
      <DialogContent onEscapeKeyDown={(event) => event.stopPropagation()} className={`evaluation-dialog ${selectedProjectPage ? "project-evaluation-dialog" : ""}`}>{evaluation && <>
        <DialogHeader><span className="sheet-kicker">{evaluation.kind === "task" ? "CIERRE DE TAREA" : "CIERRE DE PROYECTO"}</span><DialogTitle>{evaluation.name}</DialogTitle><DialogDescription>Una nota obligatoria. Si quieres profundidad, activas la rúbrica. Sin comité de evaluación ni velas negras.</DialogDescription></DialogHeader>
        <div className="evaluation-body">
          <section className="score-question"><span>¿Qué tal quedó?</span><StarPicker value={score} onChange={setScore} /><strong>{score ? score + "/5" : "Sin puntuar"}</strong></section>
          <section className="detail-toggle"><div><strong>Evaluación detallada</strong><small>Añade cuatro dimensiones y mejora la ficha del empleado.</small></div><Switch checked={detailedMode} onCheckedChange={setDetailedMode} /></section>
          {detailedMode && <section className="dimension-rubric">{((evaluation.kind === "task" ? ["quality", "timing", "collaboration", "autonomy"] : ["quality", "timing", "collaboration", "impact"]) as DimensionKey[]).map((key) => <div key={key}><span><strong>{dimensionLabels[key].label}</strong><small>{dimensionLabels[key].hint}</small></span><StarPicker compact value={dimensionScores[key] ?? 0} onChange={(value) => setDimensionScores((scores) => ({ ...scores, [key]: value }))} /></div>)}</section>}
          <section><div className="evaluation-label"><span>¿Qué funcionó?</span><small>Opcional · elige señales</small></div><div className="signal-picker signal-good">{positiveSignals.map((signal) => <button type="button" key={signal} className={strengths.includes(signal) ? "active" : ""} onClick={() => toggleSignal(signal, strengths, setStrengths)}>{strengths.includes(signal) && <Check />}{signal}</button>)}</div></section>
          <section><div className="evaluation-label"><span>¿Dónde hubo fricción?</span><small>Opcional</small></div><div className="signal-picker signal-bad">{frictionSignals.map((signal) => <button type="button" key={signal} className={frictions.includes(signal) ? "active" : ""} onClick={() => toggleSignal(signal, frictions, setFrictions)}>{frictions.includes(signal) && <Check />}{signal}</button>)}</div></section>
          <section className="people-impact"><div className="evaluation-label"><span>Afecta a {evaluation.people.length} perfil{evaluation.people.length === 1 ? "" : "es"}</span><label><small>Afinar por persona</small><Switch checked={individualMode} onCheckedChange={setIndividualMode} disabled={evaluation.people.length < 2} /></label></div><div className="impact-people">{evaluation.people.length ? evaluation.people.map((name) => <div key={name}><span>{initials(name)}</span><strong>{name}</strong>{individualMode ? <StarPicker compact value={individualScores[name] ?? 0} onChange={(value) => setIndividualScores((scores) => ({ ...scores, [name]: value }))} /> : <small>{score ? score + "/5" : "—"}</small>}</div>) : <p><AlertTriangle /> Sin equipo asignado: se guarda la calidad, pero no afecta a ratios.</p>}</div></section>
          <label className="evaluation-note"><span>Nota privada <small>Opcional</small></span><Textarea value={evaluationNote} onChange={(event) => setEvaluationNote(event.target.value)} placeholder="Contexto útil para la próxima Career Conversation…" /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={resetEvaluation}>Cancelar</Button><Button className="close-evaluate-button" disabled={!score} onClick={submitEvaluation}><Check /> Cerrar y guardar</Button></DialogFooter>
      </>}</DialogContent>
    </Dialog>
    {dragVisual && <div className="physical-drag-preview" style={{ left: dragVisual.x, top: dragVisual.y }} aria-hidden="true">
      <div className="physical-drag-grip"><GripVertical /></div>
      <div className="physical-drag-copy"><strong>{dragVisual.title}</strong><small>{dragVisual.meta}</small></div>
      <span className="physical-drag-glint" />
    </div>}
    <Toaster position="bottom-right" />
  </Tabs>;
}
