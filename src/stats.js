'use strict';

/**
 * Stats and reminders over expanded occurrences.
 */

const { formatDate, minutesBetween } = require('./dates');
const { expandAll } = require('./recurrence');

/** Aggregate stats for occurrences inside [from, to]. */
function computeStats(events, from, to) {
  const occ = expandAll(events, from, to);
  let totalMinutes = 0;
  const byDay = new Map(); // date -> { count, minutes }
  const byTag = new Map(); // tag -> minutes

  for (const o of occ) {
    const mins = minutesBetween(o.start, o.end);
    totalMinutes += mins;
    const key = formatDate(o.start);
    const day = byDay.get(key) || { count: 0, minutes: 0 };
    day.count++;
    day.minutes += mins;
    byDay.set(key, day);
    for (const tag of o.tags || []) {
      byTag.set(tag, (byTag.get(tag) || 0) + mins);
    }
  }

  let busiestDay = null;
  for (const [date, d] of byDay) {
    if (!busiestDay || d.minutes > busiestDay.minutes) busiestDay = { date, ...d };
  }

  return {
    storedEvents: events.length,
    occurrences: occ.length,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    busiestDay,
    hoursByTag: Object.fromEntries(
      [...byTag.entries()]
        .map(([tag, mins]) => [tag, Math.round((mins / 60) * 10) / 10])
        .sort((a, b) => b[1] - a[1]),
    ),
  };
}

/** Occurrences starting within the next `hours` hours from `now`. */
function upcoming(events, hours = 24, now = new Date()) {
  const from = now;
  const to = new Date(now.getTime() + hours * 3600 * 1000);
  return expandAll(events, from, to);
}

module.exports = { computeStats, upcoming };
