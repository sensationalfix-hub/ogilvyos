'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { safeContentUrl, type ContentBlock, type ContentText } from '@/app/lib/page-content';

const textTypes = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout', 'code', 'toggle', 'to_do']);
const mediaTypes = new Set(['image', 'video', 'audio', 'pdf', 'file', 'bookmark', 'embed']);
const newTypes = [
  { value: 'paragraph', label: 'Texto' }, { value: 'heading_2', label: 'Título' },
  { value: 'heading_3', label: 'Subtítulo' }, { value: 'bulleted_list_item', label: 'Lista' },
  { value: 'numbered_list_item', label: 'Lista numerada' }, { value: 'quote', label: 'Cita' },
  { value: 'to_do', label: 'Casilla' },
];
type PageData = { blocks: ContentBlock[]; updatedAt: string };

function RichText({ text }: { text: ContentText[] }) {
  return <>{text.map((part, index) => {
    const content = part.code ? <code>{part.text}</code> : <span style={{ fontWeight: part.bold ? 700 : undefined, fontStyle: part.italic ? 'italic' : undefined, textDecoration: part.strike ? 'line-through' : undefined }}>{part.text}</span>;
    const href = safeContentUrl(part.href);
    return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{content}</a> : <span key={index}>{content}</span>;
  })}</>;
}

function replaceBlock(blocks: ContentBlock[], id: string, changes: Partial<ContentBlock>): ContentBlock[] {
  return blocks.map((block) => block.id === id ? { ...block, ...changes } : { ...block, children: replaceBlock(block.children, id, changes) });
}
function removeBlock(blocks: ContentBlock[], id: string): ContentBlock[] {
  return blocks.filter((block) => block.id !== id).map((block) => ({ ...block, children: removeBlock(block.children, id) }));
}

export function ProjectDocumentation({ pageId, pageUrl }: { pageId: string; pageUrl: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [newType, setNewType] = useState('paragraph');
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setLoadingError(false); setEditing(null);
    fetch(`/api/notion/content?id=${encodeURIComponent(pageId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setData)
      .catch((error) => { if (error.name !== 'AbortError') setLoadingError(true); });
    return () => controller.abort();
  }, [pageId, reload]);

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    const response = await fetch('/api/notion/content', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, ...body }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Notion no ha podido guardar el cambio');
    return result;
  }

  async function save(block: ContentBlock) {
    if (busy) return;
    const isMedia = mediaTypes.has(block.type);
    const isTable = block.type === 'table_row';
    const previous = isMedia ? block.url || '' : isTable ? block.cells?.map((cell) => cell.map((part) => part.text).join('')).join('\t') || '' : block.text.map((item) => item.text).join('');
    if (draft === previous && (!isMedia || captionDraft === (block.caption || ''))) { setEditing(null); return; }
    setBusy(block.id);
    try {
      const cells = isTable ? draft.split('\t') : [];
      const changes = isMedia ? { ...(draft !== previous ? { url: draft.trim() } : {}), ...(captionDraft !== (block.caption || '') ? { caption: captionDraft } : {}) } : isTable ? { cells } : { text: draft };
      await mutate('PATCH', { blockId: block.id, ...changes });
      setData((current) => current ? { ...current, blocks: replaceBlock(current.blocks, block.id, isMedia ? { url: draft.trim(), caption: captionDraft } : isTable ? { cells: cells.map((cell) => [{ text: cell }]) } : { text: [{ text: draft }] }) } : current);
      setEditing(null);
      toast.success('Bloque guardado en Notion');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo editar el bloque'); }
    finally { setBusy(null); }
  }

  async function toggle(block: ContentBlock) {
    if (busy) return;
    setBusy(block.id);
    try {
      await mutate('PATCH', { blockId: block.id, checked: !block.checked });
      setData((current) => current ? { ...current, blocks: replaceBlock(current.blocks, block.id, { checked: !block.checked }) } : current);
    } catch { toast.error('No se pudo guardar la casilla'); }
    finally { setBusy(null); }
  }

  async function remove(block: ContentBlock) {
    if (!window.confirm('¿Eliminar este bloque de documentación? Podrás recuperarlo desde la papelera de Notion.')) return;
    if (busy) return;
    setBusy(block.id);
    try {
      await mutate('DELETE', { blockId: block.id });
      setData((current) => current ? { ...current, blocks: removeBlock(current.blocks, block.id) } : current);
      setEditing(null);
      toast.success('Bloque enviado a la papelera de Notion');
    } catch { toast.error('No se pudo eliminar el bloque'); }
    finally { setBusy(null); }
  }

  async function add() {
    if (!newText.trim() || busy) return;
    setBusy('new');
    try {
      const result = await mutate('POST', { type: newType, text: newText });
      if (!result.id) throw new Error('El nuevo bloque no tiene identificador');
      const block: ContentBlock = { id: result.id, type: newType, text: [{ text: newText.trim() }], checked: false, children: [] };
      setData((current) => current ? { ...current, blocks: [...current.blocks, block] } : current);
      setNewText(''); setCreating(false);
      toast.success('Bloque añadido a Notion');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo añadir el bloque'); }
    finally { setBusy(null); }
  }

  function renderBlocks(blocks: ContentBlock[], nested = false) {
    return <div className={`page-blocks ${nested ? 'project-doc-nested' : ''}`}>{blocks.filter((block) => nested || block.type !== 'to_do').map((block) => {
      const text = <RichText text={block.text} />;
      const url = safeContentUrl(block.url);
      const canEdit = textTypes.has(block.type) || mediaTypes.has(block.type) || block.type === 'table_row';
      const isEditing = editing === block.id;
      const children = block.children.length ? renderBlocks(block.children, true) : null;
      let content;
      switch (block.type) {
        case 'heading_1': content = <h2>{text}</h2>; break;
        case 'heading_2': content = <h3>{text}</h3>; break;
        case 'heading_3': content = <h4>{text}</h4>; break;
        case 'bulleted_list_item': content = <ul><li>{text}</li></ul>; break;
        case 'numbered_list_item': content = <ol><li>{text}</li></ol>; break;
        case 'quote': case 'callout': content = <blockquote>{text}</blockquote>; break;
        case 'code': content = <pre><code>{text}</code></pre>; break;
        case 'toggle': content = <details open><summary>{text}</summary>{children}</details>; break;
        case 'to_do': content = <label className={`content-check ${block.checked ? 'is-checked' : ''}`}><input type="checkbox" checked={Boolean(block.checked)} disabled={Boolean(busy)} onChange={() => toggle(block)} /><span>{text}</span></label>; break;
        case 'image': content = url ? <figure><img src={url} alt={block.caption || 'Imagen del proyecto'} /><figcaption>{block.caption}</figcaption></figure> : null; break;
        case 'video': content = url ? <video controls src={url} /> : null; break;
        case 'audio': content = url ? <audio controls src={url} /> : null; break;
        case 'pdf': case 'file': case 'bookmark': case 'embed': case 'link_preview': content = url ? <a className="content-attachment" href={url} target="_blank" rel="noreferrer">{block.caption || 'Abrir referencia'}</a> : null; break;
        case 'divider': content = <hr />; break;
        case 'table_row': content = <div className="content-table-row">{block.cells?.map((cell, i) => <div key={i}><RichText text={cell} /></div>)}</div>; break;
        case 'column_list': case 'column': case 'synced_block': case 'table': content = children; break;
        default: content = <p>{text}</p>; break;
      }
      return <div className={`page-block block-${block.type} project-doc-block`} key={block.id}>
        <div className="project-doc-block-content">{content}{block.type !== 'toggle' && children}</div>
        <div className="project-doc-block-actions">
          {canEdit && <button type="button" title="Editar bloque" aria-label="Editar bloque" onClick={() => { setEditing(block.id); setDraft(mediaTypes.has(block.type) ? block.url || '' : block.type === 'table_row' ? block.cells?.map((cell) => cell.map((part) => part.text).join('')).join('\t') || '' : block.text.map((item) => item.text).join('')); setCaptionDraft(block.caption || ''); }}><Pencil size={14} /></button>}
          {(canEdit || block.type === 'divider') && <button type="button" title="Quitar bloque" aria-label="Quitar bloque" disabled={Boolean(busy)} onClick={() => remove(block)}><Trash2 size={14} /></button>}
        </div>
        {isEditing && <div className="project-doc-editor">
          {block.type === 'table_row' ? <div className="project-doc-table-cells">{draft.split('\t').map((cell, index, values) => <input key={index} aria-label={`Columna ${index + 1}`} value={cell} onChange={(event) => setDraft(values.map((value, position) => position === index ? event.target.value.replaceAll('\t', ' ') : value).join('\t'))} />)}</div>
            : <textarea rows={Math.max(2, Math.min(9, Math.ceil(draft.length / 85)))} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Contenido del bloque" />}
          {mediaTypes.has(block.type) && <input className="project-doc-caption-input" placeholder="Descripción o pie del recurso" aria-label="Pie del recurso" value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} />}
          <div><button disabled={Boolean(busy)} onClick={() => save(block)}><Save size={14} /> Guardar</button><button onClick={() => setEditing(null)}><X size={14} /> Cancelar</button></div>
          {mediaTypes.has(block.type) && <small>Puedes sustituir el recurso por una URL pública. Para subir un archivo local, ábrelo en Notion.</small>}
          {block.type === 'table_row' && <small>Puedes editar cada celda de la fila; se mantiene su número de columnas.</small>}
          {block.text.some((part) => part.bold || part.italic || part.href) && !mediaTypes.has(block.type) && <small>Al editar este bloque, el formato enriquecido se convertirá a texto normal.</small>}
        </div>}
      </div>;
    })}</div>;
  }

  return <section className="project-documentation">
    <div className="project-documentation-head">
      <div><span>ESPACIO EDITABLE</span><h2>Documentación</h2><p>Briefing, notas, decisiones y referencias. Todo guardado en Notion.</p></div>
      <a href={pageUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir en Notion</a>
    </div>
    {loadingError ? <div role="alert">No se ha podido cargar la documentación. <button onClick={() => setReload((value) => value + 1)}>Reintentar</button></div>
      : !data ? <p className="project-widget-empty">Cargando documentación…</p>
        : <div className="project-documentation-body">{data.blocks.length ? renderBlocks(data.blocks) : <p className="project-widget-empty">Sin documentación todavía. Empieza con una nota.</p>}</div>}
    <footer className="project-doc-add">
      {creating ? <div className="project-doc-add-form"><select aria-label="Tipo de bloque" value={newType} onChange={(event) => setNewType(event.target.value)}>{newTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><textarea autoFocus placeholder="Escribe aquí…" value={newText} onChange={(event) => setNewText(event.target.value)} /><div><button disabled={!newText.trim() || Boolean(busy)} onClick={add}><Check size={14} /> Añadir bloque</button><button onClick={() => setCreating(false)}><X size={14} /> Cancelar</button></div></div>
        : <button type="button" onClick={() => setCreating(true)}><Plus size={15} /> Añadir bloque de contenido</button>}
    </footer>
  </section>;
}
