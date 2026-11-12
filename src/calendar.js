'use strict';

/**
 * Agenda and month views — pure rendering over expanded occurrences.
 */

const { formatDate, formatTime, weekdayName, startOfDay, endOfDay, addDays } = require('./dates');
const { expandAll } = require('./recurrence');

/** Group occurrences by calendar day: [{ date: "YYYY-MM-DD", weekday, items }]. */
function agenda(events, from, to) {
  const occ = expandAll(events, from, to);
  const byDay = new Map();
  for (const o of occ) {
    const key = formatDate(o.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(o);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, items]) => ({
      date,
      weekday: weekdayName(new Date(`${date}T00:00:00`)),
      items,
    }));
}

function formatAgendaDay(day) {
  const lines = [`${day.date} ${day.weekday}`];
  for (const o of day.items) {
    const loc = o.location ? ` @ ${o.location}` : '';
    const recur = o.recurring ? ' ↻' : '';
    lines.push(`  ${formatTime(o.start)} – ${formatTime(o.end)}  ${o.title}${loc}${recur}`);
  }
  return lines.join('\n');
}

/**
 * Text month grid. Days with events are marked with `*` and the count of
 * events is listed underneath the grid.
 *
 *   November 2026
 *   Su Mo Tu We Th Fr Sa
 *                    1  2  3
 *    4  5  6  7  8  9 10
 *   ...
 */
function monthGrid(year, month, events) {
  // month is 0-based (0 = January).
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = first.toLocaleString('en-US', { month: 'long' });

  const occ = expandAll(events, startOfDay(first), endOfDay(new Date(year, month, daysInMonth)));
  const counts = new Map();
  for (const o of occ) counts.set(o.start.getDate(), (counts.get(o.start.getDate()) || 0) + 1);

  const lines = [`${monthName} ${year}`, 'Su Mo Tu We Th Fr Sa'];
  let week = Array(first.getDay()).fill('  ');
  for (let day = 1; day <= daysInMonth; day++) {
    const mark = counts.has(day) ? '*' : ' ';
    week.push(`${String(day).padStart(2, ' ')}${mark}`);
    if (week.length === 7) {
      lines.push(week.join(' '));
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push('   ');
    lines.push(week.join(' '));
  }
  lines.push('');
  for (const [day, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`  ${monthName.slice(0, 3)} ${day}: ${count} event${count === 1 ? '' : 's'}`);
  }
  return lines.join('\n');
}

/** Case-insensitive search over title, location, notes and tags. */
function searchEvents(events, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return events.filter((e) => {
    const haystack = [e.title, e.location || '', e.notes || '', ...(e.tags || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

module.exports = { agenda, formatAgendaDay, monthGrid, searchEvents };
