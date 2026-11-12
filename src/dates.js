'use strict';

/**
 * Small date helpers. CalCLI stores event times as naive local times
 * ("YYYY-MM-DD HH:MM") — no timezone database, no surprises for a
 * single-user CLI. All functions here work in local time.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (also accepts a "T" separator). */
function parseDateTime(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== 'string') throw new Error(`invalid date/time: ${value}`);
  const text = value.trim();
  let m = DATETIME_RE.exec(text);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]
      || d.getHours() !== +m[4] || d.getMinutes() !== +m[5]) {
      throw new Error(`invalid date/time: ${value}`);
    }
    return d;
  }
  m = DATE_RE.exec(text);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) {
      throw new Error(`invalid date/time: ${value}`);
    }
    return d;
  }
  throw new Error(`invalid date/time: ${value} (expected YYYY-MM-DD or YYYY-MM-DD HH:MM)`);
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(d) {
  return `${formatDate(d)} ${formatTime(d)}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d, n) {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

function addWeeks(d, n) {
  return addDays(d, n * 7);
}

/** Add months, clamping to the last day of the target month (Jan 31 -> Feb 28). */
function addMonths(d, n) {
  const targetMonth = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return new Date(year, month, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayName(d) {
  return WEEKDAY_NAMES[d.getDay()];
}

module.exports = {
  parseDateTime,
  formatDate,
  formatTime,
  formatDateTime,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  addMonths,
  minutesBetween,
  weekdayName,
  WEEKDAY_NAMES,
};
