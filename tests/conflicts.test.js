'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findConflicts, findFreeSlots } = require('../src/conflicts');
const { createEvent } = require('../src/events');

function ev(title, start, end, extra = {}) {
  return createEvent({ title, start, end, ...extra });
}

test('findConflicts catches a direct overlap and ignores touching events', () => {
  const existing = [ev('Standup', '2026-11-13 09:00', '2026-11-13 09:30')];
  const clash = findConflicts(existing, ev('Call', '2026-11-13 09:15', '2026-11-13 10:00'));
  assert.equal(clash.length, 1);
  assert.equal(clash[0].conflictsWith[0].title, 'Standup');

  const ok = findConflicts(existing, ev('Call', '2026-11-13 09:30', '2026-11-13 10:00'));
  assert.equal(ok.length, 0); // back-to-back is fine
});

test('findConflicts catches recurring-vs-recurring clashes', () => {
  const existing = [ev('Gym', '2026-11-02 07:00', '2026-11-02 08:00',
    { recurrence: { freq: 'weekly', byDay: [1, 3, 5] } })];
  const candidate = ev('Meeting', '2026-11-04 07:30', '2026-11-04 08:30',
    { recurrence: { freq: 'weekly', byDay: [3] } });
  const clash = findConflicts(existing, candidate);
  assert.ok(clash.length > 0);
  assert.equal(clash[0].occurrence.start.getDay(), 3);
});

test('findConflicts ignores the candidate itself', () => {
  const e = ev('Standup', '2026-11-13 09:00', '2026-11-13 09:30');
  assert.equal(findConflicts([e], e).length, 0);
});

test('findFreeSlots returns gaps between events', () => {
  const events = [
    ev('A', '2026-11-13 09:00', '2026-11-13 10:00'),
    ev('B', '2026-11-13 12:00', '2026-11-13 13:00'),
    ev('C', '2026-11-13 12:30', '2026-11-13 14:00'), // overlaps B, merges
  ];
  const slots = findFreeSlots(events, '2026-11-13', { minMinutes: 30 });
  assert.deepEqual(
    slots.map((s) => `${s.start.getHours()}:${String(s.start.getMinutes()).padStart(2, '0')}-${s.end.getHours()}:${String(s.end.getMinutes()).padStart(2, '0')}`),
    ['8:00-9:00', '10:00-12:00', '14:00-20:00'],
  );
});

test('findFreeSlots respects minMinutes and custom window', () => {
  const events = [ev('A', '2026-11-13 09:00', '2026-11-13 19:45')];
  const slots = findFreeSlots(events, '2026-11-13', { dayStart: '09:00', dayEnd: '20:00', minMinutes: 30 });
  assert.equal(slots.length, 0); // only a 15-minute gap remains
  const wide = findFreeSlots(events, '2026-11-13', { dayStart: '09:00', dayEnd: '20:00', minMinutes: 15 });
  assert.equal(wide.length, 1);
  assert.equal(wide[0].minutes, 15);
});

test('findFreeSlots on an empty day returns the whole window', () => {
  const slots = findFreeSlots([], '2026-11-13');
  assert.equal(slots.length, 1);
  assert.equal(slots[0].minutes, 720);
});
