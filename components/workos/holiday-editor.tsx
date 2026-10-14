"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type HolidayRecord = {
  id?: string;
  name: string;
  type: string;
  start: string;
  end: string;
  segment?: string;
  label?: string;
};

export type HolidayDraft = { id?: string; name: string; type: string; start: string; end: string };
export type HolidayPerson = {
  id: string;
  name: string;
  leaveUsage?: { remainingVacationDays: number | null };
};

const types = [
  { value: "Libres", label: "Vacaciones" },
  { value: "Convenio", label: "Libre disposición / convenio" },
  { value: "Puente", label: "Puente" },
  { value: "Semana Santa", label: "Semana Santa" },
  { value: "Navidad", label: "Navidad" },
  { value: "Mudanza", label: "Mudanza" },
  { value: "Enfermedad", label: "Enfermedad" },
  { value: "Pendientes", label: "Pendiente de confirmar" },
];

function dateCount(start: string, end: string, records: HolidayRecord[]): number {
  if (!start || !end || end < start) return 0;
  const first = Date.parse(start + "T12:00:00Z");
  const last = Date.parse(end + "T12:00:00Z");
  if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > 367 * 86400000) return 0;
  const publicDates = new Set<string>();
  records.filter(h => h.segment === "Festivo").forEach(h => {
    let time = Date.parse(h.start + "T12:00:00Z");
    const finish = Date.parse(h.end + "T12:00:00Z");
    for (let i = 0; i < 367 && time <= finish; i++, time += 86400000)
      publicDates.add(new Date(time).toISOString().slice(0, 10));
  });
  let result = 0;
  for (let time = first; time <= last; time += 86400000) {
    const date = new Date(time), weekday = date.getUTCDay();
    if (weekday > 0 && weekday < 6 && !publicDates.has(date.toISOString().slice(0, 10))) result++;
  }
  return result;
}

export function HolidayEditor({ draft, onClose, onSaved, team, holidays }: {
  draft: HolidayDraft | null;
  onClose: () => void;
  onSaved: (start: string) => Promise<void>;
  team: HolidayPerson[];
  holidays: HolidayRecord[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<HolidayDraft | null>(null);
  const current = form || draft;
  // Draft is reset explicitly by remounting via the key provided by the parent.
  const person = team.find(p => p.name === current?.name);
  const count = current ? dateCount(current.start, current.end, holidays) : 0;
  const change = (changes: Partial<HolidayDraft>) => {
    if (current) { setForm({ ...current, ...changes }); setError(""); }
  };
  async function submit(action: "save" | "delete") {
    if (!current || saving) return;
    if (action === "delete" && !current.id) return;
    if (action === "delete" && !window.confirm("¿Eliminar esta ausencia del calendario y de Notion?")) return;
    if (action === "save") {
      if (!current.name || !current.start || !current.end || current.end < current.start) {
        setError("Selecciona una persona y un rango de fechas válido.");
        return;
      }
      const overlap = holidays.find(h =>
        h.segment !== "Festivo" && h.id !== current.id &&
        h.name === current.name && h.start <= current.end && h.end >= current.start
      );
      if (overlap) { setError("Ya existe otra ausencia en estas fechas: " + overlap.type + " · " + (overlap.label || overlap.start)); return; }
    }
    setSaving(true);
    setError("");
    try {
      const method = action === "delete" ? "DELETE" : current.id ? "PATCH" : "POST";
      const response = await fetch("/api/notion/holidays", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo guardar en Notion");
      try {
        await onSaved(current.start);
        toast.success(action === "delete" ? "Ausencia eliminada" : current.id ? "Ausencia actualizada" : "Ausencia añadida", { description: "Sincronizado con Notion." });
        onClose();
      } catch {
        toast.success("Guardado en Notion");
        setError("El cambio se ha guardado, pero el calendario no se ha podido recargar. Actualiza la página.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación");
    } finally { setSaving(false); }
  }
  return <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="holiday-editor-dialog">
      <DialogHeader>
        <span className="sheet-kicker">{current?.id ? "EDITAR AUSENCIA" : "NUEVA AUSENCIA"}</span>
        <DialogTitle>{current?.id ? "Modificar días libres" : "Añadir días al calendario"}</DialogTitle>
        <DialogDescription>Persona, tipo y fechas. WorkOS se encarga del resto en Notion.</DialogDescription>
      </DialogHeader>
      {current && <div className="holiday-editor-form">
        <label>Persona
          <select value={current.name} onChange={e => change({ name:e.target.value })} disabled={saving}>
            <option value="" disabled>Seleccionar persona</option>
            {team.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </label>
        <label>Tipo de ausencia
          <select value={current.type} onChange={e => change({ type:e.target.value })} disabled={saving}>
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <div className="holiday-editor-dates">
          <label>Desde
            <input type="date" disabled={saving} value={current.start} onChange={e => change({ start:e.target.value, end: current.end < e.target.value ? e.target.value : current.end })} />
          </label>
          <label>Hasta (incluido)
            <input type="date" disabled={saving} value={current.end} min={current.start} onChange={e => change({ end:e.target.value })} />
          </label>
        </div>
        <div className="holiday-editor-summary">
          <strong>{count} {count === 1 ? "día laborable" : "días laborables"}</strong>
          <span>Excluye fines de semana y los festivos comunes visibles en Notion.</span>
          {current.type === "Libres" && <span>Saldo actual de {person?.name || "la persona"}: {person?.leaveUsage?.remainingVacationDays ?? "sin configurar"} días base. Se actualizará después de guardar.</span>}
        </div>
        {error && <div className="holiday-editor-error" role="alert">{error}</div>}
        <div className="holiday-editor-actions">
          {current.id ? <button className="holiday-danger" type="button" disabled={saving} onClick={() => submit("delete")}>Eliminar ausencia</button> : <span />}
          <button className="holiday-save" type="button" disabled={saving || !current.name || !current.start || !current.end || current.end < current.start} onClick={() => submit("save")}>{saving ? "Guardando…" : current.id ? "Guardar cambios" : "Añadir ausencia"}</button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}
