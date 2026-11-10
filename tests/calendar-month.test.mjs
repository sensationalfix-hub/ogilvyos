import assert from "node:assert/strict";
import test from "node:test";

import { calendarDateKey, calendarIndexFromShortMonth, calendarMonthIndex, calendarMonthInfo } from "../app/lib/calendar-month.ts";

test("calendar moves freely past October 2026 and across years", () => {
  const october = calendarMonthIndex(2026, 9);
  assert.equal(october, 2);
  assert.deepEqual(calendarMonthInfo(october), {
    name: "Octubre", short: "OCT", year: 2026,
    monthIndex: 9, monthNumber: 10, days: 31, offset: 3,
  });

  assert.deepEqual(calendarMonthInfo(october + 1), {
    name: "Noviembre", short: "NOV", year: 2026,
    monthIndex: 10, monthNumber: 11, days: 30, offset: 6,
  });

  assert.equal(calendarMonthInfo(calendarMonthIndex(2027, 0)).name, "Enero");
  assert.equal(calendarMonthInfo(calendarMonthIndex(2028, 1)).days, 29);
  assert.equal(calendarMonthInfo(calendarMonthIndex(2026, 6)).name, "Julio");
  assert.equal(calendarDateKey(october + 1, 10), "2026-11-10");
  assert.equal(calendarDateKey(calendarMonthIndex(2027, 0), 2), "2027-01-02");
  assert.throws(() => calendarDateKey(october + 1, 31), RangeError);
});

test("date indexes and legacy abbreviated dates agree", () => {
  assert.equal(calendarIndexFromShortMonth("NOV"), calendarMonthIndex(2026, 10));
  assert.equal(calendarIndexFromShortMonth("ene", 2027), calendarMonthIndex(2027, 0));
  assert.equal(calendarIndexFromShortMonth("invalid"), null);

  for (const [year, month] of [[2024, 0], [2026, 7], [2026, 11], [2027, 0], [2035, 9]]) {
    const details = calendarMonthInfo(calendarMonthIndex(year, month));
    assert.equal(details.year, year);
    assert.equal(details.monthIndex, month);
    assert.equal(details.offset >= 0 && details.offset <= 6, true);
  }
});
