import test from 'node:test';
import assert from 'node:assert/strict';

test('loads paginated content and nested checklist items without losing their checked state', async () => {
  const { loadPageBlocks } = await import('../app/lib/page-content.ts');
  const calls = [];
  const request = async (path) => {
    calls.push(path);
    if (path.includes('/parent/')) return { results: [{ id: 'nested', type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: 'Guion' }] } }], has_more: false };
    if (path.includes('start_cursor=')) return { results: [{ id: 'last', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Arte' }] } }], has_more: false };
    return { results: [{ id: 'parent', type: 'toggle', has_children: true, toggle: { rich_text: [{ plain_text: 'Entregables' }] } }], has_more: true, next_cursor: 'next page' };
  };
  const blocks = await loadPageBlocks('page', request);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].children[0].checked, true);
  assert.equal(blocks[0].children[0].text[0].text, 'Guion');
  assert.equal(blocks[1].text[0].text, 'Arte');
  assert.ok(calls.some((path) => path.includes('start_cursor=next%20page')));
});

test('does not expose outgoing Notion or unsafe content links', async () => {
  const { safeContentUrl } = await import('../app/lib/page-content.ts');
  assert.equal(safeContentUrl('https://app.notion.com/p/example'), undefined);
  assert.equal(safeContentUrl('https://www.notion.so/example'), undefined);
  assert.equal(safeContentUrl('javascript:alert(1)'), undefined);
  assert.equal(safeContentUrl('https://example.com/file.pdf'), 'https://example.com/file.pdf');
});
