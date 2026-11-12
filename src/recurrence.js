'use strict';

/**
 * Recurrence expansion.
 *
 * expand(event, from, to) returns every occurrence of `event` whose start
 * falls inside [from, to], as { eventId, title, start: Date, end: Date,
 * location, tags, occurrenceIndex }.
 *
 * Supported rules (validated by events.validateRecurrence):
 *   daily   — every `interval` days
 *   weekly  — every `interval` weeks, on `byDay` weekdays (defaults to the
 *             weekday of the first occurrence)
 *   monthly — every `interval` months, same day-of-month, clamped to the
 *             last day of short months (Jan 31 -> Feb 28)
 *   count   — stop after this many occurrences (including the first)
 *   until   — last occurrence date (inclusive)
 *
 * Expansion is always window-bounded and capped, so an open-ended series
 * can never run away.
 */

const { parseDateTime, formatDateTime, addDays, addWeeks, addMonths, startOfDay, endOfDay } = require('./dates');

const MAX_OCCURRENCES = 5000;

const WEEKDAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function parseWeekdays(value) {
  if (!value) return undefined;
  const days = String(value).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out = days.map((d) => {
    if (!(d in WEEKDAY_MAP)) throw new Error(`unknown weekday: ${d} (use Mon, Tue, ...)`);
    return WEEKDAY_MAP[d];
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Generate occurrence start dates in order, ignoring the window. */
function* occurrenceStarts(event) {
  const first = parseDateTime(event.start);
  const rule = event.recurrence;
  if (!rule) {
    yield first;
    return;
  }

  const until = rule.until ? endOfDay(parseDateTime(rule.until)) : null;
  let emitted = 0;
  const limit = rule.count || Infinity;

  function* take(date) {
    if (emitted >= limit) return false;
    if (until && date > until) return false;
    emitted++;
    yield date;
    return true;
  }

  if (rule.freq === 'daily') {
    let cur = first;
    while (emitted < limit && (!until || cur <= until)) {
      yield* take(cur);
      cur = addDays(cur, rule.interval);
    }
  } else if (rule.freq === 'weekly') {
    const days = rule.byDay && rule.byDay.length ? rule.byDay : [first.getDay()];
    // Anchor the week on the Sunday of the first occurrence's week.
    const weekAnchor = addDays(startOfDay(first), -first.getDay());
    let week = 0;
    while (emitted < limit) {
      let advanced = false;
      for (const wd of days) {
        const candidate = addDays(addWeeks(weekAnchor, week * rule.interval), wd);
        // Keep the time-of-day of the first occurrence.
        candidate.setHours(first.getHours(), first.getMinutes(), first.getSeconds(), first.getMilliseconds());
        if (candidate < first) continue;
        if (until && candidate > until) return;
        if (emitted >= limit) return;
        emitted++;
        yield candidate;
        advanced = true;
      }
      if (!advanced && week > 0 && until && addWeeks(weekAnchor, week * rule.interval) > until) return;
      week++;
      // Safety: an open-ended weekly rule with no window still terminates
      // via the caller's MAX_OCCURRENCES cap (applied in expand()).
      if (week > 100000) return;
    }
  } else if (rule.freq === 'monthly') {
    let cur = first;
    let step = 0;
    while (emitted < limit && (!until || cur <= until)) {
      yield* take(cur);
      step++;
      cur = addMonths(first, step * rule.interval);
      // Preserve the time-of-day (addMonths keeps it, but be explicit).
      cur.setHours(first.getHours(), first.getMinutes(), first.getSeconds(), first.getMilliseconds());
    }
  }
}

function expand(event, from, to) {
  const start = parseDateTime(event.start);
  const end = parseDateTime(event.end);
  const durationMs = end.getTime() - start.getTime();
  const fromDate = from instanceof Date ? from : parseDateTime(from);
  const toDate = to instanceof Date ? to : parseDateTime(to);

  const out = [];
  let index = 0;
  for (const occStart of occurrenceStarts(event)) {
    index++;
    if (out.length >= MAX_OCCURRENCES) break;
    if (occStart > toDate) break;
    if (occStart < fromDate) continue;
    out.push({
      eventId: event.id,
      title: event.title,
      start: occStart,
      end: new Date(occStart.getTime() + durationMs),
      location: event.location,
      tags: event.tags || [],
      occurrenceIndex: index,
      recurring: Boolean(event.recurrence),
    });
  }
  return out;
}

/** Expand every event in `events` over [from, to], sorted by start time. */
function expandAll(events, from, to) {
  const all = [];
  for (const event of events) all.push(...expand(event, from, to));
  all.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  return all;
}

module.exports = { expand, expandAll, parseWeekdays, MAX_OCCURRENCES };
