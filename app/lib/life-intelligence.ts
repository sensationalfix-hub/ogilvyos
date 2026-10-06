export type IntelligenceTask = {
  id: string;
  name: string;
  status: string;
  priority: string;
  project: string;
  account: string;
  dateStart?: string | null;
  dateEnd?: string | null;
  workosLane?: string | null;
};

export type IntelligenceProject = {
  id: string;
  name: string;
  status: string;
  priority: string;
  account: string;
  timingStart?: string | null;
  timingEnd?: string | null;
};

export type RankedTask<T extends IntelligenceTask = IntelligenceTask> = {
  task: T;
  score: number;
  reasons: string[];
  daysUntil: number | null;
  overdue: boolean;
};

export type SmartCapture = {
  title: string;
  priority: string;
  project: string | null;
  account: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  confidence: number;
  signals: string[];
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function localDay(value: string | null | undefined) {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const date = new Date(dateOnly + "T12:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayDifference(target: Date, from: Date) {
  return Math.round((startOfLocalDay(target).getTime() - startOfLocalDay(from).getTime()) / 86400000);
}

function priorityWeight(priority: string) {
  const key = normalized(priority);
  if (key === "urgente") return 34;
  if (key === "alta") return 26;
  if (key === "media") return 12;
  if (key === "baja") return 3;
  return 6;
}

function statusWeight(task: IntelligenceTask) {
  const lane = normalized(task.workosLane || task.status);
  if (lane === "en progreso") return 12;
  if (lane === "pendiente") return 7;
  if (lane === "pausa") return 3;
  if (lane === "backlog") return -6;
  return 0;
}

function datePressure(task: IntelligenceTask, now: Date) {
  const date = localDay(task.dateStart);
  if (!date) return { score: 0, daysUntil: null, overdue: false, reason: null as string | null };
  const days = dayDifference(date, now);
  if (days < 0) return {
    score: Math.min(45, 34 + Math.abs(days) * 3),
    daysUntil: days,
    overdue: true,
    reason: days === -1 ? "venció ayer" : `lleva ${Math.abs(days)} días vencida`,
  };
  if (days === 0) return { score: 32, daysUntil: 0, overdue: false, reason: "está planificada para hoy" };
  if (days === 1) return { score: 25, daysUntil: 1, overdue: false, reason: "vence mañana" };
  if (days === 2) return { score: 19, daysUntil: 2, overdue: false, reason: "entra en las próximas 48 h" };
  if (days <= 7) return { score: 12 - Math.min(6, days - 3), daysUntil: days, overdue: false, reason: `llega en ${days} días` };
  return { score: 2, daysUntil: days, overdue: false, reason: null };
}

function projectPressure(task: IntelligenceTask, projects: IntelligenceProject[]) {
  const project = projects.find((item) => item.name === task.project);
  if (!project) return { score: 0, reason: null as string | null };
  const priority = normalized(project.priority);
  const status = normalized(project.status);
  let score = priority === "alta" || priority === "urgente" ? 7 : priority === "media" ? 3 : 0;
  if (["produccion", "preproduccion", "seguimiento"].includes(status)) score += 4;
  return {
    score,
    reason: score >= 7 ? `su proyecto está en ${project.status} y con prioridad ${project.priority}` : null,
  };
}

export function rankTasks<T extends IntelligenceTask>(
  tasks: T[],
  projects: IntelligenceProject[] = [],
  now = new Date(),
): RankedTask<T>[] {
  const active = tasks.filter((task) => !["terminado", "cancelado"].includes(normalized(task.status)));
  const projectLoad = new Map<string, number>();
  for (const task of active) projectLoad.set(task.project, (projectLoad.get(task.project) || 0) + 1);

  return active
    .map((task) => {
      const reasons: string[] = [];
      let score = priorityWeight(task.priority) + statusWeight(task);
      const priority = normalized(task.priority);
      if (priority === "urgente" || priority === "alta") reasons.push(`prioridad ${task.priority.toLocaleLowerCase("es")}`);

      const date = datePressure(task, now);
      score += date.score;
      if (date.reason) reasons.push(date.reason);

      const project = projectPressure(task, projects);
      score += project.score;
      if (project.reason) reasons.push(project.reason);

      const siblings = projectLoad.get(task.project) || 0;
      if (siblings >= 5 && task.project && task.project !== "Por asignar") {
        score += Math.min(8, siblings);
        reasons.push(`${siblings} tareas activas compiten dentro del proyecto`);
      }

      if (!task.dateStart && (priority === "urgente" || priority === "alta")) {
        score += 8;
        reasons.push("es importante pero no tiene hueco en calendario");
      }

      return {
        task,
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons: reasons.slice(0, 3),
        daysUntil: date.daysUntil,
        overdue: date.overdue,
      };
    })
    .sort((a, b) => b.score - a.score || (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
}

export function buildLifeIntelligence<T extends IntelligenceTask>(
  tasks: T[],
  projects: IntelligenceProject[] = [],
  now = new Date(),
) {
  const ranked = rankTasks(tasks, projects, now);
  const overdue = ranked.filter((item) => item.overdue).length;
  const today = ranked.filter((item) => item.daysUntil === 0).length;
  const next48 = ranked.filter((item) => item.daysUntil != null && item.daysUntil >= 0 && item.daysUntil <= 2).length;
  const undatedHigh = ranked.filter((item) => {
    const priority = normalized(item.task.priority);
    return !item.task.dateStart && (priority === "alta" || priority === "urgente");
  }).length;
  const top = ranked[0] ?? null;

  let summary = "Hoy está bastante limpio.";
  if (overdue) summary = `${overdue} ${overdue === 1 ? "tarea necesita" : "tareas necesitan"} rescate antes de seguir abriendo frentes.`;
  else if (top?.score && top.score >= 70) summary = `${top.task.name} concentra la mayor presión ahora mismo.`;
  else if (next48) summary = `Hay ${next48} ${next48 === 1 ? "movimiento" : "movimientos"} que entran en las próximas 48 horas.`;
  else if (ranked.length) summary = "No hay incendios, pero sí trabajo que conviene ordenar antes de que aprenda a arder.";

  const detail = top
    ? top.reasons.length
      ? `La pondría primero porque ${top.reasons.join(", ")}.`
      : "Es la siguiente acción con mejor relación entre prioridad, estado y calendario."
    : "No hay tareas activas que requieran atención.";

  let risk = "Sin señales raras.";
  if (overdue >= 2) risk = `Hay ${overdue} tareas vencidas. El riesgo ya no es de planificación, es de acumulación.`;
  else if (undatedHigh) risk = `${undatedHigh} ${undatedHigh === 1 ? "tarea importante no tiene" : "tareas importantes no tienen"} fecha. Eso suele convertirse en sorpresa, esa tradición corporativa tan entrañable.`;
  else if (next48 >= 4) risk = `${next48} tareas se concentran en 48 horas. Conviene repartir o cerrar antes de que el calendario empiece a cobrar venganza.`;

  return {
    ranked,
    top,
    stats: { active: ranked.length, overdue, today, next48, undatedHigh },
    summary,
    detail,
    risk,
  };
}

export function nextActionForProject<T extends IntelligenceTask>(
  projectName: string,
  tasks: T[],
  projects: IntelligenceProject[] = [],
  now = new Date(),
) {
  return rankTasks(tasks.filter((task) => task.project === projectName), projects, now)[0] ?? null;
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function withLocalOffset(date: Date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const tz = sign + String(Math.floor(abs / 60)).padStart(2, "0") + ":" + String(abs % 60).padStart(2, "0");
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00${tz}`;
}

function nextWeekday(now: Date, weekday: number) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  let distance = (weekday - date.getDay() + 7) % 7;
  if (distance === 0) distance = 7;
  date.setDate(date.getDate() + distance);
  return date;
}

function findNamedMatch(input: string, names: string[]) {
  const haystack = normalized(input);
  return names
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((name) => haystack.includes(normalized(name))) || null;
}

export function parseSmartCapture(
  input: string,
  projects: string[] = [],
  accounts: string[] = [],
  now = new Date(),
): SmartCapture {
  const raw = input.trim();
  const source = normalized(raw);
  const signals: string[] = [];

  let priority = "Media";
  if (/\b(urgente|urgencia|ya)\b/.test(source)) {
    priority = "Urgente";
    signals.push("prioridad urgente");
  } else if (/\b(prioridad alta|importante|alta prioridad)\b/.test(source)) {
    priority = "Alta";
    signals.push("prioridad alta");
  } else if (/\b(prioridad baja|cuando pueda|sin prisa)\b/.test(source)) {
    priority = "Baja";
    signals.push("prioridad baja");
  }

  const project = findNamedMatch(raw, projects);
  if (project) signals.push(`proyecto · ${project}`);
  const account = findNamedMatch(raw, accounts);
  if (account) signals.push(`cuenta · ${account}`);

  let targetDate: Date | null = null;
  if (/\bpasado manana\b/.test(source)) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 2);
    signals.push("pasado mañana");
  } else if (/\bmanana\b/.test(source)) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    signals.push("mañana");
  } else if (/\bhoy\b/.test(source)) {
    targetDate = new Date(now);
    signals.push("hoy");
  } else {
    const weekdays: Array<[RegExp, number, string]> = [
      [/\blunes\b/, 1, "lunes"],
      [/\bmartes\b/, 2, "martes"],
      [/\bmiercoles\b/, 3, "miércoles"],
      [/\bjueves\b/, 4, "jueves"],
      [/\bviernes\b/, 5, "viernes"],
      [/\bsabado\b/, 6, "sábado"],
      [/\bdomingo\b/, 0, "domingo"],
    ];
    const matched = weekdays.find(([pattern]) => pattern.test(source));
    if (matched) {
      targetDate = nextWeekday(now, matched[1]);
      signals.push(matched[2]);
    }
  }

  const range = source.match(/\b(?:de\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:h)?\s+a\s+(\d{1,2})(?::(\d{2}))?\s*(?:h)?\b/);
  const atTime = source.match(/\ba\s+las\s+(\d{1,2})(?::(\d{2}))?\b/);
  const durationHours = source.match(/\bdurante\s+(\d+(?:[.,]\d+)?)\s*(?:h|hora|horas)\b/);
  const durationMinutes = source.match(/\bdurante\s+(\d+)\s*(?:min|minutos)\b/);

  let dateStart: string | null = null;
  let dateEnd: string | null = null;
  if (targetDate) {
    targetDate.setSeconds(0, 0);
    if (range) {
      targetDate.setHours(Number(range[1]), Number(range[2] || 0), 0, 0);
      const end = new Date(targetDate);
      end.setHours(Number(range[3]), Number(range[4] || 0), 0, 0);
      if (end <= targetDate) end.setDate(end.getDate() + 1);
      dateStart = withLocalOffset(targetDate);
      dateEnd = withLocalOffset(end);
      signals.push(`${String(targetDate.getHours()).padStart(2, "0")}:${String(targetDate.getMinutes()).padStart(2, "0")}–${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
    } else if (atTime) {
      targetDate.setHours(Number(atTime[1]), Number(atTime[2] || 0), 0, 0);
      dateStart = withLocalOffset(targetDate);
      const end = new Date(targetDate);
      if (durationHours) end.setMinutes(end.getMinutes() + Math.round(Number(durationHours[1].replace(",", ".")) * 60));
      else if (durationMinutes) end.setMinutes(end.getMinutes() + Number(durationMinutes[1]));
      else end.setMinutes(end.getMinutes() + 60);
      dateEnd = withLocalOffset(end);
      signals.push(`${String(targetDate.getHours()).padStart(2, "0")}:${String(targetDate.getMinutes()).padStart(2, "0")}`);
    } else {
      dateStart = localDateKey(targetDate);
    }
  }

  let title = raw
    .replace(/\bpasado mañana\b/gi, "")
    .replace(/\b(hoy|mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi, "")
    .replace(/\b(?:de\s+)?\d{1,2}(?::\d{2})?\s*(?:h)?\s+a\s+\d{1,2}(?::\d{2})?\s*(?:h)?\b/gi, "")
    .replace(/\ba\s+las\s+\d{1,2}(?::\d{2})?\b/gi, "")
    .replace(/\bdurante\s+\d+(?:[.,]\d+)?\s*(?:h|hora|horas|min|minutos)\b/gi, "")
    .replace(/\b(prioridad alta|alta prioridad|prioridad baja|urgente|urgencia|importante|sin prisa)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();

  if (!title) title = raw;
  title = title.charAt(0).toLocaleUpperCase("es") + title.slice(1);

  const confidence = Math.min(0.96, 0.42 + signals.length * 0.11);
  return { title, priority, project, account, dateStart, dateEnd, confidence, signals };
}
