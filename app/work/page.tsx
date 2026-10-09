"use client";

import { localDateKey } from "@/app/lib/local-date";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight,
  CalendarRange, ChevronLeft, CircleGauge, Clock3, FolderKanban, GripVertical,
  Check, LayoutDashboard, ListTodo, NotebookPen, Plus, Save, Sparkles, Star,
  Target, Trash2, TrendingUp, Users, Settings2, X, Play, Pause, RotateCcw, Mail, Banknote, Palmtree, Activity,
} from "lucide-react";
import { toast } from "sonner";

import { ModeLogo } from "@/components/os/mode-logo";
import { PageContent } from "@/components/workos/page-content";
import { Timesheet } from "@/components/workos/timesheet";
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

type View = "dashboard" | "week" | "imputation" | "timeline" | "calendar" | "accounts" | "projects" | "tasks" | "team" | "holidays";
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

type TaskLane = "En progreso" | "Pausa" | "Pendiente" | "Backlog" | "Terminado" | "Cancelado";
type Task = {
  id: string; name: string; status: TaskStatus; priority: Priority; project: string;
  account: string; date: string; dateStart?: string | null; dateEnd?: string | null; people: string[]; url: string;
  workosLane?: TaskLane | null;
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
  time?: string | null; status?: string | null;
};
type Account = {
  id?: string; name: string; status?: string; priority: Priority; contract: string; assignedPeople?: string[];
  color: string; projects: number; tasks?: number; activity?: number; pulse: number; url: string;
};
type TeamPerson = {
  id: string; url: string; name: string; role: string; assignment: string; contract: string | null; tier: string | null;
  email: string | null; salary: number | null; vacationRemaining: number | null;
  leaveAllowance?: { base: number | null; convenio: number | null; puentes: number | null; semanaSanta: number | null; navidad: number | null };
  leaveUsage?: { usedVacationDays: number; remainingVacationDays: number | null };
  skills: string[]; growth: string[]; joined: string | null; initials: string; tone: string;
  load: number; activeTasks: number; activeProjects: number; projects: number;
  activeProjectNames: string[]; activeTaskNames: string[];
  completedTasks: number; completedProjects: number; score: number | null;
  taskScore: number | null; projectScore: number | null; evaluations: number;
  evaluationHistory: Array<{
    id: string; type: string; date: string | null; score: number | null; taskName: string | null; projectName: string | null;
    quality: number | null; timing: number | null; collaboration: number | null; autonomy: number | null; impact: number | null;
  }>;
  evidence: number; ratedTasks: number; ratedProjects: number; ratio: number | null;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  dimensions: Record<DimensionKey, number | null>;
};
type Holiday = {
  id?: string; name: string; type: string; segment?: "Persona" | "Festivo" | string; category?: "Vacaciones" | "Extra" | "Turno especial" | "Festivo" | "Otra" | string;
  year?: string | null; start: string; end: string; label: string; color: string; url: string;
};
type LiveState = {
  source: "notion"; loadedAt: string;
  counts: {
    accounts: number; projects: number; activeProjects: number; tasks: number; activeTasks: number;
    team: number; holidays: number; evaluations: number; ratedTasks?: number; ratedProjects?: number;
  };
  accounts: Account[]; projects: Project[]; tasks: Task[]; allTasks: Task[]; team: TeamPerson[]; holidays: Holiday[];
  imputationProjects?: Project[]; imputationHolidays?: Holiday[];
};

const initialProjects: Project[] = [];
const initialTasks: Task[] = [];
const fallbackAccounts: Account[] = [];
const fallbackTeam: TeamPerson[] = [];
const fallbackHolidays: Holiday[] = [];

const navigation = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "week", label: "Mi semana", icon: CalendarDays },
  { value: "imputation", label: "Imputación", icon: Clock3 },
  { value: "calendar", label: "Calendario", icon: CalendarRange },
  { value: "accounts", label: "Cuentas", icon: BriefcaseBusiness },
  { value: "projects", label: "Proyectos", icon: FolderKanban },
  { value: "tasks", label: "Tareas", icon: ListTodo },
  { value: "team", label: "Equipo", icon: Users },
  { value: "timeline", label: "Timeline", icon: TrendingUp },
  { value: "holidays", label: "Vacaciones", icon: CalendarDays },
] as const;

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "HOY · NOTION LIVE", title: "Todo bajo control. Más o menos.", description: "El pulso real de cuentas, equipo y fechas sin bucear por seis bases de datos." },
  week: { eyebrow: "FOCO · ESTA SEMANA", title: "Mi semana", description: "Entregas, hitos, ausencias y carga crítica. Lo que merece atención antes de que sea tarde." },
  imputation: { eyebrow: "DEDICACIÓN SEMANAL", title: "Imputación", description: "Horas por cuenta y oficina." },
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
function plannerPriorityClass(priority: Priority) {
  if (priority === "Urgente" || priority === "Alta") return "planner-priority-high";
  if (priority === "Media") return "planner-priority-mid";
  if (priority === "Baja") return "planner-priority-low";
  return "planner-priority-none";
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
function ratioColor(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "#dfe4dd";
  const clamped = Math.max(0, Math.min(100, value));
  const hue = Math.round((clamped / 100) * 120);
  return `hsl(${hue} 78% 52%)`;
}
function currencyEUR(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
}
function shortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}).replace(".","");
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
  return localDateKey(date);
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
const PLANNER_START = 7 * 60;
const PLANNER_END = 22 * 60;
const PLANNER_DEFAULT_START = 9 * 60;
const PLANNER_HOUR_PX = 64;
const PLANNER_HOURS = (PLANNER_END - PLANNER_START) / 60;
const PLANNER_HEIGHT = PLANNER_HOURS * PLANNER_HOUR_PX;
const TASK_LANES: TaskLane[] = ["En progreso", "Pausa", "Pendiente", "Backlog", "Terminado", "Cancelado"];
const DASHBOARD_TASK_LANES: TaskLane[] = ["En progreso", "Pausa", "Pendiente"];
function taskLane(task: Pick<Task, "status" | "workosLane">): TaskLane {
  if (task.status === "Terminado" || task.status === "Cancelado") return task.status;
  if (task.workosLane === "Backlog") return "Backlog";
  if (task.status === "En progreso" || task.status === "Pausa" || task.status === "Pendiente") return task.status;
  // Compatibilidad con los estados auxiliares antiguos de WorkOS. Ya no son fuente de verdad.
  if (task.workosLane === "En progreso") return "En progreso";
  if ((task.workosLane as string | null | undefined) === "En espera") return "Pausa";
  if ((task.workosLane as string | null | undefined) === "Por hacer") return "Pendiente";
  return "Pendiente";
}
function notionStatusForLane(lane: TaskLane): TaskStatus {
  return lane === "Backlog" ? "Pendiente" : lane;
}
function workosLaneForLane(lane: TaskLane): TaskLane | null {
  return lane === "Backlog" ? "Backlog" : null;
}
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

export default function WorkPage() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view && navigation.some(item => item.value === view)) setActiveView(view as View);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("os.recent.work", JSON.stringify({app:"work",title: viewCopy[activeView].title,subtitle:"Work · "+navigation.find(item=>item.value===activeView)?.label,href:"/work?view="+activeView,at:Date.now()}));
    } catch {}
  }, [activeView]);
  const [sessionName, setSessionName] = useState("Jorge");
  const [sessionInitials, setSessionInitials] = useState("JC");
  const displaySessionName = sessionName;
  const displaySessionInitials = sessionInitials;
  const visibleNavigation = navigation;
  const weekPlannerScrollRef = useRef<HTMLDivElement | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [allTasks, setAllTasks] = useState<Task[]>(initialTasks);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [accounts, setAccounts] = useState<Account[]>(fallbackAccounts);
  const [accountOptions, setAccountOptions] = useState<Account[]>([]);
  const [team, setTeam] = useState<TeamPerson[]>(fallbackTeam);
  const [holidays, setHolidays] = useState<Holiday[]>(fallbackHolidays);
  const [imputationProjects, setImputationProjects] = useState<Project[]>(initialProjects);
  const [imputationHolidays, setImputationHolidays] = useState<Holiday[]>(fallbackHolidays);
  const [holidayFilter, setHolidayFilter] = useState<"Todas" | "Vacaciones" | "Extras" | "Semana Santa" | "Navidad">("Todas");
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteReady, setQuickNoteReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json() as Promise<{ name: string; initials?: string }>;
      })
      .then((session) => {
        if (!active) return;
        setSessionName(session.name);
        if (session.initials) setSessionInitials(session.initials);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const key = `workos.quicknote.v1.${displaySessionName.toLowerCase().replace(/\s+/g, "-")}`;
    try {
      setQuickNote(window.localStorage.getItem(key) || "");
    } catch {
      setQuickNote("");
    }
    setQuickNoteReady(true);
  }, [displaySessionName]);

  useEffect(() => {
    if (!quickNoteReady) return;
    const key = `workos.quicknote.v1.${displaySessionName.toLowerCase().replace(/\s+/g, "-")}`;
    try {
      if (quickNote) window.localStorage.setItem(key, quickNote);
      else window.localStorage.removeItem(key);
    } catch {}
  }, [quickNote, quickNoteReady, displaySessionName]);

  useEffect(() => {
    if (activeView !== "week") return;
    const frame = requestAnimationFrame(() => {
      if (weekPlannerScrollRef.current) {
        weekPlannerScrollRef.current.scrollTop = ((PLANNER_DEFAULT_START - PLANNER_START) / 60) * PLANNER_HOUR_PX;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView]);
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
  const [mobileAgendaIndex, setMobileAgendaIndex] = useState(2);
  const [mobileWorkMode, setMobileWorkMode] = useState<"tasks" | "projects">("tasks");
  const [mobileTaskLane, setMobileTaskLane] = useState<TaskLane>("En progreso");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    const currentIndex = calendarMonths.findIndex((month) => month.year === now.getFullYear() && monthIndexByCode[month.short] === now.getMonth() - 7);
    return currentIndex >= 0 ? currentIndex : Math.max(0, calendarMonths.length - 1);
  });
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [calendarTaskDate, setCalendarTaskDate] = useState<string | null>(null);
  const [calendarTaskName, setCalendarTaskName] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<TeamPerson | null>(null);
  const [teamRoleFilter, setTeamRoleFilter] = useState<"all" | "art" | "copy">("all");
  const [teamSort, setTeamSort] = useState<"activity" | "load" | "ratio" | "evidence">("activity");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountDraft, setAccountDraft] = useState<{ name: string; status: string; priority: string; contract: string; assignedPeople: string[] } | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountEditing, setAccountEditing] = useState(false);
  const [accountTaskFilter, setAccountTaskFilter] = useState<TaskLane | "all">("all");
  const [accountProjectFilter, setAccountProjectFilter] = useState<string | "all">("all");
  const [selectedProjectPage, setSelectedProjectPage] = useState<Project | null>(null);
  const [timelineWeeks, setTimelineWeeks] = useState(8);
  const [weekOffset, setWeekOffset] = useState(0);
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
    setAccountEditing(false);
    setAccountDraft(selectedAccount ? { name: selectedAccount.name, status: selectedAccount.status || "Inactiva", priority: selectedAccount.priority, contract: selectedAccount.contract, assignedPeople: selectedAccount.assignedPeople || [] } : null);
    setAccountTaskFilter("all");
    setAccountProjectFilter("all");
  }, [selectedAccount?.name]);

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
        setAccountOptions([...state.accounts].sort((a, b) => a.name.localeCompare(b.name, "es")));
        setAccounts(state.accounts.filter((account) => account.status === "Activa"));
        setProjects(state.projects);
        const hydratedTasks = state.allTasks || state.tasks;
        setTasks(hydratedTasks);
        setAllTasks(hydratedTasks);
        setTeam(state.team);
        setHolidays(state.holidays);
        setImputationProjects(state.imputationProjects || state.projects);
        setImputationHolidays(state.imputationHolidays || state.holidays);
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
  const taskBoardLanes = TASK_LANES;
  const dashboardTaskLanes = DASHBOARD_TASK_LANES;
  const desiredProjectBoardOrder = ["Standby", "Brief", "Ideas", "Pre-Producción", "Producción", "Seguimiento"];
  const projectBoardStatuses = desiredProjectBoardOrder.filter((status) => projectStatusOptions.includes(status));
  const schemaChecks = liveSchema
    ? Object.entries(liveSchema.health).flatMap(([source, checks]) => checks.map((check) => ({ ...check, source })))
    : [];
  const schemaIssues = schemaChecks.filter((check) => !check.ok);
  const currentOperationalWeekStart = useMemo(() => mondayForOperationalWeek(), []);
  const operationalWeekStart = useMemo(() => addDays(currentOperationalWeekStart, weekOffset * 7), [currentOperationalWeekStart, weekOffset]);
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

    const now = new Date();
    const todayPlannerDay = operationalWeekDays.find((day) =>
      day.getFullYear() === now.getFullYear() &&
      day.getMonth() === now.getMonth() &&
      day.getDate() === now.getDate()
    );
    const todayKey = todayPlannerDay ? isoDate(todayPlannerDay) : isoDate(now);
    const todayTasks = allTasks.filter((task) => !taskIsAllDay(task) && dateOnly(task.dateStart) === todayKey);
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
      todayPercent: Math.min(100, Math.round((todayMinutes / (8 * 60)) * 100)),
    };
  }, [weeklyTasks, operationalWeekDays, allTasks]);


  const globalTimelineStart = currentOperationalWeekStart;
  const globalTimelineEnd = useMemo(() => addDays(globalTimelineStart, timelineWeeks * 7), [globalTimelineStart, timelineWeeks]);

  const timelineInsights = useMemo(() => {
    const windowStart = globalTimelineStart.getTime();
    const windowEnd = globalTimelineEnd.getTime();

    const visibleProjects = projects.filter((project) => {
      const start = project.timingStart ? new Date(project.timingStart + "T00:00:00").getTime() : NaN;
      const end = project.timingEnd ? new Date(project.timingEnd + "T23:59:59").getTime() : start;
      return Number.isFinite(start) && end >= windowStart && start <= windowEnd;
    });

    const visibleTasks = allTasks
      .filter((task) => task.dateStart)
      .map((task) => ({ task, time: new Date(task.dateStart!).getTime() }))
      .filter(({ time }) => Number.isFinite(time) && time >= windowStart && time <= windowEnd)
      .sort((a, b) => a.time - b.time);

    const density = Array.from({ length: timelineWeeks }, (_, week) => {
      const start = addDays(globalTimelineStart, week * 7).getTime();
      const end = addDays(globalTimelineStart, (week + 1) * 7).getTime();
      const taskWeight = visibleTasks.filter(({ time }) => time >= start && time < end).length;
      const projectWeight = visibleProjects.filter((project) => {
        const pStart = project.timingStart ? new Date(project.timingStart + "T00:00:00").getTime() : NaN;
        const pEnd = project.timingEnd ? new Date(project.timingEnd + "T23:59:59").getTime() : pStart;
        return Number.isFinite(pStart) && pEnd >= start && pStart < end;
      }).length;
      return taskWeight * 2 + projectWeight;
    });

    const maxDensity = Math.max(1, ...density);
    const peakIndex = density.indexOf(Math.max(...density));
    const peakStart = addDays(globalTimelineStart, Math.max(0, peakIndex) * 7);
    const peakEnd = addDays(peakStart, 6);

    const missingEnd = visibleProjects.filter((project) => project.timingStart && !project.timingEnd).length;
    const nextMilestones = visibleTasks.slice(0, 3);

    const overlaps = visibleProjects.reduce((count, project, index) => {
      const start = project.timingStart ? new Date(project.timingStart + "T00:00:00").getTime() : NaN;
      const end = project.timingEnd ? new Date(project.timingEnd + "T23:59:59").getTime() : start;
      if (!Number.isFinite(start)) return count;
      const hasOverlap = visibleProjects.slice(index + 1).some((other) => {
        if (other.account !== project.account) return false;
        const otherStart = other.timingStart ? new Date(other.timingStart + "T00:00:00").getTime() : NaN;
        const otherEnd = other.timingEnd ? new Date(other.timingEnd + "T23:59:59").getTime() : otherStart;
        return Number.isFinite(otherStart) && start <= otherEnd && otherStart <= end;
      });
      return count + (hasOverlap ? 1 : 0);
    }, 0);

    return { visibleProjects, visibleTasks, density, maxDensity, peakStart, peakEnd, missingEnd, nextMilestones, overlaps };
  }, [projects, allTasks, globalTimelineStart, globalTimelineEnd, timelineWeeks]);

  const dashboardTasks = useMemo(() => tasks.filter((task) => DASHBOARD_TASK_LANES.includes(taskLane(task))), [tasks]);
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return dashboardTasks
      .filter((task) => task.dateStart && new Date(task.dateStart).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.dateStart || 0).getTime() - new Date(b.dateStart || 0).getTime())
      .slice(0, 3);
  }, [dashboardTasks]);
  const accountViewStats = useMemo(() => {
    const now = Date.now();
    const accountSource = accountOptions.length ? accountOptions : accounts;
    const items = accountSource.map((account) => {
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
    const activeItems = items.filter((item) => item.status === "Activa");
    const totalProjects = activeItems.reduce((sum,item) => sum + item.activeProjects,0);
    const totalTasks = activeItems.reduce((sum,item) => sum + item.activeTasks,0);
    const highPriority = activeItems.filter((item) => item.priority.trim().toLocaleLowerCase("es") === "alta").length;
    const moving = [...activeItems].sort((a,b) => b.activityScore - a.activityScore).slice(0,3);
    return { items, activeItems, totalProjects, totalTasks, highPriority, moving };
  }, [accountOptions, accounts, projects, allTasks]);

  const taskViewStats = useMemo(() => {
    const now = Date.now();
    const fortyEightHours = now + 48 * 60 * 60 * 1000;
    const all = tasks;
    const active = all.filter((task) => DASHBOARD_TASK_LANES.includes(taskLane(task)));
    const laneCounts = Object.fromEntries(TASK_LANES.map((lane) => [lane, all.filter((task) => taskLane(task) === lane).length])) as Record<TaskLane, number>;
    const attention = [...active]
      .sort((a,b) => {
        const aScore = (a.priority === "Alta" ? 10000000000000 : 0) + (a.dateStart ? -new Date(a.dateStart).getTime() : 0);
        const bScore = (b.priority === "Alta" ? 10000000000000 : 0) + (b.dateStart ? -new Date(b.dateStart).getTime() : 0);
        return bScore - aScore;
      })
      .slice(0,3);
    const next48 = active
      .filter((task) => task.dateStart && new Date(task.dateStart).getTime() >= now && new Date(task.dateStart).getTime() <= fortyEightHours)
      .sort((a,b) => new Date(a.dateStart || 0).getTime() - new Date(b.dateStart || 0).getTime());
    const visualTasks = active
      .sort((a,b) => {
        if (a.dateStart && b.dateStart) return new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime();
        if (a.dateStart) return -1;
        if (b.dateStart) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0,3);
    return { all, active, laneCounts, attention, next48, visualTasks };
  }, [tasks]);

  const mobileAgendaDay = operationalWeekDays[Math.min(mobileAgendaIndex, operationalWeekDays.length - 1)] ?? operationalWeekStart;
  const mobileAgendaKey = isoDate(mobileAgendaDay);
  const mobileAgendaTasks = weeklyTasks
    .filter((task) => dateOnly(task.dateStart) === mobileAgendaKey)
    .sort((a,b) => plannerMinutes(a.dateStart) - plannerMinutes(b.dateStart));
  const mobileAgendaMilestones = weeklyProjectMilestones.filter((event) => event.date === mobileAgendaKey);
  const mobileAgendaHolidays = weeklyHolidays.filter((holiday) => holiday.start <= mobileAgendaKey && holiday.end >= mobileAgendaKey);

  const teamViewStats = useMemo(() => {
    const highLoad = team.filter((person) => person.load >= 75);
    const available = team.filter((person) => person.load <= 24);
    const enoughEvidence = team.filter((person) => person.evidence >= 8);
    const fragile = team.filter((person) => person.evidence < 3);
    const activity = (person: TeamPerson) => person.activeProjects * 3 + person.activeTasks;
    const spotlight = [...team].sort((a,b) => (b.load * 2 + activity(b) * 8 + (b.evidence < 3 ? 18 : 0)) - (a.load * 2 + activity(a) * 8 + (a.evidence < 3 ? 18 : 0))).slice(0,3);
    const capacity = [...team].sort((a,b) => a.load - b.load || activity(b) - activity(a)).slice(0,3);
    const highestLoad = [...team].sort((a,b) => b.load - a.load).slice(0,2);
    const lowestEvidence = [...team].sort((a,b) => a.evidence - b.evidence || activity(b) - activity(a)).slice(0,2);
    return { highLoad, available, enoughEvidence, fragile, spotlight, capacity, highestLoad, lowestEvidence };
  }, [team]);

  const projectViewStats = useMemo(() => {
    const now = Date.now();
    const active = projects.filter((project) => desiredProjectBoardOrder.includes(project.status));
    const byStatus = Object.fromEntries(desiredProjectBoardOrder.map((status) => [status, active.filter((project) => project.status === status).length])) as Record<string, number>;
    const enriched = active.map((project) => {
      const projectTasks = allTasks.filter((task) => task.project === project.name && !["Terminado","Cancelado"].includes(task.status));
      const datedTasks = projectTasks
        .filter((task) => task.dateStart && new Date(task.dateStart).getTime() >= now)
        .sort((a,b) => new Date(a.dateStart || 0).getTime() - new Date(b.dateStart || 0).getTime());
      const nextTask = datedTasks[0] ?? null;
      const riskScore = (project.priority === "Alta" ? 100 : project.priority === "Media" ? 40 : 10)
        + projectTasks.length * 8
        + (nextTask ? Math.max(0, 40 - Math.floor((new Date(nextTask.dateStart || 0).getTime() - now) / 86400000) * 4) : 0);
      return { project, projectTasks, nextTask, riskScore };
    });
    const attention = [...enriched].sort((a,b) => b.riskScore - a.riskScore).slice(0,3);
    const milestones = enriched
      .filter((item) => item.nextTask)
      .sort((a,b) => new Date(a.nextTask?.dateStart || 0).getTime() - new Date(b.nextTask?.dateStart || 0).getTime())
      .slice(0,3);
    const highPriority = enriched.filter((item) => item.project.priority === "Alta");
    const busy = [...enriched].sort((a,b) => b.projectTasks.length - a.projectTasks.length);
    return { active, byStatus, enriched, attention, milestones, highPriority, busy };
  }, [projects, allTasks]);

  const q = search.trim().toLocaleLowerCase("es");
  const filteredTasks = useMemo(() => tasks.filter((task) => !q || `${task.name} ${task.project} ${task.account} ${task.people.join(" ")}`.toLowerCase().includes(q)), [tasks, q]);
  const filteredProjects = useMemo(() => projects.filter((project) => !q || `${project.name} ${project.account} ${project.type} ${project.people.join(" ")}`.toLowerCase().includes(q)), [projects, q]);
  const dashboardProjects = useMemo(() => projects.filter((project) => {
    const status = project.status.trim().toLocaleLowerCase("es");
    const type = project.type.trim().toLocaleLowerCase("es");
    return status !== "daily" && type !== "daily";
  }), [projects]);
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const eventFromIso = (value: string | null | undefined) => {
      const iso = dateOnly(value);
      if (!iso) return null;
      const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const monthNumber = Number(match[2]);
      const day = Number(match[3]);
      const month = calendarMonths.findIndex((item) => item.year === year && (monthIndexByCode[item.short] + 8) === monthNumber);
      return month >= 0 ? { month, day } : null;
    };

    const taskEvents: CalendarEvent[] = allTasks.flatMap((task) => {
      const dated = eventFromIso(task.dateStart);
      const hasTime = Boolean(task.dateStart?.includes("T"));
      const startMinutes = hasTime ? plannerMinutes(task.dateStart) : null;
      const endMinutes = hasTime && task.dateEnd?.includes("T") ? plannerMinutes(task.dateEnd, (startMinutes ?? 0) + 60) : null;
      const time = startMinutes == null
        ? null
        : endMinutes != null
          ? `${plannerTimeLabel(startMinutes)}–${plannerTimeLabel(endMinutes)}`
          : plannerTimeLabel(startMinutes);
      if (dated) return [{
        key: `task-${task.id}`,
        ...dated,
        kind: "task" as const,
        title: task.name,
        meta: task.project,
        account: task.account,
        id: task.id,
        time,
        status: task.status,
      }];
      const match = task.date.match(/^(\d{1,2})\s+(AGO|SEP|OCT)$/i);
      if (!match) return [];
      return [{
        key: `task-${task.id}`,
        month: monthIndexByCode[match[2].toUpperCase()],
        day: Number(match[1]),
        kind: "task" as const,
        title: task.name,
        meta: task.project,
        account: task.account,
        id: task.id,
        time,
        status: task.status,
      }];
    });

    const projectEvents: CalendarEvent[] = projects.flatMap((project) => {
      const dated = eventFromIso(project.timingStart);
      if (dated) return [{ key: `project-${project.id}`, ...dated, kind: "project" as const, title: project.name, meta: "Inicio de proyecto", account: project.account, id: project.id }];
      const match = project.timing.match(/(\d{1,2})\s+(AGO|SEP|OCT)/i);
      if (!match) return [];
      return [{ key: `project-${project.id}`, month: monthIndexByCode[match[2].toUpperCase()], day: Number(match[1]), kind: "project" as const, title: project.name, meta: "Inicio de proyecto", account: project.account, id: project.id }];
    });

    const holidayEvents: CalendarEvent[] = holidays.flatMap((holiday) => {
      const dated = eventFromIso(holiday.start);
      if (!dated) return [];
      return [{ key: `holiday-${holiday.url}`, ...dated, kind: "holiday", title: holiday.name, meta: `${holiday.type} · ${holiday.label}` }];
    });

    return [...taskEvents, ...projectEvents, ...holidayEvents].sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      if (a.day !== b.day) return a.day - b.day;
      if (a.kind === "task" && b.kind === "task") {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time && !b.time) return 1;
        if (!a.time && b.time) return -1;
      }
      return a.title.localeCompare(b.title);
    });
  }, [allTasks, projects, holidays]);

  const monthCalendarEvents = calendarEvents.filter((event) => event.month === calendarMonth);
  const visibleCalendarEvents = monthCalendarEvents.filter((event) => calendarFilter === "all" || event.kind === calendarFilter);
  const visibleEventDays = Array.from(new Set(visibleCalendarEvents.map((event) => event.day))).sort((a, b) => a - b);
  const selectedCalendarDayEvents = selectedCalendarDay == null
    ? []
    : monthCalendarEvents.filter((event) => event.day === selectedCalendarDay);

  const calendarInsights = useMemo(() => {
    const month = calendarMonths[calendarMonth];
    const now = new Date();
    const isCurrentMonth = month.year === now.getFullYear() && (monthIndexByCode[month.short] + 7) === now.getMonth();
    const thresholdDay = isCurrentMonth ? now.getDate() : 1;
    const upcoming = monthCalendarEvents
      .filter((event) => event.day >= thresholdDay)
      .sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        const aHoliday = a.kind === "holiday" ? 1 : 0;
        const bHoliday = b.kind === "holiday" ? 1 : 0;
        if (aHoliday !== bHoliday) return aHoliday - bHoliday;
        return a.title.localeCompare(b.title);
      });
    const nextEvent = upcoming.find((event) => event.kind !== "holiday") ?? upcoming[0] ?? null;

    const weekCount = Math.ceil((month.offset + month.days) / 7);
    const weekBuckets = Array.from({ length: weekCount }, (_, index) => {
      const startDay = Math.max(1, index * 7 - month.offset + 1);
      const endDay = Math.min(month.days, (index + 1) * 7 - month.offset);
      const count = monthCalendarEvents.filter((event) => event.day >= startDay && event.day <= endDay).length;
      return { index, startDay, endDay, count };
    });
    const maxWeekCount = Math.max(1, ...weekBuckets.map((week) => week.count));
    const busiestWeek = [...weekBuckets].sort((a, b) => b.count - a.count)[0] ?? null;

    const dayGroups = Array.from({ length: month.days }, (_, index) => {
      const day = index + 1;
      const events = monthCalendarEvents.filter((event) => event.day === day);
      const workCount = events.filter((event) => event.kind !== "holiday").length;
      const holidayCount = events.filter((event) => event.kind === "holiday").length;
      const crossing = events.length >= 3 || (workCount > 0 && holidayCount > 0);
      return { day, events, workCount, holidayCount, crossing };
    }).filter((item) => item.crossing).sort((a, b) => b.events.length - a.events.length || a.day - b.day);

    return { nextEvent, weekBuckets, maxWeekCount, busiestWeek, crossings: dayGroups.slice(0, 2) };
  }, [calendarMonth, monthCalendarEvents]);
  const holidayTimelineNames = Array.from(new Set(holidays.filter((holiday) => holiday.segment !== "Festivo").map((holiday) => holiday.name)));
  const holidayWindowStart = mondayForOperationalWeek(new Date());
  const holidayWindowEnd = addDays(holidayWindowStart, 55);
  const holidayWeekLabels = Array.from({ length: 8 }, (_, index) => addDays(holidayWindowStart, index * 7));
  const peopleHolidayRows = holidays.filter((holiday) => holiday.segment !== "Festivo");
  const globalHolidayRows = holidays.filter((holiday) => holiday.segment === "Festivo");
  const filteredHolidayRows = peopleHolidayRows.filter((holiday) => {
    if (holidayFilter === "Todas") return true;
    if (holidayFilter === "Vacaciones") return holiday.type === "Libres";
    if (holidayFilter === "Extras") return holiday.type === "Convenio" || holiday.type === "Puente";
    return holiday.type === holidayFilter;
  });
  const upcomingPeopleAway = Array.from(new Set(filteredHolidayRows
    .filter((holiday) => holiday.end && new Date(holiday.end + "T23:59:59").getTime() >= Date.now())
    .map((holiday) => holiday.name)));
  const teamVacationBase = team.filter((person) => typeof person.leaveAllowance?.base === "number");
  const avgVacationUsed = teamVacationBase.length
    ? Math.round(teamVacationBase.reduce((sum, person) => sum + (person.leaveUsage?.usedVacationDays || 0), 0) / teamVacationBase.length)
    : 0;
  const avgVacationRemaining = teamVacationBase.length
    ? Math.round(teamVacationBase.reduce((sum, person) => sum + (person.leaveUsage?.remainingVacationDays || 0), 0) / teamVacationBase.length)
    : 0;

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

  async function saveAccount() {
    if (!selectedAccount?.id || !accountDraft || accountSaving) return;
    const sourceAccount = selectedAccount;
    const changes = {
      name: accountDraft.name,
      assignedPeople: accountDraft.assignedPeople,
      status: accountDraft.status,
      priority: accountDraft.priority,
      contract: accountDraft.contract,
    };
    setAccountSaving(true);
    try {
      const response = await fetch("/api/notion/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "account", id: sourceAccount.id, changes }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || "No se pudo actualizar la cuenta");
      }
      const updated = { ...sourceAccount, ...changes };
      if (changes.name !== sourceAccount.name) {
        setProjects((items) => items.map((item) => item.account === sourceAccount.name ? { ...item, account: changes.name } : item));
        setTasks((items) => items.map((item) => item.account === sourceAccount.name ? { ...item, account: changes.name } : item));
        setAllTasks((items) => items.map((item) => item.account === sourceAccount.name ? { ...item, account: changes.name } : item));
      }
      setAccountOptions((items) => items.map((item) => item.id === sourceAccount.id ? { ...item, ...changes } : item));
      setAccounts((items) => {
        const changed = items.map((item) => item.id === sourceAccount.id ? { ...item, ...changes } : item);
        return changes.status === "Activa"
          ? changed.some((item) => item.id === sourceAccount.id) ? changed : [...changed, updated]
          : changed.filter((item) => item.id !== sourceAccount.id);
      });
      setSelectedAccount(updated);
      setAccountEditing(false);
      toast.success("Cuenta actualizada", { description: "Los cambios se han guardado en Notion." });
    } catch (error) {
      toast.error("No se pudo guardar la cuenta", { description: error instanceof Error ? error.message : "Error de Notion" });
    } finally {
      setAccountSaving(false);
    }
  }

  function taskDateLabel(value: string | null | undefined) {
    const day = dateOnly(value);
    return day
      ? new Date(day + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "")
      : "SIN FECHA";
  }

  function patchTaskLocal(id: string, changes: Partial<Task>) {
    const patch = (task: Task): Task => {
      if (task.id !== id) return task;
      const next = { ...task, ...changes } as Task;
      if ("dateStart" in changes && !("date" in changes)) next.date = taskDateLabel(next.dateStart);
      return next;
    };
    setAllTasks((items) => items.map(patch));
    setTasks((items) => items.map(patch));
    setDetail((current) => {
      if (!current || current.kind !== "task" || current.id !== id) return current;
      const nextTask = { ...current, ...changes } as Extract<Detail, { kind: "task" }>;
      if ("dateStart" in changes && !("date" in changes)) nextTask.date = taskDateLabel(nextTask.dateStart);
      return nextTask;
    });
  }

  function patchProjectLocal(id: string, changes: Partial<Project>) {
    const patch = (project: Project): Project => project.id === id ? ({ ...project, ...changes } as Project) : project;
    setProjects((items) => items.map(patch));
    setSelectedProjectPage((current) => current?.id === id ? ({ ...current, ...changes } as Project) : current);
    setDetail((current) => current?.kind === "project" && current.id === id ? ({ ...current, ...changes } as Detail) : current);
  }


  async function moveTaskLane(id: string, lane: TaskLane) {

    const previous = allTasks.find((task) => task.id === id) ?? tasks.find((task) => task.id === id);
    if (!previous) return;
    const status = notionStatusForLane(lane);
    const workosLane = workosLaneForLane(lane);
    patchTaskLocal(id, { status, workosLane });
    setDragging(null);
    try {
      await syncNotion("task", id, { status, workosLane });
      toast.success(`Tarea movida a ${lane}`, { description: "Estado unificado y sincronizado con Notion." });
    } catch {
      patchTaskLocal(id, previous);
      toast.error("Notion rechazó el cambio", { description: "Se ha restaurado el estado anterior." });
    }
  }

  async function moveTask(id: string, status: TaskStatus) {

    const previous = allTasks.find((task) => task.id === id) ?? tasks.find((task) => task.id === id);
    patchTaskLocal(id, { status });
    setDragging(null);
    try {
      await syncNotion("task", id, { status });
      toast.success(`Tarea movida a ${status}`, { description: "Sincronizado con Notion." });
    } catch {
      if (previous) {
        patchTaskLocal(id, previous);
      }
      toast.error("Notion rechazó el cambio", { description: "Se ha restaurado el estado anterior." });
    }
  }
  async function moveProject(id: string, status: ProjectStatus) {

    const previous = projects.find((project) => project.id === id);
    patchProjectLocal(id, { status });
    setDragging(null);
    try {
      await syncNotion("project", id, { status });
      toast.success(`Proyecto movido a ${status}`, { description: "Sincronizado con Notion." });
    } catch {
      if (previous) patchProjectLocal(id, previous);
      toast.error("Notion rechazó el cambio", { description: "Se ha restaurado el estado anterior." });
    }
  }
  async function setPlannerTaskAllDay(taskId: string, destinationDate: string) {

    const previous = allTasks.find((task) => task.id === taskId);
    if (!previous) return;
    const label = new Date(destinationDate + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "");
    patchTaskLocal(taskId, { dateStart: destinationDate, dateEnd: null, date: label });
    try {
      await syncNotion("task", taskId, { dateStart: destinationDate, dateEnd: null });
      toast.success("Tarea marcada como todo el día", { description: "Movida a la franja superior y guardada en Notion." });
    } catch {
      patchTaskLocal(taskId, previous);
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
    patchTaskLocal(taskId, { dateStart, dateEnd, date: label });
    try {
      await syncNotion("task", taskId, { dateStart, dateEnd });
      toast.success("Horario actualizado", { description: `${plannerTimeLabel(snappedStart)}–${plannerTimeLabel(snappedEnd)} · guardado en Notion.` });
    } catch {
      patchTaskLocal(taskId, previous);
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
      patchTaskLocal(task.id, { dateStart, dateEnd });
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
        patchTaskLocal(task.id, task);
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
      if (!previous || dateOnly(previous.dateStart) === destinationDate) return;
      const label = taskDateLabel(destinationDate);
      const timed = Boolean(previous.dateStart?.includes("T"));
      const startMinutes = plannerMinutes(previous.dateStart);
      const endMinutes = plannerMinutes(previous.dateEnd, startMinutes + 60);
      const dateStart = timed ? localPlannerIso(destinationDate, startMinutes) : destinationDate;
      const dateEnd = timed && previous.dateEnd ? localPlannerIso(destinationDate, endMinutes) : null;
      patchTaskLocal(id, { dateStart, dateEnd, date: label });
      try {
        await syncNotion("task", id, { dateStart, dateEnd });
        toast.success("Tarea reprogramada", { description: `Movida al ${label} en Notion.` });
      } catch {
        patchTaskLocal(id, previous);
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
      patchProjectLocal(id, kind === "project-start" ? { timingStart: destinationDate } : { timingEnd: destinationDate });
      try {
        await syncNotion("project", id, { [field]: destinationDate });
        toast.success(kind === "project-start" ? "Arranque reprogramado" : "Cierre reprogramado", {
          description: "Fecha actualizada en Notion.",
        });
      } catch {
        patchProjectLocal(id, previous);
        toast.error("No se pudo cambiar la fecha del proyecto en Notion");
      }
    }
  }

  function handleTaskLaneDrop(event: React.DragEvent, destination: TaskLane) {

    event.preventDefault();
    const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    if (kind === "task") void moveTaskLane(id, destination);
  }
  function handleDrop(event: React.DragEvent, destination: TaskStatus | ProjectStatus) {

    event.preventDefault(); const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    if (kind === "task") moveTask(id, destination as TaskStatus);
    if (kind === "project") moveProject(id, destination as ProjectStatus);
  }
  async function assignPerson(kind: "task" | "project", id: string, person: string) {

    const currentItem = kind === "task" ? (allTasks.find((task) => task.id === id) ?? tasks.find((task) => task.id === id)) : projects.find((project) => project.id === id);
    if (!currentItem) return;
    const nextPeople = currentItem.people.includes(person) ? currentItem.people : [...currentItem.people.filter((name) => name !== "Por asignar"), person];
    if (kind === "task") {
      patchTaskLocal(id, { people: nextPeople });
    }
    else patchProjectLocal(id, { people: nextPeople });
    setDragging(null);
    try {
      await syncNotion(kind, id, { people: nextPeople });
      toast.success(`${person} asignado`, { description: "Relación actualizada en Notion." });
    } catch {
      if (kind === "task") {
        patchTaskLocal(id, { people: currentItem.people });
      }
      else patchProjectLocal(id, { people: currentItem.people });
      toast.error("No se pudo asignar en Notion");
    }
  }
  async function moveToAccount(event: React.DragEvent, account: string) {

    event.preventDefault(); const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
    if (kind !== "task" && kind !== "project") return;
    const previous = kind === "task" ? (allTasks.find((task) => task.id === id) ?? tasks.find((task) => task.id === id)) : projects.find((project) => project.id === id);
    if (!previous) return;
    if (kind === "task") {
      patchTaskLocal(id, { account });
    }
    else patchProjectLocal(id, { account });
    setDragging(null);
    try {
      await syncNotion(kind, id, { account });
      toast.success(`Movido a ${account}`, { description: "Relación actualizada en Notion." });
    } catch {
      if (kind === "task") {
        patchTaskLocal(id, { account: previous.account });
      }
      else patchProjectLocal(id, { account: previous.account });
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
        const createdTask: Task = {
          id: body.id,
          name,
          status: "Pendiente",
          workosLane: "Backlog",
          priority: "Media",
          project: "Por asignar",
          account: "Sin cuenta",
          date: "SIN FECHA",
          dateStart: null,
          people: ["Por asignar"],
          url: body.url || "https://www.notion.so",
        };
        setTasks((items) => [createdTask, ...items]);
        setAllTasks((items) => [createdTask, ...items]);
        await syncNotion("task", body.id, { status: "Pendiente", workosLane: "Backlog" });
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
  function updateDetailTaskLane(lane: TaskLane) {
    setDetail((currentDetail) => {
      if (!currentDetail || currentDetail.kind !== "task") return currentDetail;
      return {
        ...currentDetail,
        status: notionStatusForLane(lane),
        workosLane: workosLaneForLane(lane),
      };
    });
  }
  function updateWorkspaceTaskLane(task: Task, lane: TaskLane) {
    void updateWorkspaceTask(task, {
      status: notionStatusForLane(lane),
      workosLane: workosLaneForLane(lane),
    });
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
    patchProjectLocal(next.id, changes as Partial<Project>);
    try {
      await syncNotion("project", next.id, changes);
      toast.success("Proyecto actualizado", { description: "Guardado directamente en Notion." });
    } catch (error) {
      patchProjectLocal(previous.id, previous);
      toast.error("No se pudo actualizar el proyecto");
    }
  }

  async function updateWorkspaceTask(task: Task, changes: Record<string, unknown>) {

    const next = { ...task, ...changes } as Task;
    patchTaskLocal(task.id, changes as Partial<Task>);
    try {
      await syncNotion("task", task.id, changes);
    } catch {
      patchTaskLocal(task.id, task);
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
        workosLane: null,
        priority: "Media",
        project: selectedProjectPage.name,
        account: selectedProjectPage.account,
        date: "SIN FECHA",
        dateStart: null,
        people: selectedProjectPage.people.length ? selectedProjectPage.people : ["Por asignar"],
        url: body.url || "https://www.notion.so",
      };
      await syncNotion("task", task.id, {
        status: "Pendiente",
        workosLane: null,
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
      const lane = taskLane(detail);
      const normalizedStatus = notionStatusForLane(lane);
      const normalizedWorkosLane = workosLaneForLane(lane);
      const nextTask: Task = { ...detail, id: detail.id, name: detail.name, status: normalizedStatus, workosLane: normalizedWorkosLane, priority: detail.priority, project: detail.project, account: detail.account, date: detail.date, dateStart: detail.dateStart, dateEnd: detail.dateEnd, people: detail.people, url: detail.url };
      const previousTask = allTasks.find((task) => task.id === nextTask.id) ?? tasks.find((task) => task.id === nextTask.id);
      patchTaskLocal(nextTask.id, nextTask);
      try {
        await syncNotion("task", detail.id, {
          name: detail.name,
          status: normalizedStatus,
          workosLane: normalizedWorkosLane,
          priority: detail.priority,
          project: detail.project,
          account: detail.account,
          people: detail.people,
          dateStart: detail.dateStart,
          dateEnd: detail.dateEnd,
        });
        patchTaskLocal(nextTask.id, nextTask);
        toast.success("Cambios guardados", { description: "Datos y relaciones sincronizados con Notion." });
      } catch {
        if (previousTask) patchTaskLocal(previousTask.id, previousTask);
        toast.error("No se pudieron guardar los cambios en Notion");
      }
    } else {
      const nextProject: Project = { id: detail.id, name: detail.name, status: detail.status, account: detail.account, timing: detail.timing, timingStart: detail.timingStart, timingEnd: detail.timingEnd, type: detail.type, people: detail.people, priority: detail.priority, url: detail.url };
      const previousProject = projects.find((project) => project.id === nextProject.id);
      patchProjectLocal(nextProject.id, nextProject);
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
        if (previousProject) patchProjectLocal(previousProject.id, previousProject);
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
        workosLane: null,
        priority: "Media",
        project: "Por asignar",
        account: "Sin cuenta",
        date,
        dateStart,
        people: ["Por asignar"],
        url: body.url || "https://www.notion.so",
      };
      await syncNotion("task", task.id, { dateStart, status: "Pendiente", workosLane: null });
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
      const task = allTasks.find((item) => item.id === event.id);
      if (task) setDetail({ kind: "task", ...task });
    } else if (event.kind === "project") {
      const project = projects.find((item) => item.id === event.id);
      if (project) setSelectedProjectPage(project);
    } else {
      setActiveView("holidays");
    }
  }

  return <Tabs
    value={activeView}
    onValueChange={(value) => setActiveView(value as View)}
    orientation="vertical"
    className="os-shell"
  >
    <aside className="sidebar-shell">
      <div className="brand-lockup"><ModeLogo mode="work" href="/life" /><a href="/" aria-label="Ir a Home" title="Home" className="work-home-shortcut"><LayoutDashboard size={18}/></a></div>
      <div className="nav-section-label"><span>ESPACIOS</span><small>{visibleNavigation.length} vistas</small></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button type="button" className="sidebar-add-item"><Plus /><span>Añadir item</span></button>
          </DialogTrigger>
          <DialogContent className="quick-dialog"><DialogHeader><DialogTitle>Añadir sin ceremonia</DialogTitle><DialogDescription>Crea una tarea o proyecto y completa después el resto de propiedades.</DialogDescription></DialogHeader>
            <div className="quick-form"><Select value={quickType} onValueChange={setQuickType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="task">Tarea</SelectItem><SelectItem value="project">Proyecto</SelectItem></SelectContent></Select><input autoFocus value={quickName} onChange={(event) => setQuickName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createQuickItem(); }} placeholder={quickType === "task" ? "¿Qué hay que hacer?" : "Nombre del proyecto"} /></div>
            <DialogFooter><Button onClick={createQuickItem}>Crear</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      <TabsList className="nav-list desktop-nav-list" variant="line" aria-label="Navegación principal">
        {visibleNavigation.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className={`nav-item nav-${value} ${value === "dashboard" ? "nav-dashboard" : ""}`}><Icon /><span>{label}</span>{value === "dashboard" && <small>GENERAL</small>}</TabsTrigger>)}
      </TabsList>
      <a href="/creative" className="sidebar-admin-link"><Sparkles /><span>Creative Lab</span></a>
      <nav className="mobile-app-nav" aria-label="Navegación móvil">
        <button className={activeView === "week" ? "active" : ""} onClick={() => setActiveView("week")}><CalendarDays /><span>Agenda</span></button>
        <button className={activeView === "tasks" ? "active" : ""} onClick={() => setActiveView("tasks")}><FolderKanban /><span>Trabajo</span></button>
        <button className={`mobile-home-button ${activeView === "dashboard" ? "active" : ""}`} onClick={() => setActiveView("dashboard")}><LayoutDashboard /><span>Dashboard</span></button>
        <button className={activeView === "accounts" ? "active" : ""} onClick={() => setActiveView("accounts")}><BriefcaseBusiness /><span>Cuentas</span></button>
        <button className={activeView === "team" ? "active" : ""} onClick={() => setActiveView("team")}><Users /><span>Equipo</span></button>
      </nav>
      <div className="sync-card"><span className="sync-dot" /><div><strong>{schemaState === "live" && dataState === "live" ? "NOTION EN VIVO" : schemaState === "error" || dataState === "error" ? "NOTION · SIN DATOS" : "CONECTANDO NOTION"}</strong><small>{schemaState === "live" && dataState === "live" ? `${liveCounts?.activeTasks ?? tasks.length} tareas · ${liveCounts?.activeProjects ?? projects.length} proyectos · opciones reales` : schemaState === "error" || dataState === "error" ? "No se muestran snapshots antiguos como si fueran actuales" : "Leyendo filas, relaciones y schema…"}</small></div></div>
      <form action="/api/auth/logout" method="post" className="user-chip"><span>{displaySessionInitials}</span><div><strong>{displaySessionName.toUpperCase()}</strong><small>Director Creativo</small></div><button type="submit" className="user-chip-logout">Salir</button></form>
    </aside>

    <main className={`main-stage main-stage-${activeView}${selectedProjectPage ? " project-page-open" : ""}`} aria-hidden={selectedProjectPage ? true : undefined}>
      <header className="topbar topbar-compact">
        <div className="page-heading"><span>{current.eyebrow}</span><h1>{current.title}</h1><p>{current.description}</p></div>
      </header>

      <TabsContent value="imputation" className="view-content imputation-view"><Timesheet projects={[...projects, ...imputationProjects.filter(project => !projects.some(current => current.id === project.id)).map(project => ({ ...project, status: "Terminado" }))]} tasks={allTasks.map(task => ({ ...task, workosLane: taskLane(task) }))} holidays={imputationHolidays} personName={displaySessionName} dataState={dataState} /></TabsContent>

      <TabsContent value="dashboard" className="view-content dashboard-view">
        <section className="mobile-only mobile-dashboard">
          <article className="mobile-today-card">
            <div className="mobile-card-kicker"><span>HOY</span><i className={dataState === "live" ? "live" : ""} /></div>
            <div className="mobile-today-date">
              <strong>{new Date().toLocaleDateString("es-ES",{weekday:"long"})}</strong>
              <span>{new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long"})}</span>
            </div>
            <div className="mobile-today-stats">
              <span><b>{dashboardTasks.length}</b><small>tareas</small></span>
              <span><b>{dashboardProjects.length}</b><small>proyectos</small></span>
              <span><b>{team.filter((person)=>person.load>=75).length}</b><small>carga alta</small></span>
            </div>
            <button className="mobile-next-card" onClick={() => upcomingDeadlines[0] && setDetail({kind:"task",...upcomingDeadlines[0]})}>
              <span>PRÓXIMO</span>
              <strong>{upcomingDeadlines[0]?.name || "Nada al horizonte"}</strong>
              <small>{upcomingDeadlines[0] ? `${upcomingDeadlines[0].project} · ${upcomingDeadlines[0].date}` : "Sin fechas próximas"}</small>
              <ArrowUpRight />
            </button>
          </article>

          <div className="mobile-section-head"><div><span>RADAR</span><h2>Lo que merece ojo</h2></div></div>
          <div className="mobile-card-carousel mobile-radar-carousel">
            <article className="mobile-radar-card lime"><span>PRÓXIMAS 48H</span><strong>{taskViewStats.next48.length}</strong><small>tareas con fecha</small><b>{taskViewStats.next48[0]?.name || "Despejado"}</b></article>
            <article className="mobile-radar-card dark"><span>CARGA</span><strong>{team.filter((person)=>person.load>=75).length}</strong><small>personas altas</small><b>{[...team].sort((a,b)=>b.load-a.load)[0]?.name || "Sin datos"}</b></article>
            <article className="mobile-radar-card light"><span>CUENTAS</span><strong>{accountViewStats.moving.length}</strong><small>en movimiento</small><b>{accountViewStats.moving[0]?.name || "Sin actividad"}</b></article>
          </div>

          <div className="mobile-section-head"><div><span>EN FOCO</span><h2>Próximos movimientos</h2></div></div>
          <div className="mobile-card-carousel mobile-focus-carousel">
            {upcomingDeadlines.slice(0,5).map((task)=><button key={task.id} className="mobile-focus-card" onClick={()=>setDetail({kind:"task",...task})}>
              <span>{task.account}</span><strong>{task.name}</strong><small>{task.project}</small><b>{task.date}</b>
            </button>)}
            {!upcomingDeadlines.length && <div className="mobile-empty-card">Nada urgente. Sospechoso, pero agradable.</div>}
          </div>

          <div className="mobile-focus-pill">
            <span><small>FOCUS</small><b>{String(Math.floor(focusSeconds/60)).padStart(2,"0")}:{String(focusSeconds%60).padStart(2,"0")}</b></span>
            <button onClick={()=>setFocusRunning((running)=>!running)}>{focusRunning?<Pause/>:<Play/>}</button>
          </div>
        </section>

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
                {dashboardTaskLanes.map((lane) => {
                  const items = dashboardTasks.filter((task) => taskLane(task) === lane);
                  const total = items.length;
                  return <div key={lane} className={`mini-task-lane ${dragging?.startsWith("task") ? "ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleTaskLaneDrop(event, lane)}>
                    <div className="mini-lane-head"><span>{lane}</span><b>{total}</b></div>
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

          <aside className="dashboard-side-stack">
            <section className="team-roster dashboard-team-compact">
              <div className="roster-head module-head"><div><span>{team.length} PERSONAS</span><h2>Equipo</h2></div><button className="module-action" onClick={() => setActiveView("team")}>Ver equipo <ArrowUpRight /></button></div>
              <div className="roster-list">{team.map((person) => { const performance = personPerformance(person); return <button key={person.name} className="roster-person" draggable
                onDragStart={(event) => { event.dataTransfer.setData("text/plain", `person:${person.name}`); setDragging(`person:${person.name}`); }}
                onDragEnd={() => setDragging(null)} onClick={() => setSelectedPerson(person)}>
                <div className={`avatar avatar-${person.tone}`}>{person.initials}</div><span><strong>{person.name}</strong><small>{person.role}</small></span><i className={person.load >= 75 ? "hot" : person.load >= 45 ? "warm" : "cool"} title={`${person.load}% de carga relativa`} /><b className="roster-ratio">{performance.ratio ?? "—"}</b>
              </button>; })}</div>
            </section>

            <section className="dashboard-quick-note">
              <header>
                <div><NotebookPen /><span><small>NOTAS</small><strong>Apunte rápido</strong></span></div>
                {quickNote && <button type="button" onClick={() => setQuickNote("")} aria-label="Borrar nota"><X /></button>}
              </header>
              <Textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                placeholder="Escribe aquí algo que no quieras perder de vista…"
                aria-label="Nota rápida personal"
              />
              <footer><span>Guardado solo en este navegador</span><i className={quickNote ? "saved" : ""} /></footer>
            </section>
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
        <section className="mobile-only mobile-agenda">
          <header className="mobile-screen-head">
            <span>AGENDA</span>
            <h1>Esta semana</h1>
            <p>{operationalWeekStart.toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).replace(".","").toUpperCase()} — {operationalWeekEnd.toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).replace(".","").toUpperCase()}</p>
          </header>

          <div className="mobile-week-summary">
            <strong>{Math.floor(weekPlannerStats.totalMinutes/60)}h {String(weekPlannerStats.totalMinutes%60).padStart(2,"0")}</strong>
            <span>planificadas</span>
            <div><b>{weeklyTasks.length}</b><small>tareas</small><b>{weekPlannerStats.conflicts}</b><small>conflictos</small></div>
          </div>

          <div className="mobile-day-strip">
            {operationalWeekDays.map((day,index)=><button key={isoDate(day)} className={index===mobileAgendaIndex?"active":""} onClick={()=>setMobileAgendaIndex(index)}>
              <span>{day.toLocaleDateString("es-ES",{weekday:"narrow"}).toUpperCase()}</span>
              <strong>{day.getDate()}</strong>
              <i className={weeklyTasks.some((task)=>dateOnly(task.dateStart)===isoDate(day))?"has-items":""} />
            </button>)}
          </div>

          <div className="mobile-agenda-day-head"><div><span>{mobileAgendaDay.toLocaleDateString("es-ES",{weekday:"long"})}</span><h2>{mobileAgendaDay.toLocaleDateString("es-ES",{day:"numeric",month:"long"})}</h2></div><small>{mobileAgendaTasks.length} items</small></div>

          <div className="mobile-agenda-list">
            {mobileAgendaTasks.map((task)=><button key={task.id} className={`mobile-agenda-item ${taskIsAllDay(task)?"all-day":""}`} onClick={()=>setDetail({kind:"task",...task})}>
              <span className="mobile-agenda-time">{taskIsAllDay(task)?"TODO EL DÍA":plannerTimeLabel(plannerMinutes(task.dateStart))}</span>
              <div><strong>{task.name}</strong><small>{task.project} · {task.account}</small></div>
              <ChevronRight />
            </button>)}
            {mobileAgendaMilestones.map((event)=><button key={event.id} className="mobile-agenda-item milestone" onClick={()=>setSelectedProjectPage(event.project)}>
              <span className="mobile-agenda-time">{event.label.toUpperCase()}</span><div><strong>{event.project.name}</strong><small>{event.project.account}</small></div><ChevronRight />
            </button>)}
            {mobileAgendaHolidays.map((holiday)=><div key={holiday.id || holiday.url} className="mobile-agenda-item holiday">
              <span className="mobile-agenda-time">AUSENCIA</span><div><strong>{holiday.name}</strong><small>{holiday.type}</small></div><CalendarDays />
            </div>)}
            {!mobileAgendaTasks.length&&!mobileAgendaMilestones.length&&!mobileAgendaHolidays.length&&<div className="mobile-empty-card">Día despejado.</div>}
          </div>
        </section>

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
                {allDayTasks.map((task) => <div key={task.id} className={`planner-all-day-chip task ${taskLane(task) === "Terminado" ? "is-completed" : ""}`} title={task.name}>
                  <i /><span>
                    <button
                      type="button"
                      className="planner-task-title"
                      title={`Abrir ${task.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail({ kind: "task", ...task });
                      }}
                    ><strong>{task.name}</strong></button>
                    <small>{task.project}</small>
                  </span>
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

          <div className="week-planner-scroll" ref={weekPlannerScrollRef}>
            <div className="week-planner-grid" style={{ height: `${PLANNER_HEIGHT}px` }}>
              <aside className="planner-time-axis" style={{ height: `${PLANNER_HEIGHT}px` }}>
                {Array.from({ length: PLANNER_HOURS + 1 }, (_, index) => PLANNER_START / 60 + index).map((hour) => <span key={hour} style={{ top: `${(hour * 60 - PLANNER_START) / 60 * PLANNER_HOUR_PX}px` }}>{String(hour).padStart(2, "0")}:00</span>)}
              </aside>

              {operationalWeekDays.map((day) => {
                const key = isoDate(day);
                const dayTasks = weeklyTasks.filter((task) => dateOnly(task.dateStart) === key && !taskIsAllDay(task));
                return <div key={key} className="planner-day-column" style={{ height: `${PLANNER_HEIGHT}px` }}
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
                    {Array.from({ length: PLANNER_HOURS + 1 }, (_, index) => <i key={index} style={{ top: `${index * PLANNER_HOUR_PX}px` }} />)}
                  </div>

                  {dayTasks.map((task) => {
                    const startMinutes = plannerMinutes(task.dateStart);
                    const endMinutes = plannerMinutes(task.dateEnd, startMinutes + 60);
                    const visibleStart = Math.max(PLANNER_START, Math.min(PLANNER_END, startMinutes));
                    const visibleEnd = Math.max(visibleStart + 30, Math.min(PLANNER_END, endMinutes));
                    const top = ((visibleStart - PLANNER_START) / 60) * PLANNER_HOUR_PX;
                    const height = Math.max(42, ((visibleEnd - visibleStart) / 60) * PLANNER_HOUR_PX);
                    return <div key={task.id}
                      className={`planner-task-block ${plannerPriorityClass(task.priority)} ${taskLane(task) === "Terminado" ? "is-completed" : ""}`}
                      style={{ top: `${top}px`, height: `calc(${height}px - 4px)` }}>
                      <span className="planner-resize-handle top" onPointerDown={(event) => startPlannerResize(task, "start", event)} />
                      <div className="planner-task-time">{plannerTimeLabel(startMinutes)}–{plannerTimeLabel(endMinutes)}</div>
                      <button
                        type="button"
                        className="planner-task-title"
                        title={`Abrir ${task.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetail({ kind: "task", ...task });
                        }}
                      ><strong>{task.name}</strong></button>
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
                    </div>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </section>

        <nav className="week-floating-nav" aria-label="Navegación por semanas">
          <button type="button" aria-label="Semana anterior" title="Semana anterior" onClick={() => setWeekOffset((offset) => offset - 1)}>
            <ChevronLeft />
          </button>
          <button
            type="button"
            className={"week-nav-current" + (weekOffset === 0 ? " is-current" : "")}
            onClick={() => setWeekOffset(0)}
            title="Volver a la semana actual"
          >
            <CalendarRange />
            <span>Semana actual</span>
          </button>
          <button type="button" aria-label="Semana siguiente" title="Semana siguiente" onClick={() => setWeekOffset((offset) => offset + 1)}>
            <ChevronRight />
          </button>
        </nav>
      </TabsContent>

      <TabsContent value="timeline" className="view-content global-timeline-view">
        <section className="timeline-roadmap-view">
          <section className="timeline-insights-grid">
            <article className="timeline-insight-card timeline-load-card">
              <div className="timeline-insight-kicker"><span>CARGA TEMPORAL</span><Activity /></div>
              <div className="timeline-load-head">
                <div><strong>{timelineWeeks}</strong><span>semanas</span></div>
                <small>{globalTimelineStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} → {globalTimelineEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</small>
              </div>
              <div className="timeline-density-bars" aria-label="Densidad de trabajo por semana">
                {timelineInsights.density.map((value, index) => <i key={index}><b style={{ height: `${Math.max(12, (value / timelineInsights.maxDensity) * 100)}%` }} /></i>)}
              </div>
              <div className="timeline-card-foot"><span>Pico de carga</span><strong>{timelineInsights.peakStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}–{timelineInsights.peakEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</strong></div>
            </article>

            <article className="timeline-insight-card timeline-milestones-card">
              <div className="timeline-insight-kicker"><span>PRÓXIMOS HITOS</span><CalendarRange /></div>
              <div className="timeline-milestone-list">
                {timelineInsights.nextMilestones.map(({ task, time }) => <button key={task.id} onClick={() => setDetail({ kind: "task", ...task })}>
                  <time>{new Date(time).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase()}</time>
                  <span><strong>{task.name}</strong><small>{task.project}</small></span>
                  <ChevronRight />
                </button>)}
                {!timelineInsights.nextMilestones.length && <div className="timeline-widget-empty">Sin hitos fechados en esta ventana.</div>}
              </div>
            </article>

            <article className="timeline-insight-card timeline-radar-card">
              <div className="timeline-insight-kicker"><span>RADAR</span><Target /></div>
              <div className="timeline-radar-main">
                <strong>{timelineInsights.visibleProjects.length}</strong>
                <span>proyectos visibles</span>
              </div>
              <div className="timeline-radar-stats">
                <div><b>{timelineInsights.overlaps}</b><span>solapes de cuenta</span></div>
                <div><b>{timelineInsights.missingEnd}</b><span>sin fecha final</span></div>
                <div><b>{timelineInsights.visibleTasks.length}</b><span>hitos en ventana</span></div>
              </div>
            </article>
          </section>

          <section className="global-timeline-shell timeline-v4">
            <header className="global-timeline-toolbar timeline-toolbar-v4">
              <div className="timeline-window">
                <div>
                  <span>ROADMAP</span>
                  <strong>{globalTimelineStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — {globalTimelineEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</strong>
                </div>
                <button className="timeline-today" onClick={() => setTimelineWeeks(8)}>Hoy</button>
              </div>
              <div className="timeline-range-switch"><span>VISTA</span>{[4, 8, 12].map((weeks) => <button key={weeks} className={timelineWeeks === weeks ? "active" : ""} onClick={() => setTimelineWeeks(weeks)}>{weeks}S</button>)}</div>
            </header>

            <div className="global-timeline-scale timeline-scale-v4">
              {Array.from({ length: timelineWeeks + 1 }, (_, index) => <span key={index} style={{ left: `${(index / timelineWeeks) * 100}%` }}>{addDays(globalTimelineStart, index * 7).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>)}
            </div>

            <div className="global-timeline-groups timeline-groups-v4">
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

                return <section key={account.name} className="timeline-account-group timeline-account-card-v4" style={{ "--timeline-color": account.color } as React.CSSProperties}>
                  <header className="timeline-account-head-v4">
                    <span className="timeline-account-dot" />
                    <div><strong>{account.name}</strong><small>{visibleAccountProjects.length} proyecto{visibleAccountProjects.length === 1 ? "" : "s"}</small></div>
                  </header>

                  <div className="timeline-account-projects-v4">
                    {visibleAccountProjects.map(({ project, left, right, visibleBar, visibleTasks }) => <button key={project.id} className="timeline-project-row-v4" onClick={() => setSelectedProjectPage(project)}>
                      <span className="timeline-project-label-v4">
                        <strong>{project.name}</strong>
                        <small>{project.status}</small>
                      </span>
                      <span className="timeline-project-track-v4">
                        {visibleBar && <i className="timeline-project-bar-v4" style={{ left: `${clamp(left!)}%`, width: `${Math.max(2.5, clamp(right!) - clamp(left!))}%` }}>
                          <em>{project.name}</em>
                        </i>}
                        {visibleTasks.map(({ task, pos }) => <b
                          key={task.id}
                          className={"timeline-task-node status-" + task.status.toLowerCase().replaceAll(" ", "-")}
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
        </section>
      </TabsContent>

      <TabsContent
        value="calendar"
        className="view-content calendar-view"
        onClick={(event) => {
          if (selectedCalendarDay == null) return;
          const target = event.target as HTMLElement;
          if (target.closest(".calendar-day, button, a, input, textarea, select, [role='button']")) return;
          setSelectedCalendarDay(null);
        }}
      >
        <section className="calendar-shell calendar-shell-v2">
          <header className="calendar-toolbar">
            <div className="month-switcher">
              <button aria-label="Mes anterior" disabled={calendarMonth === 0} onClick={() => { setSelectedCalendarDay(null); setCalendarMonth((month) => Math.max(0, month - 1)); }}><ChevronLeft /></button>
              <div><span>CRONOLOGÍA</span><strong>{calendarMonths[calendarMonth].name} {calendarMonths[calendarMonth].year}</strong></div>
              <button aria-label="Mes siguiente" disabled={calendarMonth === calendarMonths.length - 1} onClick={() => { setSelectedCalendarDay(null); setCalendarMonth((month) => Math.min(calendarMonths.length - 1, month + 1)); }}><ChevronRight /></button>
              <button className="today-button" onClick={() => {
                const now = new Date();
                const index = calendarMonths.findIndex((month) => month.year === now.getFullYear() && (monthIndexByCode[month.short] + 7) === now.getMonth());
                if (index >= 0) {
                  setCalendarMonth(index);
                  setSelectedCalendarDay(now.getDate());
                }
              }}>Hoy</button>
            </div>
            <div className="calendar-filters" aria-label="Filtrar calendario">
              {([["all", "Todo"], ["task", "Tareas"], ["project", "Proyectos"], ["holiday", "Ausencias"]] as [CalendarFilter, string][]).map(([value, label]) => <button key={value} className={calendarFilter === value ? "active" : ""} onClick={() => setCalendarFilter(value)}>{label}</button>)}
            </div>
          </header>

          <section className="calendar-insight-grid">
            <button
              type="button"
              className="calendar-top-card calendar-next-card"
              onClick={() => calendarInsights.nextEvent && openCalendarEvent(calendarInsights.nextEvent)}
              disabled={!calendarInsights.nextEvent}
            >
              <div className="calendar-card-kicker"><span>PRÓXIMO HITO</span><Target /></div>
              {calendarInsights.nextEvent ? <>
                <strong>{calendarInsights.nextEvent.title}</strong>
                <p>{String(calendarInsights.nextEvent.day).padStart(2, "0")} {calendarMonths[calendarMonth].short} · {calendarInsights.nextEvent.account || calendarInsights.nextEvent.meta}</p>
                <small>{Math.max(0, monthCalendarEvents.filter((event) => event.day >= calendarInsights.nextEvent!.day).length - 1)} hitos después</small>
              </> : <>
                <strong>Mes despejado</strong>
                <p>No quedan hitos fechados en este mes.</p>
              </>}
            </button>

            <article className="calendar-top-card calendar-pulse-card">
              <div className="calendar-card-kicker"><span>PULSO DEL MES</span><Activity /></div>
              <div className="calendar-month-pulse">
                {calendarInsights.weekBuckets.map((week) => <div key={week.index} title={`Semana ${week.index + 1} · ${week.count} eventos`}>
                  <i><b style={{ height: `${Math.max(8, (week.count / calendarInsights.maxWeekCount) * 100)}%` }} /></i>
                  <span>S{week.index + 1}</span>
                </div>)}
              </div>
              <footer>
                <span>{monthCalendarEvents.length} eventos</span>
                <strong>{calendarInsights.busiestWeek ? `${calendarInsights.busiestWeek.startDay}–${calendarInsights.busiestWeek.endDay} ${calendarMonths[calendarMonth].short}` : "Sin carga"}</strong>
              </footer>
            </article>

            <article className="calendar-top-card calendar-cross-card">
              <div className="calendar-card-kicker"><span>CRUCES</span><AlertTriangle /></div>
              <strong>{calendarInsights.crossings.length ? `${calendarInsights.crossings.length} día${calendarInsights.crossings.length === 1 ? "" : "s"} a vigilar` : "Todo encaja"}</strong>
              <div className="calendar-cross-list">
                {calendarInsights.crossings.map((crossing) => <button key={crossing.day} type="button" onClick={() => { setCalendarFilter("all"); setSelectedCalendarDay(crossing.day); }}>
                  <span>{String(crossing.day).padStart(2, "0")} {calendarMonths[calendarMonth].short}</span>
                  <small>{crossing.holidayCount && crossing.workCount ? "ausencia + trabajo" : `${crossing.events.length} hitos`}</small>
                </button>)}
                {!calendarInsights.crossings.length && <p>Sin concentraciones relevantes este mes.</p>}
              </div>
            </article>
          </section>

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
                  const now = new Date();
                  const isToday = calendarMonths[calendarMonth].year === now.getFullYear()
                    && (monthIndexByCode[calendarMonths[calendarMonth].short] + 7) === now.getMonth()
                    && day === now.getDate();
                  const visibleDayItems = dayEvents.slice(0, 2);
                  const hiddenDayItems = dayEvents.slice(2);
                  const hiddenTasks = hiddenDayItems.filter((event) => event.kind === "task").length;
                  const hiddenNonTasks = hiddenDayItems.length - hiddenTasks;
                  const moreLabel = hiddenNonTasks === 0
                    ? `+${hiddenTasks} tarea${hiddenTasks === 1 ? "" : "s"}`
                    : `+${hiddenDayItems.length} ítems`;
                  return <div
                    key={day}
                    className={"calendar-day" + (isToday ? " today" : "") + (dayEvents.length ? " has-events" : "") + (selectedCalendarDay === day ? " selected" : "")}
                    onClick={() => setSelectedCalendarDay(day)}
                  >
                    <div className="calendar-day-head">
                      <span>{day}</span>
                      <button
                        className="calendar-day-add"
                        title="Añadir tarea"
                        aria-label={`Añadir tarea el día ${day}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCalendarTaskDate(calendarIsoDate(day));
                          setCalendarTaskName("");
                        }}
                      ><Plus /></button>
                    </div>
                    <div className="calendar-day-items">
                      {visibleDayItems.map((event) => <button
                        key={event.key}
                        className={"calendar-chip chip-" + event.kind}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openCalendarEvent(event);
                        }}
                        title={event.title}
                      ><i /><span>{event.time ? `${event.time} · ` : ""}{event.title}</span></button>)}
                      {hiddenDayItems.length > 0 && <button
                        className="calendar-more"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setCalendarFilter("all");
                          setSelectedCalendarDay(day);
                        }}
                      >{moreLabel}</button>}
                    </div>
                  </div>;
                })}
              </div>
            </section>

            <aside className="calendar-side-stack">
              <section className={"chronology-card compact-chronology" + (selectedCalendarDay != null ? " is-day-detail" : "")}>
                <div className="chronology-head module-head">
                  <div>
                    <span>{selectedCalendarDay != null ? "DÍA" : "AGENDA"}</span>
                    <h2>{selectedCalendarDay != null ? `${String(selectedCalendarDay).padStart(2, "0")} ${calendarMonths[calendarMonth].short}` : "Fechas clave"}</h2>
                  </div>
                  <strong>{selectedCalendarDay != null ? selectedCalendarDayEvents.length : visibleCalendarEvents.length}</strong>
                </div>

                {selectedCalendarDay != null ? <div className="chronology-list calendar-day-detail-list">
                  {selectedCalendarDayEvents.map((event) => <button
                    key={event.key}
                    className={"calendar-event event-" + event.kind}
                    onClick={() => openCalendarEvent(event)}
                  >
                    <i />
                    <span>
                      <strong>{event.time ? `${event.time} · ` : ""}{event.title}</strong>
                      <small>
                        {event.meta}
                        {event.account ? " · " + event.account : ""}
                        {event.status ? " · " + event.status : ""}
                      </small>
                    </span>
                    <ChevronRight />
                  </button>)}
                  {selectedCalendarDayEvents.length === 0 && <div className="calendar-empty compact"><CalendarDays /><strong>Sin ítems este día</strong><span>El calendario, por una vez, no tiene nada que objetar.</span></div>}
                </div> : <div className="chronology-list">
                  {visibleEventDays.slice(0, 8).map((day) => <button className="chronology-day calendar-agenda-day" key={day} onClick={() => setSelectedCalendarDay(day)}>
                    <div className="date-stamp"><strong>{day.toString().padStart(2, "0")}</strong><span>{calendarMonths[calendarMonth].short}</span></div>
                    <div className="day-events">
                      {visibleCalendarEvents.filter((event) => event.day === day).slice(0, 2).map((event) => <span key={event.key} className={"calendar-event-preview event-" + event.kind}>
                        <i />
                        <span><strong>{event.time ? `${event.time} · ` : ""}{event.title}</strong><small>{event.meta}{event.account ? " · " + event.account : ""}</small></span>
                      </span>)}
                    </div>
                  </button>)}
                  {visibleEventDays.length === 0 && <div className="calendar-empty compact"><CalendarDays /><strong>Sin fechas clave</strong></div>}
                </div>}
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
        <section className="mobile-only mobile-accounts">
          <header className="mobile-screen-head"><span>CUENTAS</span><h1>Vista macro</h1><p>{accountViewStats.items.length} cuentas · {accountViewStats.activeItems.length} activas</p></header>
          <div className="mobile-card-carousel mobile-account-carousel">
            {accountViewStats.items.map((account)=><button key={account.name} className={`mobile-account-card ${account.status === "Activa" ? "" : "is-inactive"}`} onClick={()=>setSelectedAccount(account)}>
              <div className="mobile-card-kicker"><span>{account.status === "Activa" ? (account.contract || "CUENTA") : "INACTIVA"}</span><i style={{background:account.color}} /></div>
              <strong>{account.name}</strong>
              <small>{account.activeProjects} proyectos activos · {account.activeTasks} tareas abiertas</small>
              <div className="mobile-account-next"><span>PRÓXIMO</span><b>{account.nextDeadline?.name || "Nada al horizonte"}</b><small>{account.nextDeadline?.date || "Sin fecha próxima"}</small></div>
              <div className="mobile-account-metrics"><span><b>{account.projects}</b><small>proyectos</small></span><span><b>{account.tasks ?? account.activeTasks}</b><small>tareas</small></span><span><b>{account.pulse}</b><small>pulso</small></span></div>
            </button>)}
          </div>
        </section>

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
                const next = accountViewStats.activeItems.flatMap((account) => account.nextDeadline ? [{ account: account.name, task: account.nextDeadline }] : [])
                  .sort((a,b) => new Date(a.task.dateStart || 0).getTime() - new Date(b.task.dateStart || 0).getTime())[0];
                return next ? <><strong>{next.task.name}</strong><small>{next.account} · {next.task.date}</small></> : <><strong>Sin urgencias</strong><small>No hay fechas próximas</small></>;
              })()}
            </div>
          </article>
        </section>

        <section className="accounts-grid accounts-grid-redesign">
          {accountViewStats.items.filter((account) => !q || account.name.toLowerCase().includes(q)).map((account) => {
            const accountProjects = projects.filter((project) => project.account === account.name).slice(0, 3);
            return <article
              key={account.name}
              className={`account-card account-card-redesign ${account.status === "Activa" ? "" : "is-inactive"} ${dragging?.startsWith("task") || dragging?.startsWith("project") ? "is-drop-ready" : ""}`}
              style={{ "--account-color": account.color } as React.CSSProperties}
              onClick={() => setSelectedAccount(account)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedAccount(account);
                }
              }}
              tabIndex={0}
              role="button"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.stopPropagation(); moveToAccount(event, account.name); }}
            >
              <div className="account-card-meta">
                <span className="account-micro-accent" />
                <span className="account-contract">{account.contract || "CUENTA"}</span>
                <span className={`account-priority ${account.status === "Activa" ? "" : "is-inactive"}`}>{account.status === "Activa" ? account.priority : "Inactiva"}</span>
              </div>

              <div className="account-card-center">
                <h2>{account.name}</h2>
                <p>{account.activeProjects} proyectos activos · {account.activeTasks} tareas abiertas</p>

                <div className={`account-next-hit ${account.nextDeadline ? "" : "is-empty"}`}>
                  <span>PRÓXIMO</span>
                  <strong>{account.nextDeadline?.name || "Nada al horizonte"}</strong>
                  <small>{account.nextDeadline ? account.nextDeadline.date : "Sin fecha próxima"}</small>
                </div>
              </div>

              <div className="account-card-bottom">
                <div className="account-project-chips">
                  {accountProjects.map((project) => <span key={project.id}>{project.name}</span>)}
                  {!accountProjects.length && <span className="muted">Sin proyectos activos</span>}
                </div>

                <div className="account-metrics">
                  <span><i><FolderKanban /></i><b>{account.projects}</b><small>proyectos</small></span>
                  <span><i><ListTodo /></i><b>{account.tasks ?? account.activeTasks}</b><small>tareas</small></span>
                  <span><i><CircleGauge /></i><b>{account.pulse}</b><small>pulso</small></span>
                </div>
              </div>
            </article>;
          })}
        </section>
      </TabsContent>

      <TabsContent value="projects" className="view-content projects-view">
        <section className="projects-hero-grid">
          <article className="projects-pulse-card">
            <div className="projects-widget-kicker"><span>PULSO DE PROYECTOS</span><i /></div>
            <div className="projects-pulse-copy">
              <strong>{projectViewStats.active.length}</strong>
              <span>proyectos activos</span>
              <div className="projects-pulse-meta">
                <span><b>{projectViewStats.byStatus["Ideas"] || 0}</b><small>ideas</small></span>
                <span><b>{projectViewStats.byStatus["Producción"] || 0}</b><small>producción</small></span>
                <span><b>{projectViewStats.byStatus["Seguimiento"] || 0}</b><small>seguimiento</small></span>
              </div>
            </div>
            <div className="projects-pulse-stack">
              {projectViewStats.attention.map((item,index)=><button key={item.project.id} onClick={()=>setSelectedProjectPage(item.project)}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{item.project.name}</strong><small>{item.project.account} · {item.projectTasks.length} tareas abiertas</small></div>
                <ArrowUpRight />
              </button>)}
            </div>
          </article>

          <article className="projects-milestones-card">
            <header className="module-head"><div><span>AGENDA</span><h2>Próximos hitos</h2></div><CalendarDays /></header>
            <div className="projects-milestones-list">
              {projectViewStats.milestones.map((item,index)=><button key={item.project.id} onClick={()=>setSelectedProjectPage(item.project)}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{item.nextTask?.name}</strong><small>{item.project.name} · {item.nextTask?.date}</small></div>
                <ArrowUpRight />
              </button>)}
              {!projectViewStats.milestones.length&&<div className="projects-widget-empty">Sin hitos próximos</div>}
            </div>
          </article>

          <article className="projects-risk-card">
            <div className="projects-widget-kicker"><span>ATENCIÓN</span><i /></div>
            <strong>{projectViewStats.highPriority.length}</strong>
            <small>proyectos en prioridad alta</small>
            <div className="projects-risk-next">
              <span>MÁS CARGADO</span>
              <strong>{projectViewStats.busy[0]?.project.name || "Sin carga"}</strong>
              <small>{projectViewStats.busy[0] ? `${projectViewStats.busy[0].projectTasks.length} tareas abiertas · ${projectViewStats.busy[0].project.account}` : "No hay proyectos activos"}</small>
            </div>
          </article>
        </section>

        <section className="kanban-board project-board project-board-complete project-board-with-widgets">{projectBoardStatuses.map((status) => { const items = filteredProjects.filter((project) => project.status === status); return <div key={status} className={`kanban-column ${dragging?.startsWith("project") ? "is-drop-ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}><div className="column-head"><span>{status === "Standby" ? "Stand by" : status}</span><b>{items.length}</b><Plus /></div><div className="column-body">{items.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProjectPage(project)} onDragStart={() => setDragging(`project:${project.id}`)} onAssignPerson={(person) => assignPerson("project", project.id, person)} />)}{items.length === 0 && <EmptyDrop />}</div></div>; })}</section>
      </TabsContent>

      <TabsContent value="tasks" className="view-content tasks-view">
        <section className="mobile-only mobile-work">
          <header className="mobile-screen-head">
            <span>TRABAJO</span>
            <h1>Operativa</h1>
            <div className="mobile-segmented">
              <button className={mobileWorkMode==="tasks"?"active":""} onClick={()=>setMobileWorkMode("tasks")}>Tareas</button>
              <button className={mobileWorkMode==="projects"?"active":""} onClick={()=>setMobileWorkMode("projects")}>Proyectos</button>
            </div>
          </header>

          {mobileWorkMode==="tasks" ? <>
            <div className="mobile-lane-strip">
              {TASK_LANES.map((lane)=><button key={lane} className={mobileTaskLane===lane?"active":""} onClick={()=>setMobileTaskLane(lane)}><span>{lane}</span><b>{taskViewStats.laneCounts[lane]}</b></button>)}
            </div>
            <div className="mobile-work-list">
              {filteredTasks.filter((task)=>taskLane(task)===mobileTaskLane).map((task)=><button key={task.id} className="mobile-work-card" onClick={()=>setDetail({kind:"task",...task})}>
                <div className="mobile-work-card-top"><span>{task.account}</span><b>{task.date}</b></div>
                <strong>{task.name}</strong><small>{task.project}</small>
                <div className="mobile-work-card-bottom"><PeopleStack people={task.people}/><ChevronRight/></div>
              </button>)}
              {!filteredTasks.some((task)=>taskLane(task)===mobileTaskLane)&&<div className="mobile-empty-card">Nada aquí.</div>}
            </div>
          </> : <>
            <div className="mobile-work-list">
              {filteredProjects.map((project)=>{
                const projectTasks=allTasks.filter((task)=>task.project===project.name);
                const open=projectTasks.filter((task)=>!["Terminado","Cancelado"].includes(task.status)).length;
                return <button key={project.id} className="mobile-project-card" onClick={()=>setSelectedProjectPage(project)}>
                  <div className="mobile-work-card-top"><span>{project.account}</span><b>{project.status}</b></div>
                  <strong>{project.name}</strong><small>{project.type} · {project.timing}</small>
                  <div className="mobile-project-progress"><span><b>{projectTasks.length}</b> tareas</span><span><b>{open}</b> abiertas</span></div>
                  <ChevronRight/>
                </button>;
              })}
            </div>
          </>}
        </section>

        <section className="tasks-hero-grid">
          <article className="tasks-pulse-card">
            <div className="tasks-widget-kicker"><span>PULSO DE TAREAS</span><i /></div>
            <div className="tasks-pulse-copy">
              <strong>{taskViewStats.active.length}</strong>
              <span>tareas activas</span>
              <div className="tasks-pulse-meta">
                {DASHBOARD_TASK_LANES.map((lane) => <span key={lane}><b>{taskViewStats.laneCounts[lane]}</b><small>{lane.toLowerCase()}</small></span>)}
              </div>
            </div>
            <div className="tasks-pulse-stack">
              {taskViewStats.visualTasks.map((task,index) => <button key={task.id} className={`tasks-pulse-mini pulse-task-${index+1}`} onClick={() => setDetail({ kind:"task", ...task })}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{task.name}</strong><small>{task.project} · {task.date}</small></div>
                <ArrowUpRight />
              </button>)}
              {!taskViewStats.visualTasks.length && <div className="tasks-pulse-empty"><Check /><span>Sin tareas activas</span></div>}
            </div>
          </article>

          <article className="tasks-attention-card">
            <header className="module-head"><div><span>PRIORIDAD</span><h2>Necesitan atención</h2></div><AlertTriangle /></header>
            <div className="tasks-attention-list">
              {taskViewStats.attention.map((task,index) => <button key={task.id} onClick={() => setDetail({ kind:"task", ...task })}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{task.name}</strong><small>{task.account} · {task.date}</small></div>
                <ArrowUpRight />
              </button>)}
            </div>
          </article>

          <article className="tasks-window-card">
            <div className="tasks-widget-kicker"><span>PRÓXIMAS 48H</span><i /></div>
            <strong>{taskViewStats.next48.length}</strong>
            <small>tareas con fecha</small>
            <div className="tasks-window-next">
              <span>{taskViewStats.next48.length ? "SIGUIENTE" : "ESTADO"}</span>
              <strong>{taskViewStats.next48[0]?.name || "Sin entregas inmediatas"}</strong>
              <small>{taskViewStats.next48[0] ? `${taskViewStats.next48[0].date} · ${taskViewStats.next48[0].account}` : "Las próximas 48h están despejadas"}</small>
            </div>
          </article>
        </section>

        <section className="kanban-board task-board active-task-board task-board-four task-board-unified">
          {taskBoardLanes.map((lane) => {
            const items = filteredTasks.filter((task) => taskLane(task) === lane);
            return <div key={lane} className={`kanban-column task-lane task-lane-${lane.toLowerCase().replaceAll(" ","-")} ${dragging?.startsWith("task") ? "is-drop-ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleTaskLaneDrop(event, lane)}>
              <div className="column-head"><span>{lane}</span><b>{items.length}</b><Plus /></div>
              <div className="column-body">{items.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setDetail({ kind: "task", ...task })} onDragStart={() => setDragging(`task:${task.id}`)} onAssignPerson={(person) => assignPerson("task", task.id, person)} />)}{items.length === 0 && <EmptyDrop />}</div>
            </div>;
          })}
        </section>
      </TabsContent>

      <TabsContent value="team" className="view-content team-view-complete">
        <section className="mobile-only mobile-team">
          <header className="mobile-screen-head"><span>EQUIPO</span><h1>Capacidad</h1><p>{team.length} personas · {team.filter((person)=>person.load>=75).length} carga alta</p></header>
          <div className="mobile-team-list">
            {[...team].sort((a,b)=>b.load-a.load).map((person)=>{
              const performance=personPerformance(person);
              return <button key={person.id} className="mobile-person-card" onClick={()=>setSelectedPerson(person)}>
                <div className={`avatar avatar-${person.tone}`}>{person.initials}</div>
                <div><strong>{person.name}</strong><small>{person.role}</small><span>{person.activeProjects} proyectos · {person.activeTasks} tareas</span></div>
                <div className="mobile-person-load"><b>{person.load}%</b><i><em style={{width:`${person.load}%`}} /></i><small>{performance.ratio ?? "—"}/100</small></div>
              </button>;
            })}
          </div>
        </section>

        <section className="team-hero-grid">
          <article className="team-pulse-card">
            <div className="team-widget-kicker"><span>PULSO DEL EQUIPO</span><i /></div>
            <div className="team-pulse-copy">
              <strong>{team.length}</strong>
              <span>personas activas</span>
              <div className="team-pulse-meta">
                <span><b>{teamViewStats.highLoad.length}</b><small>carga alta</small></span>
                <span><b>{teamViewStats.available.length}</b><small>disponibles</small></span>
                <span><b>{teamViewStats.enoughEvidence.length}</b><small>muestra sólida</small></span>
              </div>
            </div>
            <div className="team-pulse-stack">
              {teamViewStats.spotlight.map((person,index)=>{
                const performance=personPerformance(person);
                return <button key={person.id} onClick={()=>setSelectedPerson(person)}>
                  <span>{String(index+1).padStart(2,"0")}</span>
                  <div><strong>{person.name}</strong><small>{person.activeProjects} proyectos · {person.activeTasks} tareas · {confidence(performance.count)}</small></div>
                  <b>{performance.ratio ?? "—"}</b>
                </button>;
              })}
            </div>
          </article>

          <article className="team-capacity-card">
            <header className="module-head"><div><span>DISPONIBILIDAD</span><h2>Dónde hay hueco</h2></div><Users /></header>
            <div className="team-capacity-list">
              {teamViewStats.capacity.map((person,index)=><button key={person.id} onClick={()=>setSelectedPerson(person)}>
                <span>{String(index+1).padStart(2,"0")}</span>
                <div><strong>{person.name}</strong><small>{person.activeProjects} proyectos · {person.activeTasks} tareas</small></div>
                <b>{person.load}%</b>
              </button>)}
            </div>
          </article>

          <article className="team-coverage-card">
            <div className="team-widget-kicker"><span>COBERTURA</span><i /></div>
            <strong>{teamViewStats.enoughEvidence.length}<small> / {team.length}</small></strong>
            <span>con muestra suficiente</span>
            <div className="team-coverage-next">
              <b>{teamViewStats.fragile.length}</b>
              <small>perfiles necesitan más evidencia</small>
              <strong>{teamViewStats.fragile[0]?.name || "Cobertura sólida"}</strong>
            </div>
          </article>
        </section>

        <section className="team-toolbar">
          <div className="team-filter-chips">
            <button className={teamRoleFilter==="all"?"active":""} onClick={()=>setTeamRoleFilter("all")}>Todos</button>
            <button className={teamRoleFilter==="art"?"active":""} onClick={()=>setTeamRoleFilter("art")}>Dirección de Arte</button>
            <button className={teamRoleFilter==="copy"?"active":""} onClick={()=>setTeamRoleFilter("copy")}>Copy</button>
          </div>
          <label>Ordenar
            <select value={teamSort} onChange={(event)=>setTeamSort(event.target.value as typeof teamSort)}>
              <option value="activity">Actividad</option>
              <option value="load">Carga</option>
              <option value="ratio">Índice observado</option>
              <option value="evidence">Muestra</option>
            </select>
          </label>
        </section>

        <section className="team-layout team-layout-redesign">
          <div className="team-grid team-grid-redesign">
            {[...team]
              .filter((person) => !q || (person.name + " " + person.role + " " + person.skills.join(" ")).toLowerCase().includes(q))
              .filter((person) => teamRoleFilter==="all" || (teamRoleFilter==="art" ? person.role.toLocaleLowerCase("es").includes("arte") : person.role.toLocaleLowerCase("es").includes("copy")))
              .sort((a,b)=>{
                if(teamSort==="load") return b.load-a.load;
                if(teamSort==="ratio") return (personPerformance(b).ratio ?? -1)-(personPerformance(a).ratio ?? -1);
                if(teamSort==="evidence") return b.evidence-a.evidence;
                return (b.activeProjects*3+b.activeTasks)-(a.activeProjects*3+a.activeTasks);
              })
              .map((person) => {
                const performance = personPerformance(person);
                const dimensionEntries = (Object.keys(dimensionLabels) as DimensionKey[])
                  .map((key)=>({key,label:dimensionLabels[key].label,value:person.dimensions[key]}))
                  .filter((item)=>typeof item.value==="number");
                return <button key={person.name} className="team-card employee-card employee-card-redesign" draggable onClick={() => setSelectedPerson(person)}
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", `person:${person.name}`); setDragging(`person:${person.name}`); }} onDragEnd={() => setDragging(null)}>
                  <div className="employee-profile-main">
                    <div className={`employee-avatar-large avatar-${person.tone}`}><span>{person.initials}</span></div>
                    <h2>{person.name}</h2>
                    <p>{person.role}</p>
                    <div className="employee-evidence-line">
                      <span>{confidence(performance.count)}</span>
                      <small>{performance.count} evaluaciones</small>
                    </div>
                  </div>

                  <div className="employee-project-chips employee-project-chips-profile">
                    {person.activeProjectNames.slice(0,2).map((name)=><span key={name}>{name}</span>)}
                    {person.activeProjectNames.length>2&&<span>+{person.activeProjectNames.length-2}</span>}
                    {!person.activeProjectNames.length&&<span className="muted">Disponible</span>}
                  </div>

                  <div className="employee-profile-stats">
                    <span><b>{person.activeProjects}</b><small>proyectos</small></span>
                    <span><b>{person.load}%</b><small>carga</small></span>
                    <span className="employee-index-stat" style={{"--index-color":ratioColor(performance.ratio)} as React.CSSProperties}><b>{performance.ratio ?? "—"}</b><small>índice</small></span>
                  </div>

                  <div className="employee-dimensions" aria-hidden="true">
                    <span>LECTURA</span>
                    {dimensionEntries.slice(0,4).map((item)=><div key={item.key} className="employee-dimension-row"><div><small>{item.label}</small><b>{oneDecimal(item.value)}</b></div><i><em style={{width:`${Math.min(100,(item.value as number)*20)}%`}} /></i></div>)}
                    {!dimensionEntries.length&&<p>Sin suficiente desglose todavía.</p>}
                  </div>
                </button>;
              })}
          </div>

          <aside className="team-radar-card">
            <Sparkles />
            <span>RADAR DE EQUIPO</span>
            <h2>Lo que merece ojo</h2>

            <div className="team-radar-section">
              <div><small>CARGA ALTA</small><b>{teamViewStats.highLoad.length}</b></div>
              {teamViewStats.highestLoad.map((person)=><button key={person.id} onClick={()=>setSelectedPerson(person)}><span>{person.name}</span><b>{person.load}%</b></button>)}
              {!teamViewStats.highLoad.length&&<p>Nadie en zona alta.</p>}
            </div>

            <div className="team-radar-section">
              <div><small>DISPONIBLES</small><b>{teamViewStats.available.length}</b></div>
              {teamViewStats.capacity.slice(0,2).map((person)=><button key={person.id} onClick={()=>setSelectedPerson(person)}><span>{person.name}</span><b>{person.load}%</b></button>)}
            </div>

            <div className="team-radar-section">
              <div><small>POCA MUESTRA</small><b>{teamViewStats.fragile.length}</b></div>
              {teamViewStats.lowestEvidence.map((person)=><button key={person.id} onClick={()=>setSelectedPerson(person)}><span>{person.name}</span><b>{person.evidence}</b></button>)}
            </div>

            <p className="team-radar-note">El índice observado se interpreta junto a la muestra. La carga es una señal operativa separada, no una nota de desempeño.</p>
          </aside>
        </section>
      </TabsContent>

      <TabsContent value="holidays" className="view-content holidays-view-redesign">
        <section className="holidays-shell-redesign">
          <section className="holidays-hero-grid">
            <article className="holidays-hero-card dark">
              <span>DISPONIBILIDAD PRÓXIMA</span>
              <strong>{Math.max(0, team.length - upcomingPeopleAway.length)}</strong>
              <small>personas disponibles</small>
              <b>{upcomingPeopleAway.length} con ausencia próxima</b>
            </article>
            <article className="holidays-hero-card light">
              <span>VACACIONES BASE</span>
              <div><strong>{avgVacationUsed}</strong><small>días usados de media</small></div>
              <b>{avgVacationRemaining} restantes de media</b>
            </article>
            <article className="holidays-hero-card lime">
              <span>PRÓXIMOS TURNOS</span>
              <strong>{holidays.filter((holiday) => holiday.category === "Turno especial" && holiday.end && new Date(holiday.end + "T23:59:59").getTime() >= Date.now()).length}</strong>
              <small>Semana Santa / Navidad</small>
              <b>{holidays.filter((holiday) => holiday.category === "Extra" && holiday.end && new Date(holiday.end + "T23:59:59").getTime() >= Date.now()).length} extras registrados</b>
            </article>
          </section>

          <section className="holidays-main-panel">
            <header className="holidays-toolbar-redesign">
              <div>
                <span>8 SEMANAS</span>
                <h2>Ausencias reales del equipo</h2>
              </div>
              <div className="holidays-filter-row">
                {(["Todas","Vacaciones","Extras","Semana Santa","Navidad"] as const).map((filter) => (
                  <button key={filter} className={holidayFilter === filter ? "active" : ""} onClick={() => setHolidayFilter(filter)}>{filter}</button>
                ))}
              </div>
            </header>

            <div className="holidays-timeline-redesign">
              <div className="holiday-grid-head">
                <span>PERSONA</span>
                {holidayWeekLabels.map((date) => <b key={date.toISOString()}>{date.toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).replace(".","").toUpperCase()}</b>)}
              </div>

              <div className="holiday-grid-body">
                {team.map((person) => {
                  const rows = filteredHolidayRows.filter((holiday) => holiday.name === person.name && holiday.start && holiday.end);
                  return <div className="holiday-person-row" key={person.id}>
                    <div className="holiday-person-meta">
                      <span className={`avatar avatar-${person.tone}`}>{person.initials}</span>
                      <div><strong>{person.name}</strong><small>{person.role}</small></div>
                      <b>{person.leaveUsage?.remainingVacationDays ?? "—"}</b>
                    </div>
                    <div className="holiday-track-redesign">
                      {globalHolidayRows.map((holiday) => {
                        const pos = timelinePercent(holiday.start, holidayWindowStart, holidayWindowEnd);
                        if (pos == null || pos < 0 || pos > 100) return null;
                        return <i key={holiday.id || holiday.url} className="global-holiday-marker" style={{ left: `${pos}%` }} title={`${holiday.name} · ${holiday.label}`} />;
                      })}
                      {rows.map((holiday) => {
                        const left = timelinePercent(holiday.start, holidayWindowStart, holidayWindowEnd);
                        const right = timelinePercent(holiday.end, holidayWindowStart, holidayWindowEnd);
                        if (left == null || right == null || right < 0 || left > 100) return null;
                        const width = Math.max(2.2, Math.min(100, right) - Math.max(0, left) + 1.8);
                        const kind = holiday.type === "Libres" ? "vacation" : holiday.type === "Convenio" || holiday.type === "Puente" ? "extra" : holiday.type === "Semana Santa" ? "easter" : holiday.type === "Navidad" ? "christmas" : "other";
                        return <span key={holiday.id || holiday.url} className={`holiday-block-redesign ${kind}`} style={{ left: `${Math.max(0,left)}%`, width: `${width}%` }} title={`${holiday.type} · ${holiday.label}`}>
                          <b>{holiday.type}</b><small>{holiday.label}</small>
                        </span>;
                      })}
                    </div>
                  </div>;
                })}
              </div>
            </div>

            <footer className="holidays-legend-redesign">
              <span><i className="vacation" /> Vacaciones</span>
              <span><i className="extra" /> Convenio / Puente</span>
              <span><i className="easter" /> Semana Santa</span>
              <span><i className="christmas" /> Navidad</span>
              <span><i className="public" /> Festivo común</span>
              <b>El número junto a cada persona es su saldo de vacaciones base.</b>
            </footer>
          </section>

          <section className="holidays-balance-grid">
            {team.map((person) => <article key={person.id} className="holiday-balance-card">
              <header><span className={`avatar avatar-${person.tone}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small></div></header>
              <div className="holiday-balance-main">
                <strong>{person.leaveUsage?.remainingVacationDays ?? "—"}</strong><span>días base restantes</span>
              </div>
              <div className="holiday-balance-meta">
                <span><b>{person.leaveUsage?.usedVacationDays ?? "—"}</b><small>usados</small></span>
                <span><b>{person.leaveAllowance?.convenio ?? "—"}</b><small>convenio</small></span>
                <span><b>{person.leaveAllowance?.puentes ?? "—"}</b><small>puentes</small></span>
              </div>
            </article>)}
          </section>
        </section>
      </TabsContent>
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
                <label><span>Cuenta</span><select value={selectedProjectPage.account} onChange={(event) => updateProjectWorkspace({ account: event.target.value })}>{accountOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
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
                  <select value={taskLane(task)} onChange={(event) => updateWorkspaceTaskLane(task, event.target.value as TaskLane)}>{TASK_LANES.map((status) => <option key={status}>{status}</option>)}</select>
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

    <Dialog open={Boolean(selectedAccount)} onOpenChange={(open) => {
      if (!open) {
        setSelectedAccount(null);
        setAccountTaskFilter("all");
        setAccountProjectFilter("all");
      }
    }}>
      <DialogContent className="full-detail-dialog account-cockpit">{selectedAccount && (() => {
        const accountProjects = projects.filter((project) => project.account === selectedAccount.name);
        const accountTasks = allTasks.filter((task) => task.account === selectedAccount.name);
        const openTasks = accountTasks.filter((task) => !["Terminado", "Cancelado"].includes(task.status));
        const completedTasks = accountTasks.filter((task) => task.status === "Terminado");
        const cancelledTasks = accountTasks.filter((task) => task.status === "Cancelado");
        const currentPeople = Array.from(new Set([
          ...accountProjects.flatMap((project) => project.people),
          ...openTasks.flatMap((task) => task.people),
          ...(selectedAccount.assignedPeople || []),
        ].filter((name) => name && name !== "Por asignar")));
        const peopleRows = currentPeople.map((name) => {
          const person = team.find((item) => item.name === name);
          return {
            name,
            person,
            tasks: openTasks.filter((task) => task.people.includes(name)).length,
            projects: accountProjects.filter((project) => project.people.includes(name)).length,
          };
        }).sort((a, b) => (b.tasks + b.projects) - (a.tasks + a.projects));

        const taskStatusEntries = TASK_LANES.map((lane) => ({
          lane,
          count: accountTasks.filter((task) => taskLane(task) === lane).length,
        })).filter((item) => item.count > 0);
        const taskStatusMax = Math.max(1, ...taskStatusEntries.map((item) => item.count));

        const projectStatusEntries = projectBoardStatuses.map((status) => ({
          status,
          count: accountProjects.filter((project) => project.status === status).length,
        })).filter((item) => item.count > 0);
        const projectStatusMax = Math.max(1, ...projectStatusEntries.map((item) => item.count));

        const today = localDateKey(new Date());
        const upcomingTasks = openTasks
          .filter((task) => task.dateStart && (dateOnly(task.dateStart) || "") >= today)
          .sort((a, b) => String(a.dateStart || "").localeCompare(String(b.dateStart || "")));
        const nextTask = upcomingTasks[0] || openTasks
          .filter((task) => task.dateStart)
          .sort((a, b) => String(a.dateStart || "").localeCompare(String(b.dateStart || "")))[0] || null;

        const completionBase = Math.max(1, accountTasks.length - cancelledTasks.length);
        const completionRate = accountTasks.length ? Math.round((completedTasks.length / completionBase) * 100) : 0;

        const displayTasks = (accountTaskFilter === "all"
          ? openTasks
          : accountTasks.filter((task) => taskLane(task) === accountTaskFilter))
          .slice()
          .sort((a, b) => {
            if (!a.dateStart && !b.dateStart) return a.name.localeCompare(b.name, "es");
            if (!a.dateStart) return 1;
            if (!b.dateStart) return -1;
            return String(a.dateStart).localeCompare(String(b.dateStart));
          })
          .slice(0, 6);

        const displayProjects = (accountProjectFilter === "all"
          ? accountProjects
          : accountProjects.filter((project) => project.status === accountProjectFilter))
          .slice(0, 6);

        const contrast = accountContrast(selectedAccount.color);

        return <div
          className="account-cockpit-scroll"
          style={{ "--account-color": selectedAccount.color, "--account-contrast": contrast } as React.CSSProperties}
        >
          <header className="account-cockpit-header account-cockpit-header-compact">
            <div className="account-cockpit-avatar"><span>{selectedAccount.name.slice(0,2).toUpperCase()}</span></div>
            <div className="account-cockpit-identity">
              <span className="account-cockpit-kicker">FICHA DE CUENTA</span>
              <DialogTitle>{selectedAccount.name}</DialogTitle>
              <DialogDescription>{selectedAccount.contract} · Prioridad {selectedAccount.priority}</DialogDescription>
              <div className="account-cockpit-project-chips">
                <span>{selectedAccount.status || "Inactiva"}</span>
                {accountProjects.slice(0,2).map((project)=><span key={project.id}>{project.name}</span>)}
                {accountProjects.length>2&&<span>+{accountProjects.length-2}</span>}
              </div>
            </div>
            <div className="account-quick-kpis">
              <div><small>PULSO</small><strong>{selectedAccount.pulse}%</strong><span>Actividad de cuenta</span></div>
              <div><small>PROYECTOS</small><strong>{accountProjects.length}</strong><span>En cartera</span></div>
              <div><small>TAREAS</small><strong>{openTasks.length}</strong><span>Abiertas</span></div>
              <div><small>EQUIPO</small><strong>{currentPeople.length}</strong><span>Implicados</span></div>
            </div>
          </header>

          <section className={`account-settings-card ${accountEditing ? "is-editing" : ""}`}>
            <div className="account-settings-summary">
              <div className="account-settings-intro">
                <span>PERFIL DE CUENTA</span>
                <h3>Configuración</h3>
              </div>
              <div className="account-settings-summary-data">
                <div><small>ESTADO</small><strong>{selectedAccount.status || "—"}</strong></div>
                <div><small>PRIORIDAD</small><strong>{selectedAccount.priority || "—"}</strong></div>
                <div><small>CONTRATO</small><strong>{selectedAccount.contract || "—"}</strong></div>
              </div>
              <div className="account-settings-summary-team">
                <small>EQUIPO ASIGNADO</small>
                <div className="account-summary-avatars">
                  {(selectedAccount.assignedPeople || []).slice(0,5).map((name) => {
                    const person = team.find((item) => item.name === name);
                    return <span key={name} title={name} className={`avatar avatar-${person?.tone || "green"}`}>{person?.initials || initials(name)}</span>;
                  })}
                  {(selectedAccount.assignedPeople || []).length > 5 && <b>+{(selectedAccount.assignedPeople || []).length - 5}</b>}
                  {!(selectedAccount.assignedPeople || []).length && <em>Sin asignar</em>}
                </div>
              </div>
              {<button type="button" className="account-settings-toggle" onClick={() => setAccountEditing((value) => !value)}><Settings2 /> {accountEditing ? "Cerrar edición" : "Editar cuenta"}</button>}
            </div>
            {accountEditing && <div className="account-settings-controls">
              <label><span>Nombre de la cuenta</span><input type="text" value={accountDraft?.name ?? selectedAccount.name} disabled={accountSaving} onChange={(event) => setAccountDraft((draft) => draft ? { ...draft, name: event.target.value } : draft)} /></label>
              <label><span>Estado</span><select value={accountDraft?.status ?? selectedAccount.status ?? "Inactiva"} disabled={accountSaving} onChange={(event) => setAccountDraft((draft) => draft ? { ...draft, status: event.target.value } : draft)}>
                {Array.from(new Set([...(liveSchema?.accounts.status.map((option) => option.name) ?? []), "Activa", "Inactiva", selectedAccount.status ?? "Inactiva"])).filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              <label><span>Prioridad</span><select value={accountDraft?.priority ?? selectedAccount.priority} disabled={accountSaving} onChange={(event) => setAccountDraft((draft) => draft ? { ...draft, priority: event.target.value } : draft)}>
                {Array.from(new Set([...(liveSchema?.accounts.priority.map((option) => option.name) ?? []), selectedAccount.priority])).filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              <label><span>Contrato</span><select value={accountDraft?.contract ?? selectedAccount.contract} disabled={accountSaving} onChange={(event) => setAccountDraft((draft) => draft ? { ...draft, contract: event.target.value } : draft)}>
                {Array.from(new Set([...(liveSchema?.accounts.contract.map((option) => option.name) ?? []), selectedAccount.contract])).filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
              <div className="account-settings-people">
                <span>Personas asignadas a la cuenta</span>
                <div className="account-settings-people-grid">
                  {team.map((person) => <label key={person.id} className="account-person-option">
                    <input type="checkbox" checked={(accountDraft?.assignedPeople ?? selectedAccount.assignedPeople ?? []).includes(person.name)} disabled={accountSaving} onChange={(event) => setAccountDraft((draft) => draft ? { ...draft, assignedPeople: event.target.checked ? [...draft.assignedPeople, person.name] : draft.assignedPeople.filter((name) => name !== person.name) } : draft)} />
                    <i className={`avatar avatar-${person.tone}`}>{person.initials}</i>
                    <b>{person.name}</b>
                  </label>)}
                </div>
                <small>Asignación directa a la cuenta. No modifica las personas de sus proyectos o tareas.</small>
              </div>
              {<button type="button" className="account-settings-save" disabled={accountSaving || !accountDraft || (accountDraft.name === selectedAccount.name && accountDraft.status === selectedAccount.status && accountDraft.priority === selectedAccount.priority && accountDraft.contract === selectedAccount.contract && JSON.stringify([...accountDraft.assignedPeople].sort()) === JSON.stringify([...(selectedAccount.assignedPeople || [])].sort()))} onClick={saveAccount}>
                <Save /> {accountSaving ? "Guardando..." : "Guardar cambios"}
              </button>}
            </div>}
          </section>

          <section className="account-cockpit-bento">
            <article className="account-workload-card">
              <div className="account-cockpit-module-head">
                <div><span>ESTADO DE TAREAS</span><h3>Volumen por fase</h3></div>
                <ListTodo />
              </div>
              <div className="account-task-state-list">
                {taskStatusEntries.map((item) => <button
                  type="button"
                  key={item.lane}
                  className={"account-task-state " + (accountTaskFilter === item.lane ? "active" : "")}
                  aria-pressed={accountTaskFilter === item.lane}
                  onClick={() => setAccountTaskFilter((current) => current === item.lane ? "all" : item.lane)}
                  style={{ "--bar": Math.max(7, (item.count / taskStatusMax) * 100) } as React.CSSProperties}
                >
                  <span><b>{item.count}</b><small>{item.lane}</small></span>
                  <i><em /></i>
                </button>)}
                {!taskStatusEntries.length && <div className="account-cockpit-empty">Sin tareas registradas</div>}
              </div>
              <div className="account-chart-hint">Haz clic en un estado para filtrar la lista de tareas.</div>
            </article>

            <article className="account-completion-card">
              <div className="account-cockpit-module-head"><span>CIERRE</span><Check /></div>
              <div className="account-completion-ring" style={{ "--completion": completionRate } as React.CSSProperties}>
                <div><strong>{completionRate}%</strong><small>tareas cerradas</small></div>
              </div>
              <div className="account-completion-copy">
                <span><b>{completedTasks.length}</b><small>terminadas</small></span>
                <span><b>{cancelledTasks.length}</b><small>canceladas</small></span>
              </div>
            </article>

            <article className="account-next-card">
              <div className="account-cockpit-module-head"><span>PRÓXIMO HITO</span><CalendarDays /></div>
              {nextTask ? <button type="button" onClick={() => {
                setSelectedAccount(null);
                setDetail({ kind: "task", ...nextTask });
              }}>
                <span>{nextTask.date || "SIN FECHA"}</span>
                <strong>{nextTask.name}</strong>
                <small>{nextTask.project}</small>
                <ArrowUpRight />
              </button> : <div className="account-next-empty"><Check /><strong>Sin entregas próximas</strong><span>La agenda está despejada.</span></div>}
              <div className="account-next-foot"><b>{upcomingTasks.length}</b><span>tareas próximas con fecha</span></div>
            </article>
          </section>

          <section className="account-pipeline-card">
            <div className="account-cockpit-module-head">
              <div><span>PIPELINE</span><h3>Proyectos por fase</h3></div>
              <FolderKanban />
            </div>
            <div className="account-pipeline-bars">
              {projectStatusEntries.map((item) => <button
                type="button"
                key={item.status}
                className={accountProjectFilter === item.status ? "active" : ""}
                aria-pressed={accountProjectFilter === item.status}
                onClick={() => setAccountProjectFilter((current) => current === item.status ? "all" : item.status)}
                style={{ "--project-bar": Math.max(6, (item.count / projectStatusMax) * 100) } as React.CSSProperties}
              >
                <span><b>{item.status === "Standby" ? "Stand by" : item.status}</b><small>{item.count}</small></span>
                <i><em /></i>
              </button>)}
              {!projectStatusEntries.length && <div className="account-cockpit-empty">Sin proyectos activos</div>}
            </div>
          </section>

          <section className="account-cockpit-lowergrid">
            <article className="account-projects-card">
              <div className="account-cockpit-module-head">
                <div><span>TRABAJO ACTUAL</span><h3>{accountProjectFilter === "all" ? "Proyectos activos" : accountProjectFilter}</h3></div>
                <button type="button" className="account-module-action" onClick={() => {
                  setSearch(selectedAccount.name);
                  setSelectedAccount(null);
                  setActiveView("projects");
                }}>Ver pipeline <ArrowUpRight /></button>
              </div>
              <div className="account-current-projects">
                {displayProjects.map((project) => <button key={project.id} type="button" onClick={() => {
                  setSelectedAccount(null);
                  setSelectedProjectPage(project);
                }}>
                  <span>{project.status}</span>
                  <strong>{project.name}</strong>
                  <small>{project.type} · {allTasks.filter((task) => task.project === project.name && !["Terminado", "Cancelado"].includes(task.status)).length} tareas abiertas</small>
                  <ChevronRight />
                </button>)}
                {!displayProjects.length && <div className="account-cockpit-empty">No hay proyectos en este filtro.</div>}
              </div>
            </article>

            <article className="account-tasks-card">
              <div className="account-cockpit-module-head">
                <div><span>TAREAS</span><h3>{accountTaskFilter === "all" ? "Abiertas y próximas" : accountTaskFilter}</h3></div>
                <button type="button" className="account-module-action" onClick={() => {
                  setSearch(selectedAccount.name);
                  setSelectedAccount(null);
                  setActiveView("tasks");
                }}>Ver tareas <ArrowUpRight /></button>
              </div>
              <div className="account-current-tasks">
                {displayTasks.map((task) => <button key={task.id} type="button" onClick={() => {
                  setSelectedAccount(null);
                  setDetail({ kind: "task", ...task });
                }}>
                  <span>{task.date || "SIN FECHA"}</span>
                  <strong>{task.name}</strong>
                  <small>{task.project} · {taskLane(task)}</small>
                  <ChevronRight />
                </button>)}
                {!displayTasks.length && <div className="account-cockpit-empty">No hay tareas en este filtro.</div>}
              </div>
            </article>

            <article className="account-team-card">
              <div className="account-cockpit-module-head">
                <div><span>EQUIPO</span><h3>Personas implicadas</h3></div>
                <Users />
              </div>
              <div className="account-team-list">
                {peopleRows.slice(0, 6).map((row) => <button
                  key={row.name}
                  type="button"
                  disabled={!row.person}
                  onClick={() => {
                    if (!row.person) return;
                    setSelectedAccount(null);
                    setSelectedPerson(row.person);
                  }}
                >
                  <i className={row.person ? "avatar avatar-" + row.person.tone : "avatar"}>{row.person?.initials || initials(row.name)}</i>
                  <span><strong>{row.name}</strong><small>{row.tasks} tareas · {row.projects} proyectos</small></span>
                  {row.person ? <em style={{ "--person-load": row.person.load } as React.CSSProperties}><i /></em> : null}
                  <ChevronRight />
                </button>)}
                {!peopleRows.length && <div className="account-cockpit-empty">Sin equipo asignado.</div>}
              </div>
            </article>
          </section>
        </div>;
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
            <div className="editor-field"><span>Estado</span>{detail.kind === "task"
              ? <Select value={taskLane(detail)} onValueChange={(value) => updateDetailTaskLane(value as TaskLane)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_LANES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
              : <Select value={detail.status} onValueChange={(value) => updateDetailField("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projectStatusOptions.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>}</div>
            <div className="editor-field"><span>Prioridad</span><Select value={detail.priority} onValueChange={(value) => updateDetailField("priority", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(detail.kind === "task" ? taskPriorityOptions : projectPriorityOptions).map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="editor-field"><span>Cuenta</span><Select value={detail.account} onValueChange={(value) => updateDetailField("account", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accountOptions.map((account) => <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>)}</SelectContent></Select></div>
          {detail.kind === "task"
  ? <label className="editor-field"><span>Proyecto</span><Select value={detail.project} onValueChange={(value) => updateDetailField("project", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select></label>
  : <div className="editor-field"><span>Tipo</span><Select value={detail.type} onValueChange={(value) => updateDetailField("type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projectTypeOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>}
          {detail.kind === "task"
            ? <div className="editor-field full task-schedule-editor">
                <div className="task-schedule-head"><span>Planificación</span><label className="task-all-day-toggle"><span>Todo el día</span><Switch checked={taskIsAllDay(detail)} onCheckedChange={(checked) => {
                  const day = dateOnly(detail.dateStart) || isoDate(new Date());
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
                      const day = dateOnly(detail.dateStart) || isoDate(new Date());
                      const [h,m] = event.target.value.split(":").map(Number);
                      updateDetailField("dateStart", localPlannerIso(day, h * 60 + m));
                    }} /></label>
                    <label><small>Fin</small><input type="time" step="900" value={plannerTimeLabel(plannerMinutes(detail.dateEnd, 10 * 60))} onChange={(event) => {
                      const day = dateOnly(detail.dateStart) || isoDate(new Date());
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
        <div className="sheet-actions sheet-actions-stacked">{<Button className="close-evaluate-button" onClick={() => startEvaluation({ kind: detail.kind, id: detail.id, name: detail.name, people: detail.people })}><Star /> Cerrar y evaluar</Button>}<div>{<Button onClick={saveDetail} className="notion-button"><Save /> Guardar cambios</Button>}</div></div>
      </>}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedPerson)} onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}>
      <DialogContent className="full-detail-dialog employee-cockpit">{selectedPerson && (() => {
        const performance = personPerformance(selectedPerson);
        const sessionSignals = signalBoosts[selectedPerson.name];
        const sessionDimensions = dimensionBoosts[selectedPerson.name] ?? {};
        const dimensionEntries = (Object.keys(dimensionLabels) as DimensionKey[]).map((key) => {
          const session = sessionDimensions[key];
          const stored = selectedPerson.dimensions[key];
          const value = session?.count ? session.sum / session.count : stored;
          return { key, value, label: dimensionLabels[key].label };
        });
        const activeProjectsForPerson = projects.filter((project) => selectedPerson.activeProjectNames.includes(project.name));
        const recentTasks = allTasks
          .filter((task) => task.people.includes(selectedPerson.name))
          .sort((a,b) => String(b.dateStart || "").localeCompare(String(a.dateStart || "")))
          .slice(0,5);
        const history = selectedPerson.evaluationHistory ?? [];
        const trend = history.slice(-8);
        const trendPoints = trend.map((item,index) => {
          const x = trend.length <= 1 ? 50 : (index / (trend.length - 1)) * 100;
          const score = typeof item.score === "number" ? item.score : 0;
          const y = 88 - (Math.max(0,Math.min(5,score)) / 5) * 72;
          return `${x},${y}`;
        }).join(" ");
        const distributionMax = Math.max(1,...Object.values(selectedPerson.distribution));
        return <>
          <div className="employee-cockpit-scroll">
            <header className="employee-cockpit-header">
              <div className={`employee-cockpit-avatar avatar-${selectedPerson.tone}`}><span>{selectedPerson.initials}</span></div>
              <div className="employee-cockpit-identity">
                <span className="employee-cockpit-kicker">FICHA DE EMPLEADO</span>
                <DialogTitle>{selectedPerson.name}</DialogTitle>
                <DialogDescription>{selectedPerson.role} · {selectedPerson.assignment}</DialogDescription>
                <div className="employee-cockpit-project-chips">
                  {selectedPerson.activeProjectNames.slice(0,4).map((project)=><span key={project}>{project}</span>)}
                  {selectedPerson.activeProjectNames.length>4&&<span>+{selectedPerson.activeProjectNames.length-4}</span>}
                </div>
                <div className="employee-cockpit-meta">
                  <span>Incorporación · {shortDate(selectedPerson.joined)}</span>
                  <span>{selectedPerson.activeProjects} proyectos activos</span>
                  <span>{selectedPerson.evaluations} evaluaciones</span>
                </div>
              </div>
              <div className="employee-cockpit-contact">
                <div><Mail/><span><small>Email</small><b>{selectedPerson.email || "Sin email"}</b></span></div>
                <div><Banknote/><span><small>Sueldo</small><b>{currencyEUR(selectedPerson.salary)}{selectedPerson.salary != null ? " / año" : ""}</b></span></div>
                <div><Palmtree/><span><small>Vacaciones restantes</small><b>{selectedPerson.vacationRemaining != null ? `${selectedPerson.vacationRemaining} días` : "—"}</b></span></div>
              </div>
              <div className="employee-cockpit-status">
                <div style={{"--index-color":ratioColor(performance.ratio)} as React.CSSProperties}>
                  <strong>{performance.ratio ?? "—"}<small>/100</small></strong>
                  <span>Índice observado</span>
                  <b>{confidence(performance.count)}</b>
                </div>
                <div><strong>{selectedPerson.load}%</strong><span>carga actual</span></div>
              </div>
            </header>

            <section className="employee-cockpit-bento">
              <article className="employee-reading-card">
                <div className="employee-cockpit-module-head"><span>LECTURA ACTUAL</span><Activity/></div>
                <div className="employee-reading-layout">
                  <div className="employee-reading-score"><strong>{performance.ratio ?? "—"}</strong><span>Índice observado</span><small>{confidence(performance.count)} · {performance.count} evaluaciones</small></div>
                  <div className="employee-vertical-dimensions">
                    {dimensionEntries.slice(0,4).map((item)=><div key={item.key} className="employee-vertical-dimension" title={`${item.label} · ${oneDecimal(item.value)} / 5`}>
                      <span><b>{oneDecimal(item.value)}</b><small>{item.label}</small></span>
                      <i><em style={{height:`${typeof item.value==="number"?Math.max(8,item.value*20):0}%`}} /></i>
                    </div>)}
                  </div>
                </div>
              </article>

              <article className="employee-load-card">
                <div className="employee-cockpit-module-head"><span>CARGA Y ACTIVIDAD</span><CircleGauge/></div>
                <div className="employee-load-ring" style={{"--load":selectedPerson.load} as React.CSSProperties}><div><strong>{selectedPerson.load}%</strong><small>carga actual</small></div></div>
                <div className="employee-load-copy"><b>{selectedPerson.activeProjects} proyectos</b><b>{selectedPerson.activeTasks} tareas</b></div>
                <div className="employee-load-projects">{selectedPerson.activeProjectNames.slice(0,3).map((name)=><span key={name}>{name}</span>)}</div>
              </article>

              <article className="employee-evidence-card">
                <div className="employee-cockpit-module-head"><span>EVIDENCIA</span><Sparkles/></div>
                <strong>{performance.count}</strong>
                <span>evaluaciones</span>
                <b>{confidence(performance.count)}</b>
                <div className="employee-evidence-scale"><i/><i/><i className={performance.count>=8?"active":""}/></div>
                <div className="employee-evidence-foot"><span><b>{selectedPerson.completedTasks}</b> tareas cerradas</span><span><b>{selectedPerson.completedProjects}</b> proyectos cerrados</span></div>
              </article>
            </section>

            <section className="employee-cockpit-midgrid">
              <article className="employee-trend-card">
                <div className="employee-cockpit-module-head"><div><span>EVOLUCIÓN</span><h3>Índice observado en el tiempo</h3></div><TrendingUp/></div>
                {trend.length>1 ? <div className="employee-trend-chart">
                  <div className="employee-trend-plot">
                    <div className="employee-trend-grid" aria-hidden="true"><i/><i/><i/></div>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Evolución de evaluaciones">
                      <polyline points={trend.map((item,index)=>{
                        const x=trend.length<=1?50:(index/(trend.length-1))*100;
                        const score=typeof item.score==="number"?item.score:0;
                        const y=82-(Math.max(0,Math.min(5,score))/5)*64;
                        return `${x},${y}`;
                      }).join(" ")} fill="none" vectorEffect="non-scaling-stroke"/>
                    </svg>
                    {trend.map((item,index)=>{
                      const x=trend.length<=1?50:(index/(trend.length-1))*100;
                      const score=typeof item.score==="number"?item.score:0;
                      const y=82-(Math.max(0,Math.min(5,score))/5)*64;
                      return <button
                        key={item.id}
                        type="button"
                        className="employee-trend-point"
                        style={{left:`${x}%`,top:`${y}%`}}
                        aria-label={`${item.projectName||item.taskName||item.type}, ${oneDecimal(item.score)} sobre 5, ${shortDate(item.date)}`}
                      >
                        <span className="employee-trend-dot"/>
                        <span className="employee-trend-tooltip">
                          <b>{oneDecimal(item.score)} / 5</b>
                          <strong>{item.projectName||item.taskName||item.type}</strong>
                          <small>{shortDate(item.date)}</small>
                        </span>
                      </button>;
                    })}
                  </div>
                  <div className="employee-trend-labels"><span>{shortDate(trend[0]?.date)}</span><span>{shortDate(trend.at(-1)?.date)}</span></div>
                </div> : <div className="employee-trend-empty"><TrendingUp/><strong>Histórico insuficiente</strong><span>Necesitamos al menos dos evaluaciones fechadas para dibujar evolución.</span></div>}
              </article>

              <article className="employee-distribution-card">
                <div className="employee-cockpit-module-head"><div><span>DISTRIBUCIÓN</span><h3>Puntuaciones</h3></div><Star/></div>
                <div className="employee-histogram">
                  {[1,2,3,4,5].map((rating)=>{
                    const count=selectedPerson.distribution[String(rating) as keyof typeof selectedPerson.distribution]||0;
                    return <div key={rating}><i><em style={{height:`${Math.max(4,(count/distributionMax)*100)}%`}} /></i><b>{count}</b><span>{rating}★</span></div>;
                  })}
                </div>
                <div className="employee-distribution-average"><span>Media observada</span><strong>{oneDecimal(selectedPerson.score)} / 5</strong></div>
              </article>
            </section>

            <section className="employee-how-card">
              <div className="employee-cockpit-module-head"><div><span>CÓMO FUNCIONA</span><h3>Lectura por dimensiones</h3></div><Target/></div>
              <div className="employee-dimension-tiles">
                {dimensionEntries.map((item)=><article key={item.key}>
                  <div className="employee-dimension-ring" style={{"--dimension":typeof item.value==="number"?Math.max(0,Math.min(100,item.value*20)):0} as React.CSSProperties}><strong>{oneDecimal(item.value)}</strong></div>
                  <span>{item.label}</span>
                  <small>{performance.count ? `${performance.count} evaluaciones` : "Sin muestra"}</small>
                </article>)}
              </div>
            </section>

            <section className="employee-cockpit-lowergrid">
              <article className="employee-current-work-card">
                <div className="employee-cockpit-module-head"><div><span>TRABAJO ACTUAL</span><h3>Proyectos activos</h3></div><FolderKanban/></div>
                <div className="employee-current-projects">
                  {activeProjectsForPerson.map((project)=><button key={project.id} onClick={()=>{setSelectedPerson(null);setSelectedProjectPage(project);}}>
                    <span>{project.account}</span><strong>{project.name}</strong><small>{project.status} · {allTasks.filter((task)=>task.project===project.name&&!["Terminado","Cancelado"].includes(task.status)).length} tareas</small><ChevronRight/>
                  </button>)}
                  {!activeProjectsForPerson.length&&<div className="employee-empty-state">Sin proyectos activos</div>}
                </div>
              </article>

              <article className="employee-activity-card">
                <div className="employee-cockpit-module-head"><div><span>ACTIVIDAD RECIENTE</span><h3>Últimos movimientos</h3></div><Clock3/></div>
                <div className="employee-activity-list">
                  {history.slice(-4).reverse().map((item)=><div key={item.id}><span>{shortDate(item.date)}</span><strong>{item.projectName||item.taskName||item.type}</strong><small>{oneDecimal(item.score)} / 5{item.quality!=null?` · calidad ${oneDecimal(item.quality)}`:""}{item.timing!=null?` · timing ${oneDecimal(item.timing)}`:""}</small></div>)}
                  {!history.length&&recentTasks.map((task)=><button key={task.id} onClick={()=>setDetail({kind:"task",...task})}><span>{task.date}</span><strong>{task.name}</strong><small>{task.project} · {task.status}</small></button>)}
                  {!history.length&&!recentTasks.length&&<div className="employee-empty-state">Sin actividad reciente</div>}
                </div>
              </article>

              <article className="employee-profile-card-detail">
                <div className="employee-cockpit-module-head"><div><span>PERFIL</span><h3>Fortalezas y crecimiento</h3></div><Sparkles/></div>
                <div className="employee-profile-group"><span>SKILLS</span><div>{selectedPerson.skills.length?selectedPerson.skills.map((skill)=><b key={skill}>{skill}</b>):<small>Sin datos</small>}</div></div>
                <div className="employee-profile-group growth"><span>ÁREAS DE CRECIMIENTO</span><div>{selectedPerson.growth.length?selectedPerson.growth.map((skill)=><b key={skill}>{skill}</b>):<small>Sin señales registradas</small>}</div></div>
                {sessionSignals&&<div className="employee-profile-group session"><span>SEÑALES DE ESTA SESIÓN</span><div>{Object.entries(sessionSignals.positive).map(([signal,count])=><b key={signal}>+ {signal} · {count}</b>)}{Object.entries(sessionSignals.negative).map(([signal,count])=><b className="negative" key={signal}>− {signal} · {count}</b>)}</div></div>}
              </article>
            </section>
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
