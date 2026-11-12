'use strict';

/**
 * Event model.
 *
 * An event is a plain object:
 *   {
 *     id: string,            // "evt_<random>" — stable across edits
 *     title: string,
 *     start: "YYYY-MM-DD HH:MM",
 *     end:   "YYYY-MM-DD HH:MM",
 *     location?: string,
 *     notes?: string,
 *     tags?: string[],
 *     recurrence?: { freq: "daily"|"weekly"|"monthly", interval?: number,
 *                    count?: number, until?: "YYYY-MM-DD", byDay?: number[] }
 *   }
 *
 * Times are stored as naive local-time strings so the JSON file stays
 * human-readable and editable by hand.
 */

const { parseDateTime, formatDateTime } = require('./dates');
const crypto = require('node:crypto');

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

function newId() {
  return `evt_${crypto.randomBytes(6).toString('hex')}`;
}

function validateRecurrence(rule) {
  if (rule == null) return undefined;
  if (typeof rule !== 'object' || Array.isArray(rule)) {
    throw new Error('recurrence must be an object');
  }
  const { freq, interval = 1, count, until, byDay } = rule;
  if (!FREQUENCIES.includes(freq)) {
    throw new Error(`recurrence freq must be one of ${FREQUENCIES.join(', ')}`);
  }
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error('recurrence interval must be a positive integer');
  }
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error('recurrence count must be a positive integer');
  }
  if (until !== undefined) parseDateTime(until);
  if (byDay !== undefined) {
    if (!Array.isArray(byDay) || byDay.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new Error('recurrence byDay must be an array of weekday numbers (0=Sun .. 6=Sat)');
    }
  }
  if (count === undefined && until === undefined) {
    // Open-ended series are fine — expansion is always window-bounded.
  }
  const out = { freq, interval };
  if (count !== undefined) out.count = count;
  if (until !== undefined) out.until = until;
  if (byDay !== undefined) out.byDay = [...byDay].sort((a, b) => a - b);
  return out;
}

/** Validate raw input and return a normalized event object. */
function createEvent(input) {
  if (!input || typeof input !== 'object') throw new Error('event input must be an object');
  const title = String(input.title || '').trim();
  if (!title) throw new Error('event title is required');
  if (!input.start) throw new Error('event start is required');
  if (!input.end) throw new Error('event end is required');

  const start = parseDateTime(input.start);
  const end = parseDateTime(input.end);
  if (end <= start) throw new Error('event end must be after start');

  const tags = input.tags == null ? [] : input.tags;
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
    throw new Error('event tags must be an array of strings');
  }

  const event = {
    id: input.id || newId(),
    title,
    start: formatDateTime(start),
    end: formatDateTime(end),
    location: input.location ? String(input.location).trim() : undefined,
    notes: input.notes ? String(input.notes).trim() : undefined,
    tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))],
    recurrence: validateRecurrence(input.recurrence),
  };
  // Drop undefined keys so the JSON file stays clean.
  for (const key of Object.keys(event)) {
    if (event[key] === undefined) delete event[key];
  }
  return event;
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function eventDurationMinutes(event) {
  const start = parseDateTime(event.start);
  const end = parseDateTime(event.end);
  return Math.round((end - start) / 60000);
}

module.exports = { createEvent, validateRecurrence, intervalsOverlap, eventDurationMinutes, newId };
