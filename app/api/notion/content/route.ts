import { NextResponse } from 'next/server';
import { requestCanWrite, requestIdentity } from '@/app/lib/workos-auth';
import { DATA_SOURCES, notionRequest } from '@/app/lib/notion-live';
import { loadPageBlocks } from '@/app/lib/page-content';

const validId = (id: string) => /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const compact = (id: string) => id.replaceAll('-', '');
const editableTextTypes = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout', 'toggle', 'code']);
const editableMediaTypes = new Set(['image', 'video', 'audio', 'pdf', 'file', 'bookmark', 'embed']);
function richText(value: string) {
  // Notion limits each rich-text fragment to 2,000 characters.
  return (value.match(/[\s\S]{1,1900}/g) || []).map((part) => ({ type: 'text', text: { content: part } }));
}
async function pageBlock(pageId: string, blockId: string) {
  await taskOrProject(pageId);
  const block = await notionRequest(`/blocks/${blockId}`);
  let ancestor = block;
  while (ancestor.parent?.type === 'block_id') ancestor = await notionRequest(`/blocks/${ancestor.parent.block_id}`);
  if (compact(ancestor.parent?.page_id || '') !== compact(pageId)) throw new Error('BLOCK_OUTSIDE_PAGE');
  return block;
}
async function taskOrProject(id: string) {
  const page = await notionRequest(`/pages/${id}`);
  const source = page.parent?.data_source_id;
  if (![DATA_SOURCES.tasks, DATA_SOURCES.projects].some((value) => source && compact(value) === compact(source))) throw new Error('PAGE_NOT_ALLOWED');
  return page;
}
function propertyValue(property: any): string {
  const value = property[property.type];
  if (property.type === 'title' || property.type === 'rich_text') return (value || []).map((part: any) => part.plain_text || part.text?.content || '').join('');
  if (property.type === 'select' || property.type === 'status') return value?.name || '';
  if (property.type === 'multi_select' || property.type === 'people') return (value || []).map((item: any) => item.name || '').join(', ');
  if (property.type === 'date') return value ? [value.start, value.end].filter(Boolean).join(' → ') : '';
  if (property.type === 'checkbox') return value ? 'Sí' : 'No';
  if (property.type === 'files') return (value || []).map((item: any) => item.name).join(', ');
  if (property.type === 'relation') return `${(value || []).length} vinculados`;
  if (property.type === 'formula' || property.type === 'rollup') return value?.type ? propertyValue(value) : '';
  return value == null ? '' : typeof value === 'object' ? '' : String(value);
}
export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!validId(id)) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  try {
    const page = await taskOrProject(id);
    const blocks = await loadPageBlocks(id, notionRequest);
    const properties = Object.entries(page.properties || {}).map(([name, property]) => ({
          name,
          value: propertyValue(property) || 'Sin completar',
          files: (property as any).type === 'files'
            ? (property as any).files.map((file: any) => ({ name: file.name, url: file.file?.url || file.external?.url }))
            : undefined,
        }));
    return NextResponse.json({ blocks, properties, createdAt: page.created_time, updatedAt: page.last_edited_time });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Content unavailable' }, { status: 502 });
  }
}
export async function PATCH(request: Request) {
  if (!await requestCanWrite(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { pageId, blockId, checked, text, url, caption, cells } = await request.json();
    if (!validId(pageId || '') || !validId(blockId || '')) return NextResponse.json({ error: 'Invalid block' }, { status: 400 });
    const block = await pageBlock(pageId, blockId);
    const update: Record<string, unknown> = {};
    if (typeof checked === 'boolean') {
      if (block.type !== 'to_do') return NextResponse.json({ error: 'Not a checklist item' }, { status: 400 });
      update.to_do = { checked };
    }
    if (typeof text === 'string') {
      if (!editableTextTypes.has(block.type) || text.length > 12000) return NextResponse.json({ error: 'Invalid text block' }, { status: 400 });
      update[block.type] = { ...(update[block.type] as object || {}), rich_text: richText(text) };
    }
    if (typeof url === 'string') {
      if (!editableMediaTypes.has(block.type) || url.length > 2000) return NextResponse.json({ error: 'Invalid media block' }, { status: 400 });
      try { const target = new URL(url); if (!['https:', 'http:'].includes(target.protocol)) throw new Error(); } catch { return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 }); }
      update[block.type] = { external: { url } };
    }
    if (typeof caption === 'string') {
      if (!editableMediaTypes.has(block.type) || caption.length > 12000) return NextResponse.json({ error: 'Invalid caption' }, { status: 400 });
      update[block.type] = { ...(update[block.type] as object || {}), caption: richText(caption) };
    }
    if (Array.isArray(cells)) {
      if (block.type !== 'table_row' || !Array.isArray(block.table_row?.cells) || cells.length !== block.table_row.cells.length || cells.some((value) => typeof value !== 'string' || value.length > 12000)) return NextResponse.json({ error: 'Invalid table cells' }, { status: 400 });
      update.table_row = { cells: cells.map(richText) };
    }
    if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    await notionRequest(`/blocks/${blockId}`, { method: 'PATCH', body: JSON.stringify(update) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save checklist' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!await requestCanWrite(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { pageId, type, text } = await request.json();
    if (!validId(pageId || '') || !editableTextTypes.has(type) || typeof text !== 'string' || !text.trim() || text.length > 12000) return NextResponse.json({ error: 'Invalid new block' }, { status: 400 });
    await taskOrProject(pageId);
    const block = { object: 'block', type, [type]: { rich_text: richText(text.trim()), ...(type === 'to_do' ? { checked: false } : {}) } };
    const result = await notionRequest(`/blocks/${pageId}/children`, { method: 'PATCH', body: JSON.stringify({ children: [block] }) });
    return NextResponse.json({ ok: true, id: result?.results?.[0]?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create block' }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  if (!await requestCanWrite(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { pageId, blockId } = await request.json();
    if (!validId(pageId || '') || !validId(blockId || '')) return NextResponse.json({ error: 'Invalid block' }, { status: 400 });
    const block = await pageBlock(pageId, blockId);
    if (![...editableTextTypes, ...editableMediaTypes, 'table_row', 'divider'].includes(block.type)) return NextResponse.json({ error: 'This block must be managed in Notion' }, { status: 400 });
    // Notion archives blocks, which remain recoverable in its trash.
    await notionRequest(`/blocks/${blockId}`, { method: 'DELETE' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not remove block' }, { status: 502 });
  }
}
