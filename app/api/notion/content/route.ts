import { NextResponse } from 'next/server';
import { requestIsAuthorized } from '@/app/lib/workos-auth';
import { DATA_SOURCES, notionRequest } from '@/app/lib/notion-live';
import { loadPageBlocks } from '@/app/lib/page-content';

const validId = (id: string) => /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const compact = (id: string) => id.replaceAll('-', '');
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
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!validId(id)) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  try {
    const page = await taskOrProject(id);
    const blocks = await loadPageBlocks(id, notionRequest);
    const properties = Object.entries(page.properties || {}).map(([name, property]) => ({ name, value: propertyValue(property) || 'Sin completar', files: (property as any).type === 'files' ? (property as any).files.map((file: any) => ({ name: file.name, url: file.file?.url || file.external?.url })) : undefined }));
    return NextResponse.json({ blocks, properties, createdAt: page.created_time, updatedAt: page.last_edited_time });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Content unavailable' }, { status: 502 });
  }
}
export async function PATCH(request: Request) {
  if (!await requestIsAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { pageId, blockId, checked } = await request.json();
    if (!validId(pageId || '') || !validId(blockId || '') || typeof checked !== 'boolean') return NextResponse.json({ error: 'Invalid checklist update' }, { status: 400 });
    await taskOrProject(pageId);
    const block = await notionRequest(`/blocks/${blockId}`);
    if (block.type !== 'to_do') return NextResponse.json({ error: 'Not a checklist item' }, { status: 400 });
    let ancestor = block;
    while (ancestor.parent?.type === 'block_id') ancestor = await notionRequest(`/blocks/${ancestor.parent.block_id}`);
    if (compact(ancestor.parent?.page_id || '') !== compact(pageId)) return NextResponse.json({ error: 'Checklist is outside this page' }, { status: 403 });
    await notionRequest(`/blocks/${blockId}`, { method: 'PATCH', body: JSON.stringify({ to_do: { checked } }) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save checklist' }, { status: 502 });
  }
}
