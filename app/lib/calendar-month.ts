const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const monthCodes = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
] as const;

// Keep the original calendar's month indices (August 2026 = 0) so
// historical events and selections retain their position.
export function calendarMonthIndex(year: number, monthIndex: number) {
  return (year - 2026) * 12 + monthIndex - 7;
}

export function calendarMonthInfo(index: number) {
  const firstDay = new Date(Date.UTC(2026, 7 + index, 1));
  const year = firstDay.getUTCFullYear();
  const monthIndex = firstDay.getUTCMonth();

  return {
    name: monthNames[monthIndex],
    short: monthCodes[monthIndex],
    year,
    monthIndex,
    monthNumber: monthIndex + 1,
    days: new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
    offset: (firstDay.getUTCDay() + 6) % 7, // Monday first
  };
}

export function calendarIndexFromShortMonth(code: string, year = 2026) {
  const monthIndex = monthCodes.indexOf(code.toUpperCase() as (typeof monthCodes)[number]);
  return monthIndex < 0 ? null : calendarMonthIndex(year, monthIndex);
}

export function calendarDateKey(index: number, day: number) {
  const month = calendarMonthInfo(index);
  if (!Number.isInteger(day) || day < 1 || day > month.days) {
    throw new RangeError("Day is outside the selected month");
  }
  return `${month.year}-${String(month.monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
