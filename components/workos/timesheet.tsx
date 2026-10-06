"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, ChevronLeft, ChevronRight, Clock3, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  buildTimesheet, currentWeekStart, PENDING_ACCOUNT, rebalanceDay, restoreDay, shiftDate, toggleWorkingDay,
  type SavedDay, type TimesheetHoliday, type TimesheetProject, type TimesheetTask,
} from "@/app/lib/timesheet";

const hoursLabel = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) => new Date(value + "T12:00:00Z").toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", ...options });

export function Timesheet({ projects, tasks, holidays, personName, dataState }: {
  projects: TimesheetProject[]; tasks: TimesheetTask[]; holidays: TimesheetHoliday[];
  personName: string; dataState: "loading" | "live" | "error";
}) {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const storageKey = `workos.timesheet.v1.${encodeURIComponent(personName)}.${weekStart}`;
  const [draft, setDraft] = useState<{ key: string; days: Record<string, SavedDay> }>({ key: "", days: {} });
  const [confirmReset, setConfirmReset] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [copied, setCopied] = useState(false);
  const ready = draft.key === storageKey && dataState === "live";
  const savedDays = draft.key === storageKey ? draft.days : {};
  const proposal = useMemo(() => buildTimesheet({ projects, tasks, holidays, personName, weekStart }), [projects, tasks, holidays, personName, weekStart]);

  // The browser owns this draft; hydrate it after SSR and whenever its storage key changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const restored: Record<string, SavedDay> = {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (let index = 0; index < 5; index++) {
          const date = shiftDate(weekStart, index);
          const day = restoreDay(parsed[date]);
          if (day) restored[date] = day;
        }
      }
      setStorageAvailable(true);
    } catch { setStorageAvailable(false); }
    setDraft({ key: storageKey, days: restored });
    setConfirmReset(false);
    setCopied(false);
  }, [storageKey, weekStart]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const days = proposal.map(day => {
    const saved = savedDays[day.date];
    if (day.absence) return day;
    if (!saved) return day;
    return { ...day, hours: saved.hours, office: saved.off ? 0 : 2, absence: saved.off ? "No laborable" : null, needsReview: !saved.off && Boolean(saved.hours[PENDING_ACCOUNT]) };
  });
  const accountNames = Array.from(new Set(days.flatMap(day => Object.keys(day.hours))));
  const totalFor = (account: string) => days.reduce((total, day) => total + (day.hours[account] || 0), 0);
  accountNames.sort((a, b) => totalFor(b) - totalFor(a) || a.localeCompare(b, "es"));
  const officeTotal = days.reduce((sum, day) => sum + day.office, 0);
  const accountTotal = days.reduce((sum, day) => sum + Object.values(day.hours).reduce((a, b) => a + b, 0), 0);
  const pendingTotal = totalFor(PENDING_ACCOUNT);
  const modified = Object.keys(savedDays).length > 0;
  const weekEnd = shiftDate(weekStart, 4);
  const range = `${dateLabel(weekStart, { day: "numeric", month: "short" })} — ${dateLabel(weekEnd, { day: "numeric", month: "short", year: "numeric" })}`;

  function storeDays(next: Record<string, SavedDay>) {
    setDraft({ key: storageKey, days: next });
    setCopied(false);
    try {
      if (Object.keys(next).length) window.localStorage.setItem(storageKey, JSON.stringify(next));
      else window.localStorage.removeItem(storageKey);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
      toast.error("El ajuste se mantiene en pantalla, pero no se ha podido guardar en este navegador.");
    }
  }

  function edit(date: string, account: string, value: number) {
    const day = days.find(item => item.date === date);
    if (!ready || !day || day.absence) return;
    const current = Object.fromEntries(accountNames.map(name => [name, day.hours[name] || 0]));
    const hours = rebalanceDay(current, account, value);
    storeDays({ ...savedDays, [date]: { hours, off: false } });
  }

  function toggleDay(date: string) {
    const day = days.find(item => item.date === date);
    const base = proposal.find(item => item.date === date);
    if (!ready || !day || !base || base.absence) return;
    const current = savedDays[date] || { hours: day.hours, off: false };
    storeDays({ ...savedDays, [date]: toggleWorkingDay(current, base.hours) });
  }

  function reset() {
    if (modified && !confirmReset) { setConfirmReset(true); return; }
    storeDays({});
    setConfirmReset(false);
    toast.success("Borrador recalculado con la actividad disponible.");
  }

  async function copy() {
    const lines = [
      ["Cuenta", ...days.map(day => dateLabel(day.date, { weekday: "short", day: "2-digit", month: "2-digit" })), "Total"],
      ...accountNames.map(account => [account, ...days.map(day => hoursLabel(day.hours[account] || 0)), hoursLabel(totalFor(account))]),
      ["Oficina", ...days.map(day => hoursLabel(day.office)), hoursLabel(officeTotal)],
      ["TOTAL", ...days.map(day => hoursLabel(day.office + Object.values(day.hours).reduce((a, b) => a + b, 0))), hoursLabel(officeTotal + accountTotal)],
    ];
    try {
      await navigator.clipboard.writeText(lines.map(line => line.join("\t")).join("\n"));
      setCopied(true);
      toast.success("Horas copiadas. Puedes pegarlas como tabla.");
    } catch { toast.error("No se pudo copiar. Selecciona la tabla y cópiala manualmente."); }
  }

  return <section className="timesheet-view" aria-label="Imputación semanal">
    <header className="timesheet-header">
      <div><span className="timesheet-kicker">DEDICACIÓN SEMANAL</span><h2>Imputación</h2><p>{personName} · Borrador estimado</p></div>
      <div className="timesheet-navigation">
        <button type="button" aria-label="Semana anterior" onClick={() => setWeekStart(shiftDate(weekStart, -7))}><ChevronLeft /></button>
        <strong>{range}</strong>
        <button type="button" aria-label="Semana siguiente" onClick={() => setWeekStart(shiftDate(weekStart, 7))}><ChevronRight /></button>
        <button type="button" className="timesheet-current" onClick={() => setWeekStart(currentWeekStart())}>Esta semana</button>
      </div>
    </header>

    {dataState !== "live" ? <div className="timesheet-empty" role="status">{dataState === "loading" ? "Cargando proyectos y tareas…" : "No se han podido cargar los datos. Recarga WorkOS para generar el reparto."}</div> : <>
      <div className="timesheet-summary">
        <article className="timesheet-stat featured"><div><span>SEMANA</span><Clock3 /></div><strong>{hoursLabel(officeTotal + accountTotal)}<small>h</small></strong><p>{days.filter(day => !day.absence).length} días laborables · 8 h al día</p></article>
        <article className="timesheet-stat"><div><span>CUENTAS</span><BriefcaseBusiness /></div><strong>{hoursLabel(accountTotal - pendingTotal)}<small>h</small></strong><p>{accountNames.filter(name => name !== PENDING_ACCOUNT).length} cuentas en el reparto{pendingTotal ? ` · ${hoursLabel(pendingTotal)} h pendientes` : ""}</p></article>
        <article className="timesheet-stat"><div><span>OFICINA</span><Clock3 /></div><strong>{hoursLabel(officeTotal)}<small>h</small></strong><p>2 h diarias reservadas</p></article>
      </div>

      <div className="timesheet-sheet">
        <div className="timesheet-sheet-head"><div><span className="timesheet-kicker">POR CUENTA Y DÍA</span><h3>Tu reparto de horas</h3></div><div className="timesheet-actions">
          <button type="button" disabled={!ready} onClick={reset}><RotateCcw />Recalcular</button>
          <button type="button" className="timesheet-copy" disabled={!ready} onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? "Copiado" : "Copiar horas"}</button>
        </div></div>
        {confirmReset && <div className="timesheet-notice" role="alert"><span>Se eliminarán los ajustes de esta semana y se volverá al reparto propuesto.</span><button type="button" onClick={reset}>Recalcular borrador</button><button type="button" onClick={() => setConfirmReset(false)}>Conservar ajustes</button></div>}
        {pendingTotal > 0 && <p className="timesheet-warning" role="status">Hay {hoursLabel(pendingTotal)} h pendientes de asignar: faltan cuentas con actividad para esos días.</p>}
        <div className="timesheet-table-scroll"><table className="timesheet-table">
          <caption className="sr-only">Horas propuestas por cuenta, de lunes a viernes. Cada día laborable suma ocho horas.</caption>
          <thead><tr><th scope="col">Cuenta</th>{days.map(day => <th scope="col" key={day.date}><span>{dateLabel(day.date, { weekday: "short" })}</span><strong>{dateLabel(day.date, { day: "2-digit", month: "2-digit" })}</strong><label className="timesheet-day-toggle"><input type="checkbox" checked={!day.absence} disabled={!ready || Boolean(proposal.find(item => item.date === day.date)?.absence)} onChange={() => toggleDay(day.date)} /><small>{day.absence || "Laborable"}</small></label></th>)}<th scope="col">Total</th></tr></thead>
          <tbody>{accountNames.map(account => {
            const evidence = days.flatMap(day => day.evidence[account] ? [day.evidence[account]] : []);
            const projectNames = [...new Set(evidence.flatMap(item => item.projects))];
            const taskNames = [...new Set(evidence.flatMap(item => item.tasks))];
            return <tr key={account} className={account === PENDING_ACCOUNT ? "pending" : ""}>
              <th scope="row"><strong>{account}</strong><small>{account === PENDING_ACCOUNT ? "Revisar actividad" : `${projectNames.length} proyectos · ${taskNames.length} tareas`}</small>{(projectNames.length > 0 || taskNames.length > 0) && <details><summary>Ver actividad</summary><div>{projectNames.map(name => <span key={`p-${name}`}>Proyecto · {name}</span>)}{taskNames.map(name => <span key={`t-${name}`}>Tarea · {name}</span>)}</div></details>}</th>
              {days.map(day => <td key={day.date} className={day.absence ? "off" : ""}>{day.absence ? <span aria-label="No laborable">—</span> : <select aria-label={`${account}, ${dateLabel(day.date, { weekday: "long", day: "numeric" })}`} value={day.hours[account] || 0} disabled={!ready || accountNames.length < 2} onChange={event => edit(day.date, account, Number(event.target.value))}>{Array.from({ length: 13 }, (_, index) => <option key={index} value={index / 2}>{hoursLabel(index / 2)}</option>)}</select>}</td>)}
              <td className="timesheet-row-total">{hoursLabel(totalFor(account))}<small>h</small></td>
            </tr>;
          })}
          <tr className="timesheet-office-row"><th scope="row"><strong>Oficina</strong><small>Dirección, coordinación y gestión interna</small></th>{days.map(day => <td key={day.date} className={day.absence ? "off" : ""}>{day.absence ? "—" : hoursLabel(day.office)}</td>)}<td className="timesheet-row-total">{hoursLabel(officeTotal)}<small>h</small></td></tr>
          </tbody><tfoot><tr><th scope="row">Total diario</th>{days.map(day => <td key={day.date}>{hoursLabel(day.office + Object.values(day.hours).reduce((a, b) => a + b, 0))}<small>h</small></td>)}<td>{hoursLabel(officeTotal + accountTotal)}<small>h</small></td></tr></tfoot>
        </table></div>
        <div className="timesheet-sheet-foot"><span role="status">{storageAvailable ? modified ? "Ajustes guardados en este navegador" : "Propuesta según la actividad disponible" : "Sin guardado local · conserva una copia de las horas"}</span><span>Al cambiar una cifra se compensan las demás cuentas del día.</span></div>
      </div>
      <p className="timesheet-explanation">Las tareas de la semana pesan más que los proyectos sin tareas. Revisa el borrador antes de imputar; las semanas anteriores se estiman con la actividad disponible hoy.</p>
    </>}
  </section>;
}
