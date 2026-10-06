import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey } from '../app/lib/local-date.ts';

process.env.TZ = 'Europe/Madrid';

test('weekly column keys match calendar dates in Madrid, including DST boundaries', () => {
  for (const day of ['2026-10-08', '2026-01-01', '2026-03-29', '2026-10-25']) {
    assert.equal(localDateKey(new Date(day + 'T00:00:00')), day);
  }
});

test('Thursday 8 column matches a timed task on Thursday 8', () => {
  const thursday = new Date(2026, 9, 8);
  const task = '2026-10-08T11:00:00+02:00';
  assert.equal(localDateKey(thursday), task.slice(0, 10));
  assert.notEqual(localDateKey(thursday), '2026-10-07');
});
