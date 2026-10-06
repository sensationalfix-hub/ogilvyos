import test from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../app/lib/timesheet.ts');
const project = (account, status = 'Ideas', name = account) => ({ id: name, name, account, status });
const task = (account, extra = {}) => ({ id: account, name: 'Guion', account, project: account, status: 'En progreso', ...extra });
const input = (extra = {}) => ({ weekStart: '2026-10-05', personName: 'Jorge', projects: [project('ONCE'), project('Iberdrola')], tasks: [], holidays: [], ...extra });

test('each working day closes at eight hours with two office hours and half-hour account values', async () => {
  const { buildTimesheet } = await load();
  const days = buildTimesheet(input());
  assert.equal(days.length, 5);
  for (const day of days) {
    assert.equal(day.office, 2);
    assert.equal(Object.values(day.hours).reduce((a, b) => a + b, 0), 6);
    assert.ok(Object.values(day.hours).every(h => Number.isInteger(h * 2)));
  }
  assert.deepEqual(days[0].hours, { ONCE: 3, Iberdrola: 3 });
});

test('a current task attracts more dedication than a project without tasks', async () => {
  const { buildTimesheet } = await load();
  const [day] = buildTimesheet(input({ tasks: [task('ONCE')] }));
  assert.ok(day.hours.ONCE > day.hours.Iberdrola);
});

test('scheduled tasks attract weight on their day and tasks outside the week do not', async () => {
  const { buildTimesheet } = await load();
  const days = buildTimesheet(input({ tasks: [task('ONCE', { dateStart: '2026-10-06T09:00:00+02:00', dateEnd: '2026-10-06T13:00:00+02:00' }), task('Iberdrola', { id: 'old', dateStart: '2026-09-01' })] }));
  assert.deepEqual(days[0].hours, { ONCE: 3, Iberdrola: 3 });
  assert.ok(days[1].hours.ONCE > days[1].hours.Iberdrola);
});

test('closed and standby projects and inactive tasks do not receive account hours', async () => {
  const { buildTimesheet } = await load();
  const [day] = buildTimesheet(input({ projects: [project('ONCE'), project('Closed', 'Terminado'), project('Idle', 'Stand by')], tasks: [task('Closed', { status: 'Cancelado' }), task('Idle', { status: 'Pausa' }), task('Backlog', { workosLane: 'Backlog' })] }));
  assert.deepEqual(day.hours, { ONCE: 6 });
});

test('a dated completed task is evidence and an undated completed task is not', async () => {
  const { buildTimesheet } = await load();
  const [day] = buildTimesheet(input({ projects: [], tasks: [task('ONCE', { status: 'Terminado', dateStart: '2026-10-05' }), task('Old', { status: 'Terminado' })] }));
  assert.deepEqual(day.hours, { ONCE: 6 });
});

test('an unassigned task uses its project account without inventing a new account', async () => {
  const { buildTimesheet } = await load();
  const [day] = buildTimesheet(input({ tasks: [task('Sin cuenta', { project: 'ONCE' })] }));
  assert.ok(day.hours.ONCE > day.hours.Iberdrola);
  assert.equal(day.hours['Sin cuenta'], undefined);
});

test('public holidays and personal leave have zero hours; other people leave does not', async () => {
  const { buildTimesheet } = await load();
  const days = buildTimesheet(input({ holidays: [
    { name: 'Fiesta', segment: 'Festivo', start: '2026-10-05', end: '2026-10-05', type: 'Festivo' },
    { name: 'Jorge Calvo', segment: 'Persona', start: '2026-10-06', end: '2026-10-06', type: 'Libres' },
    { name: 'Iñaki', segment: 'Persona', start: '2026-10-07', end: '2026-10-07', type: 'Libres' },
  ] }));
  assert.equal(days[0].office, 0);
  assert.deepEqual(days[0].hours, {});
  assert.equal(days[1].office, 0);
  assert.equal(days[2].office, 2);
});

test('no eligible accounts keeps six hours explicitly pending rather than increasing office', async () => {
  const { buildTimesheet, PENDING_ACCOUNT } = await load();
  const [day] = buildTimesheet(input({ projects: [], tasks: [] }));
  assert.equal(day.office, 2);
  assert.equal(day.hours[PENDING_ACCOUNT], 6);
  assert.equal(day.needsReview, true);
});

test('editing a cell compensates the other accounts and still closes at six account hours', async () => {
  const { rebalanceDay } = await load();
  assert.deepEqual(rebalanceDay({ ONCE: 3, Iberdrola: 2, Leroy: 1 }, 'ONCE', 4), { ONCE: 4, Iberdrola: 1.5, Leroy: 0.5 });
  assert.deepEqual(rebalanceDay({ ONCE: 6 }, 'ONCE', 2), { ONCE: 6 });
  assert.deepEqual(rebalanceDay({ ONCE: 6, Iberdrola: 0 }, 'ONCE', 4), { ONCE: 4, Iberdrola: 2 });
});

test('corrupt saved drafts are rejected and valid adjusted days remain intact', async () => {
  const { restoreDay } = await load();
  assert.equal(restoreDay({ hours: { ONCE: 7 }, off: false }), null);
  assert.equal(restoreDay({ hours: { ONCE: -1, Iberdrola: 7 } }), null);
  assert.equal(restoreDay({ hours: { ONCE: 5.25, Iberdrola: 0.75 } }), null);
  assert.deepEqual(restoreDay({ hours: { ONCE: 4, Iberdrola: 2 }, off: false }), { hours: { ONCE: 4, Iberdrola: 2 }, off: false });
  assert.deepEqual(restoreDay({ off: true, hours: {} }), { off: true, hours: {} });
});

test('timestamps near midnight use Madrid dates instead of UTC dates', async () => {
  const { buildTimesheet } = await load();
  const days = buildTimesheet(input({ tasks: [task('ONCE', { dateStart: '2026-10-05T22:30:00Z', dateEnd: '2026-10-05T23:30:00Z' })] }));
  assert.deepEqual(days[0].hours, { ONCE: 3, Iberdrola: 3 });
  assert.ok(days[1].hours.ONCE > days[1].hours.Iberdrola);
});

test('a task linked to a standby project cannot reintroduce its account', async () => {
  const { buildTimesheet } = await load();
  const [day] = buildTimesheet(input({ projects: [project('ONCE'), project('Idle', 'Standby')], tasks: [task('Idle')] }));
  assert.deepEqual(day.hours, { ONCE: 6 });
});

test('toggling a working day off and on preserves its manual allocation', async () => {
  const { toggleWorkingDay, restoreDay } = await load();
  const current = { hours: { ONCE: 4, Iberdrola: 2 }, off: false };
  const off = toggleWorkingDay(current, { ONCE: 3, Iberdrola: 3 });
  assert.equal(off.off, true);
  assert.deepEqual(off.hours, {});
  const restored = restoreDay(JSON.parse(JSON.stringify(off)));
  assert.deepEqual(toggleWorkingDay(restored, { ONCE: 3, Iberdrola: 3 }), current);
});
