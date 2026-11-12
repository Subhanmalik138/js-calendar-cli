'use strict';

/**
 * iCalendar (.ics) export and import (RFC 5545, floating local times).
 *
 * Export writes one VEVENT per stored event, with an RRULE when the event
 * recurs — the standard way to represent a series, rather than expanding
 * it into hundreds of VEVENTs. Import understands the same subset plus
 * UTC ("Z") times, which it converts to local time.
 */

const { parseDateTime, formatDateTime } = require('./dates');
const { createEvent } = require('./events');

const WEEKDAY_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function unescapeText(text) {
  return String(text)
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** "2026-11-13 09:00" -> "20261113T090000" (floating local time). */
function toIcsDateTime(value) {
  const d = parseDateTime(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** "20261113T090000" / "20261113T090000Z" / "20261113" -> "YYYY-MM-DD HH:MM". */
function fromIcsDateTime(value) {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!m) throw new Error(`unsupported ICS date/time: ${value}`);
  if (m[7] === 'Z') {
    const utc = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return formatDateTime(utc);
  }
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function rruleToString(rule) {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${toIcsDateTime(`${rule.until} 23:59`)}`);
  if (rule.byDay && rule.byDay.length) {
    parts.push(`BYDAY=${rule.byDay.map((d) => WEEKDAY_ICS[d]).join(',')}`);
  }
  return parts.join(';');
}

function rruleFromString(text) {
  const rule = {};
  for (const part of text.split(';')) {
    const [key, val] = part.split('=');
    if (key === 'FREQ') rule.freq = val.toLowerCase();
    else if (key === 'INTERVAL') rule.interval = Number(val);
    else if (key === 'COUNT') rule.count = Number(val);
    else if (key === 'UNTIL') rule.until = fromIcsDateTime(val).slice(0, 10);
    else if (key === 'BYDAY') {
      rule.byDay = val.split(',').map((d) => WEEKDAY_ICS.indexOf(d)).filter((d) => d >= 0);
    }
  }
  if (!rule.freq) return undefined;
  if (!rule.interval) rule.interval = 1;
  return rule;
}

function eventToVevent(event) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@calcli`,
    `DTSTAMP:${toIcsDateTime(formatDateTime(new Date()))}`,
    `DTSTART:${toIcsDateTime(event.start)}`,
    `DTEND:${toIcsDateTime(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`);
  if (event.tags && event.tags.length) {
    lines.push(`CATEGORIES:${event.tags.map(escapeText).join(',')}`);
  }
  if (event.recurrence) lines.push(`RRULE:${rruleToString(event.recurrence)}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function toIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalCLI//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of events) lines.push(eventToVevent(event));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Unfold continuation lines (RFC 5545 §3.1) and split into VEVENT blocks. */
function parseIcs(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    if (!current.SUMMARY) throw new Error('VEVENT without SUMMARY');
    if (!current.DTSTART) throw new Error('VEVENT without DTSTART');
    const start = fromIcsDateTime(current.DTSTART);
    let end = current.DTEND ? fromIcsDateTime(current.DTEND) : null;
    if (!end) {
      // No end given: all-day events run to the next day (exclusive, per
      // RFC 5545), timed events default to one hour.
      const d = parseDateTime(start);
      if (start.length === 10) d.setDate(d.getDate() + 1);
      else d.setHours(d.getHours() + 1);
      end = formatDateTime(d);
    }
    events.push(createEvent({
      title: unescapeText(current.SUMMARY),
      start,
      end,
      location: current.LOCATION ? unescapeText(current.LOCATION) : undefined,
      notes: current.DESCRIPTION ? unescapeText(current.DESCRIPTION) : undefined,
      tags: current.CATEGORIES
        ? current.CATEGORIES.split(',').map((t) => unescapeText(t.trim())).filter(Boolean)
        : [],
      recurrence: current.RRULE ? rruleFromString(current.RRULE) : undefined,
    }));
    current = null;
  };

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') flush();
    else if (current) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).split(';')[0];
      current[key] = line.slice(idx + 1);
    }
  }
  return events;
}

module.exports = { toIcs, parseIcs, toIcsDateTime, fromIcsDateTime, rruleToString, rruleFromString };
