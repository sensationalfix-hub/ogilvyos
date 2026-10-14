"use client";

import { Check, ChevronRight, Link2, RotateCcw, Save, ShieldCheck } from "lucide-react";

export type EmployeeEditDraft = {
  name: string; role: string; assignment: string; contract: string; tier: string;
  email: string; salary: string; joined: string;
  base: string; convenio: string; puentes: string; semanaSanta: string; navidad: string;
  skills: string[]; growth: string[];
};
export type EmployeeEditPerson = {
  name: string; role: string; assignment: string; contract: string | null; tier: string | null;
  email: string | null; salary: number | null; joined: string | null;
  leaveAllowance?: { base: number | null; convenio: number | null; puentes: number | null; semanaSanta: number | null; navidad: number | null };
  skills: string[]; growth: string[];
  readonlyNotion?: Array<{ label: string; type: string; value: string }>;
};
export type EmployeeEditOptions = {
  role: string[]; assignment: string[]; contract: string[]; tier: string[];
  skills: string[]; growth: string[];
};
const textFields = ["name","role","assignment","contract","tier","email","joined"] as const;
const numberFields = ["salary","base","convenio","puentes","semanaSanta","navidad"] as const;

export function employeeEditDraft(person: EmployeeEditPerson): EmployeeEditDraft {
  const number = (value: number | null | undefined) => typeof value === "number" ? String(value) : "";
  return {
    name: person.name,
    role: person.role || "",
    assignment: person.assignment || "",
    contract: person.contract || "",
    tier: person.tier || "",
    email: person.email || "",
    salary: number(person.salary),
    joined: person.joined || "",
    base: number(person.leaveAllowance?.base),
    convenio: number(person.leaveAllowance?.convenio),
    puentes: number(person.leaveAllowance?.puentes),
    semanaSanta: number(person.leaveAllowance?.semanaSanta),
    navidad: number(person.leaveAllowance?.navidad),
    skills: [...(person.skills || [])],
    growth: [...(person.growth || [])],
  };
}

export function employeeEditChanges(before: EmployeeEditDraft, after: EmployeeEditDraft): Record<string,unknown> {
  const changes: Record<string,unknown> = {};
  for (const key of textFields) {
    if (before[key].trim() !== after[key].trim()) changes[key] = after[key].trim() || (key === "name" ? "" : null);
  }
  for (const key of numberFields) {
    if (before[key] !== after[key]) changes[key] = after[key].trim() === "" ? null : Number(after[key]);
  }
  for (const key of ["skills","growth"] as const) {
    if (JSON.stringify([...before[key]].sort()) !== JSON.stringify([...after[key]].sort())) changes[key] = after[key];
  }
  return changes;
}

function optionList(options: string[], current: string) {
  return Array.from(new Set([...options, ...(current && !options.includes(current) ? [current] : [])]));
}

function Choice({ label, value, values, onChange }: {
  label: string; value: string; values: string[]; onChange: (value: string) => void;
}) {
  return <label className="employee-edit-field">
    <span>{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Sin especificar</option>
      {optionList(values,value).map(item => <option value={item} key={item}>{item}</option>)}
    </select>
  </label>;
}
function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="employee-edit-field">
    <span>{label}</span>
    <input type="number" min="0" step="1" placeholder="Sin configurar" value={value} onChange={e => onChange(e.target.value)} />
  </label>;
}
function Chips({ label, values, options, onChange }: {
  label: string; values: string[]; options: string[]; onChange: (values: string[]) => void;
}) {
  return <div className="employee-edit-chips-group">
    <span className="employee-edit-field-label">{label}</span>
    <div className="employee-edit-chips">
      {optionList(options, values.find(value => !options.includes(value)) || "").map(item => {
        const checked = values.includes(item);
        return <button key={item} type="button" aria-pressed={checked} className={checked ? "selected" : ""} onClick={() => onChange(checked ? values.filter(value => value !== item) : [...values, item])}>
          {checked && <Check size={12} />} {item}
        </button>;
      })}
      {!options.length && !values.length && <small>Sin opciones configuradas en Notion</small>}
    </div>
  </div>;
}

export function EmployeeProfileEditor({
  draft, person, options, onChange, onSave, onCancel, saving, changed,
}: {
  draft: EmployeeEditDraft;
  person: EmployeeEditPerson;
  options: EmployeeEditOptions;
  onChange: (change: Partial<EmployeeEditDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  changed: boolean;
}) {
  const update = <K extends keyof EmployeeEditDraft>(key: K, value: EmployeeEditDraft[K]) => onChange({ [key]: value } as Partial<EmployeeEditDraft>);
  const readonly = person.readonlyNotion || [];
  return <section className="employee-edit-panel" aria-label="Editar datos de empleado">
    <header className="employee-edit-panel-head">
      <div>
        <span className="employee-edit-eyebrow">PERFIL / NOTION EN VIVO</span>
        <h3>Datos del empleado</h3>
        <p>Modifica las propiedades originales. Los resultados calculados permanecen protegidos.</p>
      </div>
      <div className="employee-edit-panel-actions">
        <button className="employee-edit-cancel" type="button" disabled={saving} onClick={onCancel}><RotateCcw size={15}/> Cancelar</button>
        <button className="employee-edit-save" type="button" disabled={!changed || saving} onClick={onSave}><Save size={15}/> {saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </header>
    <div className="employee-edit-sections">
      <section className="employee-edit-section">
        <div className="employee-edit-section-heading"><span>01 / IDENTIDAD</span><h4>Perfil y situación</h4></div>
        <div className="employee-edit-fields">
          <label className="employee-edit-field wide"><span>Nombre completo</span><input type="text" maxLength={200} value={draft.name} onChange={e => update("name",e.target.value)}/></label>
          <Choice label="Rol" value={draft.role} values={options.role} onChange={value => update("role",value)}/>
          <Choice label="Asignación" value={draft.assignment} values={options.assignment} onChange={value => update("assignment",value)}/>
          <Choice label="Contrato" value={draft.contract} values={options.contract} onChange={value => update("contract",value)}/>
          <Choice label="Rating" value={draft.tier} values={options.tier} onChange={value => update("tier",value)}/>
          <label className="employee-edit-field"><span>Email</span><input type="email" autoComplete="off" value={draft.email} placeholder="Sin email" onChange={e => update("email",e.target.value)}/></label>
          <label className="employee-edit-field"><span>Incorporación</span><input type="date" value={draft.joined.slice(0,10)} onChange={e => update("joined",e.target.value)}/></label>
        </div>
      </section>
      <section className="employee-edit-section">
        <div className="employee-edit-section-heading"><span>02 / CONDICIONES</span><h4>Retribución y días disponibles</h4></div>
        <div className="employee-edit-fields">
          <label className="employee-edit-field wide"><span>Sueldo bruto anual (€)</span><input type="number" min="0" max="1000000000" step="0.01" placeholder="Sin configurar" value={draft.salary} onChange={e => update("salary",e.target.value)}/></label>
          <NumberField label="Vacaciones base" value={draft.base} onChange={value => update("base",value)}/>
          <NumberField label="Convenio" value={draft.convenio} onChange={value => update("convenio",value)}/>
          <NumberField label="Puentes" value={draft.puentes} onChange={value => update("puentes",value)}/>
          <NumberField label="Semana Santa" value={draft.semanaSanta} onChange={value => update("semanaSanta",value)}/>
          <NumberField label="Navidad" value={draft.navidad} onChange={value => update("navidad",value)}/>
        </div>
      </section>
      <section className="employee-edit-section">
        <div className="employee-edit-section-heading"><span>03 / TALENTO</span><h4>Capacidades y desarrollo</h4></div>
        <Chips label="Skills" values={draft.skills} options={options.skills} onChange={value => update("skills",value)} />
        <Chips label="Áreas de crecimiento" values={draft.growth} options={options.growth} onChange={value => update("growth",value)}/>
      </section>
    </div>
    <details className="employee-edit-computed">
      <summary><span><ShieldCheck size={17}/> <b>Fórmulas, rollups y relaciones de Notion</b><small>{readonly.length} propiedades de solo lectura</small></span><ChevronRight size={17}/></summary>
      <p>Estos valores dependen de tareas, proyectos, evaluaciones, vacaciones u otras fórmulas. Para preservar sus relaciones se actualizan desde sus vistas de origen.</p>
      <div className="employee-edit-computed-grid">
        {readonly.map(item => <div key={item.label}><small>{item.label}</small><strong>{item.value || "—"}</strong><em>{item.type}</em></div>)}
        {!readonly.length && <span>Los datos calculados están disponibles en Notion.</span>}
      </div>
      <a className="employee-edit-open-notion" href={(person as EmployeeEditPerson & {url?: string}).url || "#"} target="_blank" rel="noopener noreferrer"><Link2 size={14}/> Ver ficha original en Notion</a>
    </details>
  </section>;
}
