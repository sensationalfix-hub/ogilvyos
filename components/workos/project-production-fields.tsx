'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

export function ProjectProductionFields({ projectId, budget, companies, onSave }: {
  projectId: string;
  budget?: number | null;
  companies: string[];
  onSave: (changes: Record<string, unknown>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(budget == null ? '' : String(budget));
  const [producer, setProducer] = useState('');

  useEffect(() => { setAmount(budget == null ? '' : String(budget)); }, [projectId, budget]);
  useEffect(() => { setProducer(''); }, [projectId]);

  function saveAmount() {
    const normalized = amount.replace(/\s/g, '').replace(',', '.');
    if (normalized && (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || !Number.isFinite(Number(normalized)))) {
      setAmount(budget == null ? '' : String(budget));
      return;
    }
    const next = normalized === '' ? null : Number(normalized);
    if (next !== (budget ?? null)) void onSave({ budget: next });
  }

  function addCompany() {
    const value = producer.trim();
    if (!value || companies.some((name) => name.toLocaleLowerCase('es') === value.toLocaleLowerCase('es'))) { setProducer(''); return; }
    void onSave({ productionCompanies: [...companies, value] });
    setProducer('');
  }

  return <div className="project-production-fields">
    <label className="project-budget-field"><span>Presupuesto estimado</span><div><input type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} onBlur={saveAmount} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="Sin presupuesto" aria-label="Presupuesto en euros" /><b>€</b></div></label>
    <div className="project-companies-field"><span>Productoras</span><div className="project-company-tags">{companies.map((name) => <button type="button" key={name} title={`Quitar ${name}`} onClick={() => void onSave({ productionCompanies: companies.filter((item) => item !== name) })}>{name}<X size={12} /></button>)}</div>
      <div className="project-company-add"><input value={producer} onChange={(event) => setProducer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCompany(); }} placeholder="Añadir productora…" aria-label="Nombre de la productora" /><button type="button" onClick={addCompany} aria-label="Añadir productora" disabled={!producer.trim()}><Plus size={15} /></button></div>
    </div>
  </div>;
}
