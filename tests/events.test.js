'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent, intervalsOverlap, eventDurationMinutes } = require('../src/events');

test('createEvent normalizes and validates', () => {
  const e = createEvent({
    title: '  Standup ',
    start: '2026-11-13 09:00',
    end: '2026-11-13 09:30',
    tags: ['work', 'work', ' team '],
  });
  assert.equal(e.title, 'Standup');
  assert.deepEqual(e.tags, ['work', 'team']);
  assert.match(e.id, /^evt_/);
  assert.equal(e.location, undefined);
});

test('createEvent rejects bad input', () => {
  assert.throws(() => createEvent({ start: '2026-11-13 09:00', end: '2026-11-13 09:30' }), /title/);
  assert.throws(() => createEvent({ title: 'x', start: '2026-11-13 10:00', end: '2026-11-13 09:00' }), /after start/);
  assert.throws(() => createEvent({ title: 'x', start: '2026-11-13 09:00', end: '2026-11-13 09:00' }), /after start/);
  assert.throws(() => createEvent({ title: 'x', start: '2026-11-13 09:00', end: '2026-11-13 10:00', recurrence: { freq: 'yearly' } }), /freq/);
  assert.throws(() => createEvent({ title: 'x', start: '2026-11-13 09:00', end: '2026-11-13 10:00', recurrence: { freq: 'weekly', byDay: [7] } }), /byDay/);
});

test('intervalsOverlap uses half-open intervals', () => {
  const t = (s) => new Date(`2026-11-13T${s}:00`);
  assert.equal(intervalsOverlap(t('09:00'), t('10:00'), t('09:30'), t('10:30')), true);
  assert.equal(intervalsOverlap(t('09:00'), t('10:00'), t('10:00'), t('11:00')), false); // touching is fine
  assert.equal(intervalsOverlap(t('09:00'), t('10:00'), t('08:00'), t('09:00')), false);
  assert.equal(intervalsOverlap(t('09:00'), t('10:00'), t('08:00'), t('09:01')), true);
});

test('eventDurationMinutes', () => {
  const e = createEvent({ title: 'x', start: '2026-11-13 09:00', end: '2026-11-13 10:45' });
  assert.equal(eventDurationMinutes(e), 105);
});
