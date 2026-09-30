'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { safeContentUrl, type ContentBlock, type ContentText } from '@/app/lib/page-content';

type PageData = { blocks: ContentBlock[]; properties: { name: string; value: string; files?: { name: string; url: string }[] }[]; updatedAt: string };
function RichText({ text }: { text: ContentText[] }) {
  return <>{text.map((part, index) => {
    const href = safeContentUrl(part.href);
    const content = <span style={{ fontWeight: part.bold ? 700 : undefined, fontStyle: part.italic ? 'italic' : undefined, textDecoration: part.strike ? 'line-through' : undefined }}>{part.code ? <code>{part.text}</code> : part.text}</span>;
    return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{content}</a> : <span key={index}>{content}</span>;
  })}</>;
}
function Blocks({ blocks, pending, toggle }: { blocks: ContentBlock[]; pending: Set<string>; toggle: (id: string, checked: boolean) => void }) {
  return <div className="page-blocks">{blocks.map((block) => {
    const text = <RichText text={block.text} />;
    const children = block.children.length ? <Blocks blocks={block.children} pending={pending} toggle={toggle} /> : null;
    const url = safeContentUrl(block.url);
    let content;
    switch (block.type) {
      case 'to_do': content = <><label className={`content-check ${block.checked ? 'is-checked' : ''}`}><Checkbox checked={Boolean(block.checked)} disabled={pending.has(block.id)} onCheckedChange={(checked) => toggle(block.id, checked === true)} aria-label={block.text.map((part) => part.text).join('') || 'Marcar pendiente'} /><span>{text}</span></label>{children}</>; break;
      case 'heading_1': content = <><h2>{text}</h2>{children}</>; break;
      case 'heading_2': content = <><h3>{text}</h3>{children}</>; break;
      case 'heading_3': content = <><h4>{text}</h4>{children}</>; break;
      case 'toggle': content = <details open><summary>{text}</summary>{children}</details>; break;
      case 'bulleted_list_item': content = <><ul><li>{text}{children}</li></ul></>; break;
      case 'numbered_list_item': content = <><ol><li>{text}{children}</li></ol></>; break;
      case 'quote': case 'callout': content = <blockquote>{text}{children}</blockquote>; break;
      case 'code': content = <><pre><code>{text}</code></pre>{children}</>; break;
      case 'divider': content = <hr />; break;
      case 'image': content = url ? <figure><img src={url} alt={block.caption || ''} /><figcaption>{block.caption}</figcaption></figure> : null; break;
      case 'video': content = url ? <video controls src={url} /> : null; break;
      case 'audio': content = url ? <audio controls src={url} /> : null; break;
      case 'file': case 'pdf': case 'bookmark': case 'embed': case 'link_preview': content = url ? <a className="content-attachment" href={url} target="_blank" rel="noreferrer">{block.caption || (block.type === 'pdf' ? 'Ver documento PDF' : 'Abrir archivo o referencia')}</a> : null; break;
      case 'table_row': content = <div className="content-table-row">{block.cells?.map((cell, index) => <div key={index}><RichText text={cell} /></div>)}</div>; break;
      case 'column_list': case 'column': case 'synced_block': case 'table': content = children; break;
      default: content = <>{block.text.length > 0 && <p>{text}</p>}{children}{!block.text.length && !children && <small className="content-unsupported">Contenido de tipo {block.type}</small>}</>;
    }
    return <div className={`page-block block-${block.type}`} key={block.id}>{content}</div>;
  })}</div>;
}
function countChecks(blocks: ContentBlock[]): { total: number; done: number } {
  return blocks.reduce((sum, block) => { const nested = countChecks(block.children); return { total: sum.total + nested.total + (block.type === 'to_do' ? 1 : 0), done: sum.done + nested.done + (block.type === 'to_do' && block.checked ? 1 : 0) }; }, { total: 0, done: 0 });
}
function updateCheck(blocks: ContentBlock[], id: string, checked: boolean): ContentBlock[] {
  return blocks.map((block) => ({ ...block, checked: block.id === id ? checked : block.checked, children: updateCheck(block.children, id, checked) }));
}
export function PageContent({ pageId }: { pageId: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<Set<string>>(new Set());
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    fetch(`/api/notion/content?id=${encodeURIComponent(pageId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(setData).catch((err) => { if (err.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [pageId, reload]);
  async function toggle(id: string, checked: boolean) {
    if (pending.has(id)) return;
    setPending((items) => new Set(items).add(id));
    try {
      const response = await fetch('/api/notion/content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, blockId: id, checked }) });
      if (!response.ok) throw new Error('Save failed');
      setData((current) => current ? { ...current, blocks: updateCheck(current.blocks, id, checked) } : current);
    } catch { toast.error('No se pudo guardar la casilla. Inténtalo de nuevo.'); }
    finally { setPending((items) => { const next = new Set(items); next.delete(id); return next; }); }
  }
  const checks = data ? countChecks(data.blocks) : null;
  return <section className="task-page-content" aria-label="Contenido de la página">
    <header><h2>Contenido y checklist</h2>{checks && checks.total > 0 && <span>{checks.done} de {checks.total} completados</span>}</header>
    {error ? <div role="alert"><p>No se ha podido cargar el contenido de esta página.</p><Button variant="outline" onClick={() => setReload((value) => value + 1)}>Reintentar</Button></div> : !data ? <p role="status">Cargando contenido…</p> : <>
      {data.blocks.length ? <Blocks blocks={data.blocks} pending={pending} toggle={toggle} /> : <p className="content-empty">Esta página no tiene contenido ni checklist.</p>}
      <details className="content-properties"><summary>Todas las propiedades</summary><dl>{data.properties.map((property) => <div key={property.name}><dt>{property.name}</dt><dd>{property.value}{property.files?.map((file, index) => { const url = safeContentUrl(file.url); return url ? <a key={index} href={url} target="_blank" rel="noreferrer">{file.name}</a> : null; })}</dd></div>)}</dl><p>Última actualización: {new Date(data.updatedAt).toLocaleString('es-ES')}</p></details>
    </>}
  </section>;
}
