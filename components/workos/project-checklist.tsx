'use client';

import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentBlock } from '@/app/lib/page-content';

type ChecklistItem = Pick<ContentBlock, 'id' | 'text' | 'checked'>;

export function ProjectChecklist({ pageId }: { pageId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setItems([]); setEditing(null); setNewItem('');
    fetch(`/api/notion/content?id=${encodeURIComponent(pageId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data: { blocks: ContentBlock[] }) => setItems(data.blocks.filter((block) => block.type === 'to_do')))
      .catch((error) => { if (error.name !== 'AbortError') toast.error('No se ha podido cargar la checklist'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [pageId]);

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    const response = await fetch('/api/notion/content', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, ...body }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se ha podido guardar en Notion');
    return result;
  }

  async function add() {
    const text = newItem.trim();
    if (!text || busy) return;
    setBusy('new');
    try {
      const result = await mutate('POST', { type: 'to_do', text });
      if (!result.id) throw new Error('No se recibió el nuevo bloque');
      setItems((current) => [...current, { id: result.id, text: [{ text }], checked: false }]);
      setNewItem('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Error al añadir pendiente'); }
    finally { setBusy(null); }
  }

  async function toggle(item: ChecklistItem) {
    if (busy) return;
    setBusy(item.id);
    try {
      await mutate('PATCH', { blockId: item.id, checked: !item.checked });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, checked: !item.checked } : entry));
    } catch { toast.error('No se pudo actualizar el pendiente'); }
    finally { setBusy(null); }
  }

  async function save(item: ChecklistItem) {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(item.id);
    try {
      await mutate('PATCH', { blockId: item.id, text });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, text: [{ text }] } : entry));
      setEditing(null);
    } catch { toast.error('No se pudo editar el pendiente'); }
    finally { setBusy(null); }
  }

  async function remove(item: ChecklistItem) {
    if (!window.confirm('¿Quitar este pendiente? Podrás recuperarlo desde la papelera de Notion.')) return;
    if (busy) return;
    setBusy(item.id);
    try {
      await mutate('DELETE', { blockId: item.id });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch { toast.error('No se pudo quitar el pendiente'); }
    finally { setBusy(null); }
  }

  const done = items.filter((item) => item.checked).length;
  return <article className="project-checklist-card project-widget" aria-label="Checklist del proyecto">
    <div className="workspace-section-head module-head"><div><span>PRODUCCIÓN</span><h2>Checklist</h2></div><small>{done}/{items.length}</small></div>
    <div className="project-checklist-list project-widget-scroll">
      {loading && <p className="project-widget-empty">Cargando pendientes…</p>}
      {!loading && !items.length && <p className="project-widget-empty">Sin pendientes. Añade el primero.</p>}
      {items.map((item) => <div className={`project-checklist-row ${item.checked ? 'checked' : ''}`} key={item.id}>
        <button type="button" className="project-checklist-tick" disabled={Boolean(busy)} onClick={() => toggle(item)} aria-label={item.checked ? 'Marcar pendiente' : 'Marcar completado'}>{item.checked && <Check size={13} />}</button>
        {editing === item.id ? <input aria-label="Editar pendiente" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(item); if (event.key === 'Escape') setEditing(null); }} /> : <span title={item.text.map((part) => part.text).join('')}>{item.text.map((part) => part.text).join('')}</span>}
        {editing === item.id ? <><button disabled={Boolean(busy)} title="Guardar" onClick={() => save(item)}><Save size={13} /></button><button title="Cancelar" onClick={() => setEditing(null)}><X size={13} /></button></> : <><button title="Editar pendiente" onClick={() => { setEditing(item.id); setDraft(item.text.map((part) => part.text).join('')); }}><Pencil size={13} /></button><button title="Quitar pendiente" disabled={Boolean(busy)} onClick={() => remove(item)}><Trash2 size={13} /></button></>}
      </div>)}
    </div>
    <div className="project-checklist-create"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Añadir pendiente…" onKeyDown={(event) => { if (event.key === 'Enter') void add(); }} aria-label="Nuevo pendiente" /><button disabled={!newItem.trim() || Boolean(busy)} onClick={add} aria-label="Añadir pendiente"><Plus size={16} /></button></div>
  </article>;
}
