export type ContentText = { text: string; href?: string | null; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean };
export type ContentBlock = { id: string; type: string; text: ContentText[]; checked?: boolean; url?: string; caption?: string; cells?: ContentText[][]; children: ContentBlock[] };
type RequestContent = (path: string) => Promise<any>;

export async function loadPageBlocks(id: string, request: RequestContent): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  let cursor: string | null = null;
  do {
    const page = await request(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`);
    for (const raw of page.results || []) {
      const data = raw[raw.type] || {};
      const sourceId = raw.type === 'synced_block' ? data.synced_from?.block_id || raw.id : raw.id;
      blocks.push({
        id: raw.id, type: raw.type,
        text: (data.rich_text || (data.title ? [{ plain_text: data.title }] : data.expression ? [{ plain_text: data.expression }] : [])).map((part: any) => ({ text: part.plain_text || part.text?.content || part.equation?.expression || '', href: part.href || part.text?.link?.url, bold: part.annotations?.bold, italic: part.annotations?.italic, code: part.annotations?.code, strike: part.annotations?.strikethrough })),
        cells: data.cells?.map((cell: any[]) => cell.map((part: any) => ({ text: part.plain_text || part.text?.content || '' }))),
        checked: data.checked,
        url: data.file?.url || data.external?.url || data.url,
        caption: (data.caption || []).map((part: any) => part.plain_text || part.text?.content || '').join('') || data.title || data.language,
        children: raw.has_children || (raw.type === 'synced_block' && data.synced_from) ? await loadPageBlocks(sourceId, request) : [],
      });
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return blocks;
}

export function safeContentUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (/(^|\.)notion\.(so|com|site)$/i.test(url.hostname)) return undefined;
    return url.href;
  } catch { return undefined; }
}
