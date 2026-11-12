'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { expand } = require('../src/recurrence');
const { createEvent } = require('../src/events');

function ev(overrides) {
  return createEvent({
    title: 'Test', start: '2026-11-02 09:00', end: '2026-11-02 10:00', ...overrides,
  });
}

test('non-recurring event expands to itself inside the window', () => {
  const occ = expand(ev({}), '2026-11-01', '2026-11-30');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start.getDate(), 2);
  assert.equal(expand(ev({}), '2026-12-01', '2026-12-31').length, 0);
});

test('daily recurrence with count and interval', () => {
  const e = ev({ recurrence: { freq: 'daily', interval: 2, count: 3 } });
  const occ = expand(e, '2026-11-01', '2026-12-31');
  assert.deepEqual(occ.map((o) => o.start.getDate()), [2, 4, 6]);
  assert.equal(occ[2].occurrenceIndex, 3);
  // Duration is preserved on every occurrence.
  assert.equal(occ[0].end.getHours(), 10);
});

test('weekly recurrence on given weekdays', () => {
  // 2026-11-02 is a Monday.
  const e = ev({ recurrence: { freq: 'weekly', interval: 1, byDay: [1, 3, 5], count: 6 } });
  const occ = expand(e, '2026-11-01', '2026-11-30');
  assert.deepEqual(
    occ.map((o) => `${o.start.getMonth() + 1}/${o.start.getDate()}`),
    ['11/2', '11/4', '11/6', '11/9', '11/11', '11/13'],
  );
});

test('weekly recurrence defaults to the first occurrence weekday', () => {
  const e = ev({ recurrence: { freq: 'weekly', interval: 1, count: 3 } });
  const occ = expand(e, '2026-11-01', '2026-12-31');
  assert.deepEqual(occ.map((o) => o.start.getDay()), [1, 1, 1]);
});

test('monthly recurrence clamps to short months', () => {
  const e = ev({ start: '2026-01-31 09:00', end: '2026-01-31 10:00', recurrence: { freq: 'monthly', count: 3 } });
  const occ = expand(e, '2026-01-01', '2026-12-31');
  assert.deepEqual(
    occ.map((o) => `${o.start.getMonth() + 1}/${o.start.getDate()}`),
    ['1/31', '2/28', '3/31'],
  );
});

test('until is inclusive and count wins over until', () => {
  const e = ev({ recurrence: { freq: 'daily', count: 10, until: '2026-11-03' } });
  const occ = expand(e, '2026-11-01', '2026-12-31');
  assert.equal(occ.length, 2); // Nov 2 and Nov 3 only
  const e2 = ev({ recurrence: { freq: 'daily', count: 2, until: '2026-12-31' } });
  assert.equal(expand(e2, '2026-11-01', '2026-12-31').length, 2);
});

test('open-ended series is bounded by the window', () => {
  const e = ev({ recurrence: { freq: 'daily' } });
  const occ = expand(e, '2026-11-02', '2026-11-08 23:59');
  assert.equal(occ.length, 7);
});
