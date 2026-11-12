'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toIcs, parseIcs } = require('../src/ical');
const { createEvent } = require('../src/events');

function ev(title, start, end, extra = {}) {
  return createEvent({ title, start, end, ...extra });
}

test('export/import round-trips plain and recurring events', () => {
  const events = [
    ev('Standup', '2026-11-13 09:00', '2026-11-13 09:30', { location: 'Room 2', tags: ['work'] }),
    ev('Gym', '2026-11-02 07:00', '2026-11-02 08:00', {
      recurrence: { freq: 'weekly', byDay: [1, 3, 5], count: 12 },
    }),
    ev('Rent', '2026-12-01 09:00', '2026-12-01 09:15', {
      recurrence: { freq: 'monthly', until: '2027-06-01' },
    }),
  ];
  const ics = toIcs(events);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;COUNT=12;BYDAY=MO,WE,FR/);
  assert.match(ics, /RRULE:FREQ=MONTHLY;UNTIL=20270601T235900/);

  const back = parseIcs(ics);
  assert.equal(back.length, 3);
  assert.equal(back[0].title, 'Standup');
  assert.equal(back[0].start, '2026-11-13 09:00');
  assert.equal(back[0].location, 'Room 2');
  assert.deepEqual(back[0].tags, ['work']);
  assert.deepEqual(back[1].recurrence, { freq: 'weekly', interval: 1, count: 12, byDay: [1, 3, 5] });
  assert.equal(back[2].recurrence.until, '2027-06-01');
});

test('text escaping survives commas, semicolons and newlines', () => {
  const events = [ev('Meet, then; lunch', '2026-11-13 12:00', '2026-11-13 13:00', { notes: 'line one\nline two' })];
  const back = parseIcs(toIcs(events));
  assert.equal(back[0].title, 'Meet, then; lunch');
  assert.equal(back[0].notes, 'line one\nline two');
});

test('import handles a real-world style ICS file with UTC times', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'BEGIN:VEVENT',
    'UID:abc123@google.com',
    'DTSTAMP:20261101T120000Z',
    'DTSTART:20261113T090000Z',
    'DTEND:20261113T100000Z',
    'SUMMARY:Flight to Istanbul',
    'LOCATION:Istanbul Airport',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  const back = parseIcs(ics);
  assert.equal(back.length, 1);
  assert.equal(back[0].title, 'Flight to Istanbul');
  assert.equal(back[0].location, 'Istanbul Airport');
  // UTC 09:00 -> local time in this VM's timezone (a valid datetime either way).
  assert.match(back[0].start, /^\d{4}-\d{2}-\d{2} \d{2}:00$/);
});

test('import rejects VEVENTs without required fields', () => {
  assert.throws(() => parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261113T090000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'), /SUMMARY/);
});
