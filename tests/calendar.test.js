'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { agenda, monthGrid, searchEvents } = require('../src/calendar');
const { computeStats, upcoming } = require('../src/stats');
const { createEvent } = require('../src/events');

function ev(title, start, end, extra = {}) {
  return createEvent({ title, start, end, ...extra });
}

test('agenda groups occurrences by day in order', () => {
  const events = [
    ev('B', '2026-11-14 10:00', '2026-11-14 11:00'),
    ev('A', '2026-11-13 09:00', '2026-11-13 09:30'),
    ev('Daily', '2026-11-13 07:00', '2026-11-13 07:30', { recurrence: { freq: 'daily', count: 3 } }),
  ];
  const days = agenda(events, '2026-11-13', '2026-11-15 23:59');
  assert.deepEqual(days.map((d) => d.date), ['2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(days[0].items.length, 2); // A + Daily
  assert.equal(days[0].weekday, 'Fri'); // 2026-11-13 is a Friday
});

test('monthGrid marks days with events', () => {
  const events = [ev('X', '2026-11-13 09:00', '2026-11-13 10:00')];
  const grid = monthGrid(2026, 10, events); // November
  assert.match(grid, /November 2026/);
  assert.match(grid, /13\*/);
  assert.match(grid, /Nov 13: 1 event/);
});

test('searchEvents matches title, location, notes and tags', () => {
  const events = [
    ev('Standup', '2026-11-13 09:00', '2026-11-13 09:30', { tags: ['work'] }),
    ev('Dentist', '2026-11-14 10:00', '2026-11-14 11:00', { location: 'City Clinic' }),
    ev('Read', '2026-11-15 18:00', '2026-11-15 19:00', { notes: 'finish chapter 4' }),
  ];
  assert.equal(searchEvents(events, 'standup').length, 1);
  assert.equal(searchEvents(events, 'clinic').length, 1);
  assert.equal(searchEvents(events, 'chapter').length, 1);
  assert.equal(searchEvents(events, 'WORK').length, 1);
  assert.equal(searchEvents(events, 'nope').length, 0);
});

test('computeStats totals hours and finds the busiest day', () => {
  const events = [
    ev('A', '2026-11-13 09:00', '2026-11-13 11:00', { tags: ['work'] }),
    ev('B', '2026-11-13 13:00', '2026-11-13 14:00', { tags: ['work'] }),
    ev('C', '2026-11-14 10:00', '2026-11-14 11:00', { tags: ['gym'] }),
  ];
  const stats = computeStats(events, '2026-11-13', '2026-11-14 23:59');
  assert.equal(stats.storedEvents, 3);
  assert.equal(stats.occurrences, 3);
  assert.equal(stats.totalHours, 4);
  assert.equal(stats.busiestDay.date, '2026-11-13');
  assert.equal(stats.busiestDay.minutes, 180);
  assert.deepEqual(stats.hoursByTag, { work: 3, gym: 1 });
});

test('upcoming returns occurrences starting within the window', () => {
  const now = new Date(2026, 10, 13, 8, 0); // Nov 13 08:00 local
  const events = [
    ev('Soon', '2026-11-13 09:00', '2026-11-13 10:00'),
    ev('Later', '2026-11-14 09:00', '2026-11-14 10:00'),
    ev('Past', '2026-11-13 07:00', '2026-11-13 07:30'),
  ];
  const next = upcoming(events, 26, now);
  assert.deepEqual(next.map((o) => o.title), ['Soon', 'Later']);
});
