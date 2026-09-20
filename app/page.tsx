"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight,
  CalendarRange, ChevronLeft, CircleGauge, Clock3, FolderKanban, GripVertical,
  Check, LayoutDashboard, ListTodo, Plus, Save, Search, Sparkles, Star,
  Target, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
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
  account: string; date: string; dateStart?: string | null; people: string[]; url: string;
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
  const [quickType, setQuickType] = useState("task");
  const [quickName, setQuickName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(1);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");
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
  const current = viewCopy[activeView];

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
  const weeklyTasks = useMemo(() => allTasks.filter((task) => task.dateStart && task.dateStart >= isoDate(operationalWeekStart) && task.dateStart <= isoDate(operationalWeekEnd)), [allTasks, operationalWeekStart, operationalWeekEnd]);
  const weeklyProjectMilestones = useMemo(() => projects.flatMap((project) => {
    const events: Array<{ id: string; date: string; label: string; project: Project; kind: "start" | "end" }> = [];
    if (project.timingStart && project.timingStart >= isoDate(operationalWeekStart) && project.timingStart <= isoDate(operationalWeekEnd)) events.push({ id: project.id + "-start", date: project.timingStart, label: "Arranque", project, kind: "start" });
    if (project.timingEnd && project.timingEnd >= isoDate(operationalWeekStart) && project.timingEnd <= isoDate(operationalWeekEnd)) events.push({ id: project.id + "-end", date: project.timingEnd, label: "Cierre", project, kind: "end" });
    return events;
  }), [projects, operationalWeekStart, operationalWeekEnd]);
  const weeklyHolidays = useMemo(() => holidays.filter((holiday) => holiday.start <= isoDate(operationalWeekEnd) && holiday.end >= isoDate(operationalWeekStart)), [holidays, operationalWeekStart, operationalWeekEnd]);

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
  const q = search.trim().toLocaleLowerCase("es");
  const filteredTasks = useMemo(() => tasks.filter((task) => !q || `${task.name} ${task.project} ${task.account} ${task.people.join(" ")}`.toLowerCase().includes(q)), [tasks, q]);
  const filteredProjects = useMemo(() => projects.filter((project) => !q || `${project.name} ${project.account} ${project.type} ${project.people.join(" ")}`.toLowerCase().includes(q)), [projects, q]);
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
      const nextTask: Task = { id: detail.id, name: detail.name, status: detail.status, priority: detail.priority, project: detail.project, account: detail.account, date: detail.date, dateStart: detail.dateStart, people: detail.people, url: detail.url };
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
        });
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
      <div className="nav-section-label"><span>ESPACIOS</span><small>7 vistas</small></div>
      <TabsList className="nav-list" variant="line" aria-label="Navegación principal">
        {navigation.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className={`nav-item ${value === "dashboard" ? "nav-dashboard" : ""}`}><Icon /><span>{label}</span>{value === "dashboard" && <small>GENERAL</small>}</TabsTrigger>)}
      </TabsList>
      <div className="sync-card"><span className="sync-dot" /><div><strong>{schemaState === "live" && dataState === "live" ? "NOTION EN VIVO" : schemaState === "error" || dataState === "error" ? "NOTION · SIN DATOS" : "CONECTANDO NOTION"}</strong><small>{schemaState === "live" && dataState === "live" ? `${liveCounts?.activeTasks ?? tasks.length} tareas · ${liveCounts?.activeProjects ?? projects.length} proyectos · opciones reales` : schemaState === "error" || dataState === "error" ? "No se muestran snapshots antiguos como si fueran actuales" : "Leyendo filas, relaciones y schema…"}</small></div></div>
      <form action="/api/auth/logout" method="post" className="user-chip"><span>JC</span><div><strong>JORGE</strong><small>Director Creativo</small></div><button type="submit" className="user-chip-logout">Salir</button></form>
    </aside>

    <main className={`main-stage main-stage-${activeView}`}>
      <header className="topbar">
        <div className="page-heading"><span>{current.eyebrow}</span><h1>{current.title}</h1><p>{current.description}</p></div>
        <div className="top-actions">
          <label className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el OS…" /></label>
          {queuedChanges > 0 && <button className="draft-chip" onClick={() => toast.info("Cambios de prototipo", { description: "Los conectaremos a Notion en la siguiente capa." })}>{queuedChanges} cambio{queuedChanges > 1 ? "s" : ""}</button>}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="add-button"><Plus /> Añadir</Button></DialogTrigger>
            <DialogContent className="quick-dialog"><DialogHeader><DialogTitle>Añadir sin ceremonia</DialogTitle><DialogDescription>Crea una tarea o proyecto real en Notion y completa después el resto de propiedades.</DialogDescription></DialogHeader>
              <div className="quick-form"><Select value={quickType} onValueChange={setQuickType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="task">Tarea</SelectItem><SelectItem value="project">Proyecto</SelectItem></SelectContent></Select><input autoFocus value={quickName} onChange={(event) => setQuickName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createQuickItem(); }} placeholder={quickType === "task" ? "¿Qué hay que hacer?" : "Nombre del proyecto"} /></div>
              <DialogFooter><Button onClick={createQuickItem}>Crear en Notion</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <TabsContent value="dashboard" className="view-content dashboard-view">
        <section className="metric-strip">
          <article><span>PROYECTOS ACTIVOS</span><strong>{projects.length.toString().padStart(2, "0")}</strong><small><i className="green" /> datos reales de Notion</small></article>
          <article><span>TAREAS ACTIVAS</span><strong>{tasks.length.toString().padStart(2, "0")}</strong><small><i className="red" /> solo trabajo abierto</small></article>
          <article><span>CARGA ALTA</span><strong>{team.filter((person) => person.load >= 75).length.toString().padStart(2, "0")}</strong><small><i className="orange" /> carga relativa</small></article>
          <article><span>MUESTRA EVALUADA</span><strong>{(liveCounts?.ratedTasks ?? 0) + (liveCounts?.ratedProjects ?? 0)}</strong><small><i className="blue" /> tareas + proyectos puntuados</small></article>
        </section>
        <section className="control-room">
          <div className="dashboard-workbench">
            <article className="ops-panel tasks-overview">
              <div className="ops-head"><div><span>OPERATIVA EN VIVO</span><h2>Tareas</h2></div><button onClick={() => setActiveView("tasks")}>Abrir tablero <ArrowUpRight /></button></div>
              <div className="mini-task-board">
                {taskBoardStatuses.map((status) => {
                  const total = tasks.filter((task) => task.status === status).length;
                  const items = tasks.filter((task) => task.status === status).slice(0, 2);
                  return <div key={status} className={`mini-task-lane ${dragging?.startsWith("task") ? "ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
                    <div className="mini-lane-head"><span>{status}</span><b>{total}</b></div>
                    {items.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setDetail({ kind: "task", ...task })} onDragStart={() => setDragging(`task:${task.id}`)} onAssignPerson={(person) => assignPerson("task", task.id, person)} />)}
                    {items.length === 0 && <EmptyDrop />}
                    {total > items.length && <button className="lane-more" onClick={() => setActiveView("tasks")}>+{total - items.length} más</button>}
                  </div>;
                })}
              </div>
            </article>

            <article className="ops-panel projects-overview">
              <div className="ops-head"><div><span>MAPA DE TRABAJO</span><h2>Proyectos activos</h2></div><button onClick={() => setActiveView("projects")}>Ver pipeline <ArrowUpRight /></button></div>
              <div className="project-overview-list">
                {projects.slice(0, 5).map((project) => <div key={project.id} className="dashboard-project" draggable
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", `project:${project.id}`); setDragging(`project:${project.id}`); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { const [kind, person] = event.dataTransfer.getData("text/plain").split(":"); if (kind === "person") { event.preventDefault(); assignPerson("project", project.id, person); } }}
                  onClick={() => setSelectedProjectPage(project)}>
                  <AccountMark name={project.account} /><span className="dashboard-project-copy"><strong>{project.name}</strong><small>{project.account} · {project.timing}</small></span><span className={`stage-chip stage-${project.status.toLowerCase().replace("-", "")}`}>{project.status}</span><PeopleStack people={project.people} /><GripVertical />
                </div>)}
              </div>
              <div className="deadline-ribbon"><span><AlertTriangle />PRÓXIMAS FECHAS</span>{upcomingDeadlines.length ? upcomingDeadlines.map((task) => <button key={task.id} onClick={() => setDetail({ kind: "task", ...task })}><b>{task.date}</b> {task.name}</button>) : <small>Sin entregas próximas con fecha en Notion</small>}</div>
            </article>
          </div>

          <aside className="team-roster">
            <div className="roster-head"><div><span>EQUIPO · {team.length}</span><h2>Arrastra o abre ficha</h2></div><Users /></div>
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
            <AccountMark name={account.name} /><span><strong>{account.name}</strong><small>{account.projects} proyectos · {account.tasks} tareas</small></span><i />
          </button>)}</div>
        </section>
      </TabsContent>

      <TabsContent value="week" className="view-content week-view">
        <section className="week-summary">
          <article><span>ENTREGAS</span><strong>{weeklyTasks.length}</strong><small>Tareas con fecha</small></article>
          <article><span>HITOS</span><strong>{weeklyProjectMilestones.length}</strong><small>Arranques y cierres</small></article>
          <article><span>AUSENCIAS</span><strong>{weeklyHolidays.length}</strong><small>Personas fuera</small></article>
          <article><span>ALTA / URGENTE</span><strong>{weeklyTasks.filter((task) => ["Alta", "Urgente"].includes(task.priority)).length}</strong><small>Necesitan ojo</small></article>
        </section>
        <section className="week-board">
          {operationalWeekDays.map((day) => {
            const key = isoDate(day);
            const dayTasks = weeklyTasks.filter((task) => task.dateStart === key);
            const dayProjects = weeklyProjectMilestones.filter((event) => event.date === key);
            const dayHolidays = weeklyHolidays.filter((holiday) => holiday.start <= key && holiday.end >= key);
            return <article key={key} className="week-day">
              <header><span>{day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase()}</span><strong>{day.getDate()}</strong><small>{day.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase()}</small></header>
              <div className="week-day-body">
                {dayProjects.map((event) => <button key={event.id} className="week-item project" onClick={() => setSelectedProjectPage(event.project)}><i /><span><strong>{event.project.name}</strong><small>{event.label} · {event.project.account}</small></span><ChevronRight /></button>)}
                {dayTasks.map((task) => <button key={task.id} className={"week-item task " + (["Alta", "Urgente"].includes(task.priority) ? "critical" : "")} onClick={() => setDetail({ kind: "task", ...task })}><i /><span><strong>{task.name}</strong><small>{task.project} · {task.account}</small></span><ChevronRight /></button>)}
                {dayHolidays.map((holiday) => <button key={holiday.id || holiday.name} className="week-item holiday" onClick={() => setActiveView("holidays")}><i /><span><strong>{holiday.name}</strong><small>{holiday.type}</small></span><ChevronRight /></button>)}
                {dayTasks.length + dayProjects.length + dayHolidays.length === 0 && <div className="week-empty">Sin hitos. Milagro administrativo.</div>}
              </div>
            </article>;
          })}
        </section>
      </TabsContent>

      <TabsContent value="timeline" className="view-content global-timeline-view">
        <section className="global-timeline-shell">
          <header className="global-timeline-toolbar">
            <div><span>VENTANA</span><strong>{globalTimelineStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — {globalTimelineEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</strong></div>
            <div>{[4, 8, 12].map((weeks) => <button key={weeks} className={timelineWeeks === weeks ? "active" : ""} onClick={() => setTimelineWeeks(weeks)}>{weeks} sem</button>)}</div>
          </header>
          <div className="global-timeline-scale">{Array.from({ length: timelineWeeks + 1 }, (_, index) => <span key={index} style={{ left: `${(index / timelineWeeks) * 100}%` }}>{addDays(globalTimelineStart, index * 7).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>)}</div>
          <div className="global-timeline-groups">
            {accounts.map((account) => {
              const accountProjects = projects.filter((project) => project.account === account.name);
              if (!accountProjects.length) return null;
              return <section key={account.name} className="timeline-account-group">
                <header style={{ "--account-color": account.color, "--account-contrast": accountContrast(account.color) } as React.CSSProperties}><AccountMark name={account.name} /><strong>{account.name}</strong><small>{accountProjects.length}</small></header>
                <div>{accountProjects.map((project) => {
                  const left = timelinePercent(project.timingStart, globalTimelineStart, globalTimelineEnd);
                  const right = timelinePercent(project.timingEnd || project.timingStart, globalTimelineStart, globalTimelineEnd);
                  const visible = left != null && right != null && right >= 0 && left <= 100;
                  const projectTasks = allTasks.filter((task) => task.project === project.name && task.dateStart);
                  return <button key={project.id} className="global-project-row" onClick={() => setSelectedProjectPage(project)}>
                    <span className="global-project-name"><strong>{project.name}</strong><small>{project.status}</small></span>
                    <span className="global-project-track">
                      {visible ? <i className="global-project-bar" style={{ left: `${clamp(left!)}%`, width: `${Math.max(2, clamp(right!) - clamp(left!))}%` }} /> : <em>Sin fechas en ventana</em>}
                      {projectTasks.map((task) => { const pos = timelinePercent(task.dateStart, globalTimelineStart, globalTimelineEnd); return pos != null && pos >= 0 && pos <= 100 ? <b key={task.id} title={task.name} className={"global-task-marker status-" + task.status.toLowerCase().replaceAll(" ", "-")} style={{ left: `${pos}%` }} /> : null; })}
                    </span>
                  </button>;
                })}</div>
              </section>;
            })}
          </div>
        </section>
      </TabsContent>

      <TabsContent value="calendar" className="view-content calendar-view">
        <section className="calendar-shell">
          <header className="calendar-toolbar">
            <div className="month-switcher">
              <button aria-label="Mes anterior" disabled={calendarMonth === 0} onClick={() => setCalendarMonth((month) => Math.max(0, month - 1))}><ChevronLeft /></button>
              <div><span>CRONOLOGÍA</span><strong>{calendarMonths[calendarMonth].name} {calendarMonths[calendarMonth].year}</strong></div>
              <button aria-label="Mes siguiente" disabled={calendarMonth === calendarMonths.length - 1} onClick={() => setCalendarMonth((month) => Math.min(calendarMonths.length - 1, month + 1))}><ChevronRight /></button>
              <button className="today-button" onClick={() => setCalendarMonth(0)}>Hoy</button>
            </div>
            <div className="calendar-filters" aria-label="Filtrar calendario">
              {([["all", "Todo"], ["task", "Tareas"], ["project", "Proyectos"], ["holiday", "Ausencias"]] as [CalendarFilter, string][]).map(([value, label]) => <button key={value} className={calendarFilter === value ? "active" : ""} onClick={() => setCalendarFilter(value)}>{label}</button>)}
            </div>
          </header>
          <div className="calendar-layout">
            <aside className="mini-calendar-card">
              <div className="mini-calendar-heading"><CalendarRange /><div><span>MES</span><strong>{calendarMonths[calendarMonth].name}</strong></div></div>
              <div className="weekday-row">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="month-grid">
                {Array.from({ length: calendarMonths[calendarMonth].offset }).map((_, index) => <i key={"blank-" + index} />)}
                {Array.from({ length: calendarMonths[calendarMonth].days }, (_, index) => index + 1).map((day) => {
                  const dayEvents = calendarEvents.filter((event) => event.month === calendarMonth && event.day === day);
                  return <button key={day} className={(dayEvents.length ? "has-events " : "") + (calendarMonth === 0 && day === 28 ? "today" : "")} onClick={() => { const first = dayEvents[0]; if (first) openCalendarEvent(first); }}><span>{day}</span>{dayEvents.length > 0 && <small>{dayEvents.slice(0, 3).map((event) => <i key={event.key} className={"dot-" + event.kind} />)}</small>}</button>;
                })}
              </div>
              <div className="calendar-legend"><span><i className="dot-task" />Tarea</span><span><i className="dot-project" />Proyecto</span><span><i className="dot-holiday" />Ausencia</span></div>
            </aside>
            <section className="chronology-card">
              <div className="chronology-head"><div><span>AGENDA</span><h2>Fechas clave</h2></div><strong>{visibleCalendarEvents.length} hitos</strong></div>
              <div className="chronology-list">
                {visibleEventDays.map((day) => <div className="chronology-day" key={day}>
                  <div className="date-stamp"><strong>{day.toString().padStart(2, "0")}</strong><span>{calendarMonths[calendarMonth].short}</span></div>
                  <div className="day-events">{visibleCalendarEvents.filter((event) => event.day === day).map((event) => <button key={event.key} className={"calendar-event event-" + event.kind} onClick={() => openCalendarEvent(event)}><i /><span><strong>{event.title}</strong><small>{event.meta}{event.account ? " · " + event.account : ""}</small></span><ChevronRight /></button>)}</div>
                </div>)}
                {visibleEventDays.length === 0 && <div className="calendar-empty"><CalendarDays /><strong>Mes despejado</strong><span>No hay fechas con este filtro. Sospechoso, pero agradable.</span></div>}
              </div>
            </section>
            <aside className="calendar-insight"><Sparkles /><span>LECTURA RÁPIDA</span><h2>La semana del 14 al 21 de septiembre concentra el riesgo.</h2><p>Hay cinco entregas, dos perfiles por encima del 90% de carga y cero margen para otra “reunión rápida”.</p><button onClick={() => { setCalendarMonth(1); setCalendarFilter("all"); }}>Ver septiembre <ArrowUpRight /></button></aside>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="accounts" className="view-content"><section className="accounts-grid">{accounts.filter((account) => !q || account.name.toLowerCase().includes(q)).map((account) => <article key={account.name} className={`account-card ${dragging?.startsWith("task") || dragging?.startsWith("project") ? "is-drop-ready" : ""}`} style={{ "--account-color": account.color } as React.CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveToAccount(event, account.name)}><div className="account-card-head"><AccountMark name={account.name} /><span className={`priority-pill ${priorityClass(account.priority)}`}>{account.priority}</span></div><h2>{account.name}</h2><p>{account.contract}</p><div className="account-stats"><span><b>{account.projects}</b> proyectos</span><span><b>{account.pulse}</b> pulso</span></div><div className="account-bar"><i style={{ width: `${account.pulse}%` }} /></div><button onClick={() => setSelectedAccount(account)}>Abrir cuenta <ArrowUpRight /></button></article>)}</section></TabsContent>

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

      <TabsContent value="holidays" className="view-content"><section className="holiday-panel"><div className="holiday-head"><div><span>VENTANA DE 8 SEMANAS</span><h2>Ausencias reales próximas</h2></div><div className="legend"><span><i className="holiday" /> Ausencia desde Notion</span></div></div><div className="timeline-head"><span>EQUIPO</span>{["31 AGO", "7 SEP", "14 SEP", "21 SEP", "28 SEP", "5 OCT", "12 OCT", "19 OCT"].map((date) => <b key={date}>{date}</b>)}</div>{holidayTimelineNames.map((name) => { const holiday = holidays.find((item) => item.name === name); if (!holiday) return null; const position = timelinePosition(holiday.start, holiday.end); return <div className="timeline-row" key={name}><strong>{name}</strong><div className="timeline-track"><span className="holiday-block" title={`${holiday.type} · ${holiday.label}`} style={{ left: `${position.left}%`, width: `${position.width}%`, background: holiday.color }}>{holiday.label}</span></div></div>; })}<div className="timeline-callout"><AlertTriangle /><p><strong>Ausencias sincronizadas</strong>{dataState === "live" ? `${holidays.length} registros recientes o próximos leídos directamente de Notion.` : "Sin conexión live: no se muestran ausencias antiguas como actuales."}</p><button onClick={() => setActiveView("team")}>Ver carga <ChevronRight /></button></div></section></TabsContent>
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
      return <div className="project-workspace-overlay">
        <header className="project-workspace-top" style={{ "--account-color": color, "--account-contrast": contrast } as React.CSSProperties}>
          <button className="workspace-back" onClick={() => setSelectedProjectPage(null)}><ChevronLeft /> Volver</button>
          <div className="project-workspace-title">
            <span>{selectedProjectPage.account} · PROYECTO</span>
            <input defaultValue={selectedProjectPage.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== selectedProjectPage.name) updateProjectWorkspace({ name }); }} />
            <small>{selectedProjectPage.type} · {selectedProjectPage.status}</small>
          </div>
          <div className="project-workspace-actions">
            <Button variant="outline" onClick={() => startEvaluation({ kind: "project", id: selectedProjectPage.id, name: selectedProjectPage.name, people: selectedProjectPage.people })}><Star /> Cerrar y evaluar</Button>
            <Button asChild><a href={selectedProjectPage.url} target="_blank" rel="noreferrer">Notion <ArrowUpRight /></a></Button>
          </div>
        </header>

        <div className="project-workspace-scroll">
          <section className="project-workspace-metrics">
            <article><span>PROGRESO</span><strong>{completion}%</strong><Progress value={completion} /></article>
            <article><span>TAREAS</span><strong>{projectTasks.length}</strong><small>{activeProjectTasks.length} activas</small></article>
            <article><span>TERMINADAS</span><strong>{completedTasks}</strong><small>{cancelledTasks} canceladas</small></article>
            <article><span>EQUIPO</span><strong>{selectedProjectPage.people.filter((name) => name !== "Por asignar").length}</strong><small>personas</small></article>
          </section>

          <section className="project-workspace-grid">
            <article className="project-control-panel">
              <div className="workspace-section-head"><span>CONTROL</span><h2>Edita el proyecto aquí</h2></div>
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
                <div>{selectedProjectPage.people.filter((name) => name !== "Por asignar").map((name) => <button key={name} onClick={() => { const people = selectedProjectPage.people.filter((person) => person !== name && person !== "Por asignar"); updateProjectWorkspace({ people: people.length ? people : ["Por asignar"] }); }}>{name}<b>×</b></button>)}</div>
                <select value="" onChange={(event) => { const name = event.target.value; if (!name) return; const current = selectedProjectPage.people.filter((person) => person !== "Por asignar"); if (!current.includes(name)) updateProjectWorkspace({ people: [...current, name] }); event.currentTarget.value = ""; }}><option value="">Añadir persona…</option>{team.filter((person) => !selectedProjectPage.people.includes(person.name)).map((person) => <option key={person.id} value={person.name}>{person.name} · {person.role}</option>)}</select>
              </div>
            </article>

            <article className="project-timeline-panel">
              <div className="workspace-section-head"><span>TIMELINE</span><h2>Hitos y tareas</h2><small>{start.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — {end.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</small></div>
              <div className="project-timeline-scale"><span>INICIO</span><i /><span>FIN</span></div>
              <div className="project-timeline-rows">
                {datedTasks.map((task) => {
                  const pos = timelinePercent(task.dateStart, start, end) ?? 0;
                  return <button key={task.id} className={"project-timeline-row status-" + task.status.toLowerCase().replaceAll(" ", "-")} onClick={() => setDetail({ kind: "task", ...task })}>
                    <span><strong>{task.name}</strong><small>{task.status}</small></span>
                    <i className="project-timeline-line"><b style={{ left: `${pos}%` }} /></i>
                    <em>{task.date}</em>
                  </button>;
                })}
                {datedTasks.length === 0 && <div className="workspace-empty">Añade fechas a las tareas y el timeline se irá pintando solo.</div>}
              </div>
            </article>
          </section>

          <section className="project-task-workspace">
            <div className="workspace-section-head"><span>TAREAS</span><h2>Operativa del proyecto</h2><small>{projectTasks.length} en total</small></div>
            <div className="project-task-create"><input value={projectTaskName} onChange={(event) => setProjectTaskName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createTaskForSelectedProject(); }} placeholder="Nueva tarea dentro de este proyecto…" /><button onClick={createTaskForSelectedProject}><Plus /> Crear</button></div>
            <div className="project-task-table">
              {projectTasks.map((task) => <div key={task.id} className="project-task-row">
                <button className="project-task-name" onClick={() => setDetail({ kind: "task", ...task })}><strong>{task.name}</strong><small>{task.people.filter((name) => name !== "Por asignar").join(", ") || "Sin asignar"}</small></button>
                <select value={task.status} onChange={(event) => updateWorkspaceTask(task, { status: event.target.value })}>{taskStatusOptions.map((status) => <option key={status}>{status}</option>)}</select>
                <select value={task.priority} onChange={(event) => updateWorkspaceTask(task, { priority: event.target.value })}>{taskPriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select>
                <input type="date" value={task.dateStart || ""} onChange={(event) => { const value = event.target.value || null; const label = value ? new Date(value + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "") : "SIN FECHA"; updateWorkspaceTask(task, { dateStart: value, date: label }); }} />
                <button onClick={() => setDetail({ kind: "task", ...task })}><ChevronRight /></button>
              </div>)}
              {projectTasks.length === 0 && <div className="workspace-empty">Este proyecto todavía no tiene tareas vinculadas.</div>}
            </div>
          </section>
        </div>
      </div>;
    })()}

    <Sheet open={Boolean(selectedAccount)} onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}>
      <SheetContent className="detail-sheet account-overview-sheet">{selectedAccount && (() => {
        const accountProjects = projects.filter((project) => project.account === selectedAccount.name);
        const accountTasks = tasks.filter((task) => task.account === selectedAccount.name);
        const people = Array.from(new Set([...accountProjects.flatMap((project) => project.people), ...accountTasks.flatMap((task) => task.people)].filter((name) => name !== "Por asignar")));
        const datedTasks = accountTasks.filter((task) => task.dateStart).sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart))).slice(0, 5);
        const contrast = accountContrast(selectedAccount.color);
        return <>
          <SheetHeader className="account-overview-header" style={{ "--account-color": selectedAccount.color, "--account-contrast": contrast } as React.CSSProperties}>
            <div className="account-overview-brand"><AccountMark name={selectedAccount.name} /><div><span>CUENTA</span><SheetTitle>{selectedAccount.name}</SheetTitle><SheetDescription>{selectedAccount.contract} · Prioridad {selectedAccount.priority}</SheetDescription></div></div>
          </SheetHeader>
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
      })()}</SheetContent>
    </Sheet>

    <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
      <SheetContent className="detail-sheet">{detail && <>
        <SheetHeader>
          <span className="sheet-kicker">{detail.kind === "task" ? "EDITAR TAREA" : "EDITAR PROYECTO"}</span>
          <SheetTitle>{detail.name}</SheetTitle>
          <SheetDescription>Cambia cualquier campo y guárdalo directamente en Notion.</SheetDescription>
        </SheetHeader>
        <div className="sheet-body detail-editor">
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
            ? <label className="editor-field"><span>Fecha</span><input type="date" value={detail.dateStart || ""} onChange={(event) => { updateDetailField("dateStart", event.target.value || null); updateDetailField("date", event.target.value ? new Date(event.target.value + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase().replace(".", "") : "SIN FECHA"); }} /></label>
            : <div className="editor-field full"><span>Timing</span><div className="date-range-fields"><label><small>Inicio</small><input type="date" value={detail.timingStart || ""} onChange={(event) => updateDetailField("timingStart", event.target.value || null)} /></label><label><small>Fin</small><input type="date" min={detail.timingStart || undefined} value={detail.timingEnd || ""} onChange={(event) => updateDetailField("timingEnd", event.target.value || null)} /></label></div></div>}
          <div className="editor-field full"><span>Equipo</span><div className="team-chip-editor"><div className="team-selected-chips">{detail.people.filter((name) => name !== "Por asignar").map((name) => { const person = team.find((item) => item.name === name); return <span key={name} className="team-person-chip">{person && <i className={`avatar avatar-${person.tone}`}>{person.initials}</i>}<b>{name}</b><button type="button" aria-label={`Quitar a ${name}`} onClick={() => { const nextPeople = detail.people.filter((personName) => personName !== name && personName !== "Por asignar"); updateDetailField("people", nextPeople.length ? nextPeople : ["Por asignar"]); }}>×</button></span>; })}{detail.people.filter((name) => name !== "Por asignar").length === 0 && <small className="team-empty-selection">Sin equipo asignado</small>}</div><select value="" onChange={(event) => { const name = event.target.value; if (!name) return; const current = detail.people.filter((personName) => personName !== "Por asignar"); if (!current.includes(name)) updateDetailField("people", [...current, name]); event.currentTarget.value = ""; }}><option value="">Añadir persona…</option>{team.filter((person) => !detail.people.includes(person.name)).map((person) => <option key={person.id} value={person.name}>{person.name} · {person.role}</option>)}</select></div></div>
          <div className="sheet-note"><Sparkles /><p><strong>Lectura rápida</strong>{detail.priority === "Alta" ? "Está en zona de atención. Revisa fecha y responsables antes de cerrar." : "Parece controlado. No le añadamos épica administrativa."}</p></div>
        </div>
        <div className="sheet-actions sheet-actions-stacked"><Button className="close-evaluate-button" onClick={() => startEvaluation({ kind: detail.kind, id: detail.id, name: detail.name, people: detail.people })}><Star /> Cerrar y evaluar</Button><div><Button onClick={saveDetail} className="notion-button"><Save /> Guardar cambios</Button><Button asChild variant="outline"><a href={detail.url} target="_blank" rel="noreferrer">Abrir en Notion <ArrowUpRight /></a></Button></div></div>
      </>}</SheetContent>
    </Sheet>

    <Sheet open={Boolean(selectedPerson)} onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}>
      <SheetContent className="detail-sheet employee-sheet">{selectedPerson && (() => {
        const performance = personPerformance(selectedPerson);
        const maxDistribution = Math.max(1, ...Object.values(selectedPerson.distribution));
        const sessionSignals = signalBoosts[selectedPerson.name];
        const sessionDimensions = dimensionBoosts[selectedPerson.name] ?? {};
        return <>
          <SheetHeader>
            <span className="sheet-kicker">FICHA DE EMPLEADO · DATOS REALES</span>
            <div className="employee-hero"><div className={`avatar avatar-${selectedPerson.tone}`}>{selectedPerson.initials}</div><div><SheetTitle>{selectedPerson.name}</SheetTitle><SheetDescription>{selectedPerson.role} · {selectedPerson.assignment}</SheetDescription>{selectedPerson.activeProjectNames.length > 0 && <div className="employee-projects-inline">{selectedPerson.activeProjectNames.map((project) => <span key={project}>{project}</span>)}</div>}</div><span className="employee-tier">{selectedPerson.tier ?? "—"}</span></div>
          </SheetHeader>
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
          <div className="sheet-actions"><Button asChild className="notion-button"><a href={selectedPerson.url} target="_blank" rel="noreferrer">Abrir ficha en Notion <ArrowUpRight /></a></Button></div>
        </>;
      })()}</SheetContent>
    </Sheet>

    <Dialog open={Boolean(evaluation)} onOpenChange={(open) => { if (!open) resetEvaluation(); }}>
      <DialogContent className="evaluation-dialog">{evaluation && <>
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
    <Toaster position="bottom-right" />
  </Tabs>;
}
