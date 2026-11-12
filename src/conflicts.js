'use strict';

/**
 * Conflict detection and free-slot search.
 *
 * All checks run on *expanded* occurrences, so a recurring event conflicts
 * with another recurring event even when their first instances are months
 * apart. The check window for a candidate defaults to one year from its
 * first start — long enough to catch realistic clashes, short enough to
 * stay fast.
 */

const { parseDateTime, formatDateTime, startOfDay, endOfDay, addDays } = require('./dates');
const { intervalsOverlap } = require('./events');
const { expand, expandAll } = require('./recurrence');

const CHECK_HORIZON_DAYS = 365;

/**
 * Find every occurrence of `candidate` that overlaps an occurrence of an
 * event in `existing` (excluding the candidate itself by id).
 * Returns [{ occurrence, conflictsWith: [occurrence, ...] }].
 */
function findConflicts(existing, candidate, options = {}) {
  const horizon = options.horizonDays || CHECK_HORIZON_DAYS;
  const firstStart = parseDateTime(candidate.start);
  const from = firstStart;
  const to = addDays(firstStart, horizon);

  const others = existing.filter((e) => e.id !== candidate.id);
  const otherOcc = expandAll(others, from, to);
  const candOcc = expand(candidate, from, to);

  const results = [];
  for (const occ of candOcc) {
    const clashes = otherOcc.filter((o) =>
      intervalsOverlap(occ.start, occ.end, o.start, o.end));
    if (clashes.length) results.push({ occurrence: occ, conflictsWith: clashes });
  }
  return results;
}

/**
 * Free time slots on a given day.
 * `events` — all stored events; `date` — "YYYY-MM-DD" or Date.
 * Options: dayStart/dayEnd ("HH:MM", defaults 08:00–20:00),
 * minMinutes (default 30). Returns [{ start: Date, end: Date, minutes }].
 */
function findFreeSlots(events, date, options = {}) {
  const day = date instanceof Date ? date : parseDateTime(date);
  const dayStart = options.dayStart || '08:00';
  const dayEnd = options.dayEnd || '20:00';
  const minMinutes = options.minMinutes || 30;

  const [sh, sm] = dayStart.split(':').map(Number);
  const [eh, em] = dayEnd.split(':').map(Number);
  const windowStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm);
  const windowEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em);
  if (windowEnd <= windowStart) throw new Error('dayEnd must be after dayStart');

  const busy = expandAll(events, startOfDay(day), endOfDay(day))
    .map((o) => ({ start: o.start < windowStart ? windowStart : o.start, end: o.end > windowEnd ? windowEnd : o.end }))
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping/adjacent busy blocks.
  const merged = [];
  for (const block of busy) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      if (block.end > last.end) last.end = block.end;
    } else {
      merged.push({ ...block });
    }
  }

  const slots = [];
  let cursor = windowStart;
  for (const block of merged) {
    if (block.start > cursor) {
      slots.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) cursor = block.end;
  }
  if (cursor < windowEnd) slots.push({ start: cursor, end: windowEnd });

  return slots
    .map((s) => ({ ...s, minutes: Math.round((s.end - s.start) / 60000) }))
    .filter((s) => s.minutes >= minMinutes);
}

function formatOccurrence(occ) {
  return `${formatDateTime(occ.start)} – ${formatDateTime(occ.end)}  ${occ.title}`;
}

module.exports = { findConflicts, findFreeSlots, formatOccurrence, CHECK_HORIZON_DAYS };
