export const PENDING_ACCOUNT = "Pendiente de asignar";
export type TimesheetProject = { id: string; name: string; account: string; status: string };
export type TimesheetTask = {
  id: string; name: string; account: string; project: string; status: string;
  workosLane?: string | null; dateStart?: string | null; dateEnd?: string | null;
};
export type TimesheetHoliday = { name: string; start: string; end: string; type: string; segment?: string; category?: string };
export type SavedDay = { hours: Record<string, number>; off: boolean; resumeHours?: Record<string, number> };
export type TimesheetDay = {
  date: string; office: number; hours: Record<string, number>; weights: Record<string, number>;
  evidence: Record<string, { projects: string[]; tasks: string[] }>;
  absence: string | null; needsReview: boolean;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_\s]+/g, " ").trim();
// Personal imputation exclusions: Carmen is proactive; ING is daily work with negligible dedication.
const excludedFromImputation = (value: string) => ["carmen", "ing"].includes(normalize(value));
const assigned = (value: string) => Boolean(value && !["sin cuenta", "por asignar", "sin asignar"].includes(normalize(value)));
const madridDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

export function dateKey(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!value.includes("T")) return null;
  // Unzoned local timestamps already describe the operational day.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? madridDate.format(date) : null;
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function currentWeekStart(): string {
  const today = madridDate.format(new Date());
  const weekday = new Date(today + "T12:00:00Z").getUTCDay();
  return shiftDate(today, -(weekday === 0 ? 6 : weekday - 1));
}

function allocate(weights: Record<string, number>, units = 12): Record<string, number> {
  const entries = Object.entries(weights);
  if (!entries.length) return { [PENDING_ACCOUNT]: units / 2 };
  const sum = entries.reduce((total, [, weight]) => total + Math.max(0, weight), 0);
  const slices = entries.map(([account, weight], index) => {
    const exact = sum > 0 ? Math.max(0, weight) / sum * units : units / entries.length;
    return { account, units: Math.floor(exact), remainder: exact % 1, index };
  });
  const remainder = units - slices.reduce((total, slice) => total + slice.units, 0);
  [...slices].sort((a, b) => b.remainder - a.remainder || a.index - b.index).slice(0, remainder).forEach(slice => slice.units++);
  return Object.fromEntries(slices.map(slice => [slice.account, slice.units / 2]));
}

function isOpen(project: TimesheetProject) {
  const status = normalize(project.status);
  return !/(terminad|completad|cerrad|cancelad|archivad|stand ?by|pausa)/.test(status);
}

export function buildTimesheet(input: {
  projects: TimesheetProject[]; tasks: TimesheetTask[]; holidays: TimesheetHoliday[];
  personName: string; weekStart: string;
}): TimesheetDay[] {
  const end = shiftDate(input.weekStart, 4);
  const open = input.projects.filter(project => isOpen(project) && assigned(project.account) && !excludedFromImputation(project.name));
  const seen = new Set<string>();
  const tasks = input.tasks.filter(task => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    if (excludedFromImputation(task.project)) return false;
    const linked = input.projects.filter(project => project.name === task.project);
    if (linked.length > 0 && linked.every(project => !isOpen(project))) return false;
    const status = normalize(task.workosLane || task.status);
    if (/(cancelad|backlog|pausa|archivad)/.test(status)) return false;
    const start = dateKey(task.dateStart);
    const finish = dateKey(task.dateEnd) || start;
    if (start) return start <= end && (finish || start) >= input.weekStart;
    return /(progreso|pendiente|curso|doing|todo)/.test(status);
  });
  const person = normalize(input.personName);
  return Array.from({ length: 5 }, (_, index) => {
    const date = shiftDate(input.weekStart, index);
    const absence = input.holidays.find(holiday => {
      const start = dateKey(holiday.start), finish = dateKey(holiday.end) || start;
      if (!start || !finish || date < start || date > finish) return false;
      if (holiday.segment === "Festivo" || holiday.category === "Festivo" || normalize(holiday.type) === "festivo") return true;
      const name = normalize(holiday.name);
      const matchesPerson = person && (name === person || (!person.includes(" ") && name.split(" ")[0] === person));
      return matchesPerson && !/turno/.test(normalize(holiday.type));
    });
    const weights: Record<string, number> = {};
    const evidence: TimesheetDay["evidence"] = {};
    const add = (account: string, weight: number, kind: "projects" | "tasks", name: string) => {
      if (!assigned(account) || excludedFromImputation(account)) return;
      weights[account] = (weights[account] || 0) + weight;
      evidence[account] ||= { projects: [], tasks: [] };
      if (!evidence[account][kind].includes(name)) evidence[account][kind].push(name);
    };
    open.forEach(project => add(project.account, 1, "projects", project.name));
    tasks.forEach(task => {
      const start = dateKey(task.dateStart), finish = dateKey(task.dateEnd) || start;
      if (start && (date < start || date > (finish || start))) return;
      let account = task.account;
      if (!assigned(account)) {
        const matches = input.projects.filter(project => project.name === task.project);
        const candidates = [...new Set(matches.map(project => project.account).filter(assigned))];
        if (candidates.length !== 1) return;
        account = candidates[0];
      }
      const progress = /(progreso|curso|doing)/.test(normalize(task.workosLane || task.status));
      let weight = start ? 4 : progress ? 3 : 1;
      if (start && task.dateStart?.includes("T") && task.dateEnd?.includes("T")) {
        const duration = (new Date(task.dateEnd).getTime() - new Date(task.dateStart).getTime()) / 3600000;
        if (Number.isFinite(duration) && duration > 0) weight += Math.min(8, duration) * 2;
      }
      add(account, weight, "tasks", task.name);
    });
    return {
      date, office: absence ? 0 : 2, hours: absence ? {} : allocate(weights), weights, evidence,
      absence: absence ? absence.type : null, needsReview: !absence && Object.keys(weights).length === 0,
    };
  });
}

export function rebalanceDay(hours: Record<string, number>, account: string, value: number): Record<string, number> {
  if (!(account in hours) || !Number.isFinite(value)) return hours;
  const others = Object.fromEntries(Object.entries(hours).filter(([key]) => key !== account));
  if (!Object.keys(others).length) return { [account]: 6 };
  const units = Math.max(0, Math.min(12, Math.round(value * 2)));
  return { [account]: units / 2, ...allocate(others, 12 - units) };
}

export function restoreDay(value: unknown): SavedDay | null {
  if (!value || typeof value !== "object") return null;
  const { off, hours, resumeHours } = value as Partial<SavedDay>;
  if (typeof off !== "boolean" || !hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const entries = Object.entries(hours);
  if (entries.some(([name, number]) => !name.trim() || typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 6 || !Number.isInteger(number * 2))) return null;
  const total = entries.reduce((sum, [, number]) => sum + number, 0);
  if (off ? total !== 0 : total !== 6) return null;
  if (off && resumeHours) {
    const resume = restoreDay({ off: false, hours: resumeHours });
    if (resume) return { off, hours: {}, resumeHours: resume.hours };
  }
  const eligible = entries.filter(([name]) => !excludedFromImputation(name));
  return { off, hours: !off && eligible.length !== entries.length ? allocate(Object.fromEntries(eligible)) : Object.fromEntries(eligible) };
}

export function toggleWorkingDay(current: SavedDay, fallbackHours: Record<string, number>): SavedDay {
  return current.off
    ? { off: false, hours: current.resumeHours || fallbackHours }
    : { off: true, hours: {}, resumeHours: current.hours };
}
