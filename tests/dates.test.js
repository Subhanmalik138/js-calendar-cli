'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDateTime, formatDate, formatDateTime, addDays, addMonths, minutesBetween,
} = require('../src/dates');

test('parseDateTime accepts date and datetime forms', () => {
  const d = parseDateTime('2026-11-13 09:30');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 13);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 30);
  assert.equal(formatDate(parseDateTime('2026-11-13')), '2026-11-13');
  assert.equal(formatDateTime(parseDateTime('2026-11-13T09:30')), '2026-11-13 09:30');
});

test('parseDateTime rejects impossible dates', () => {
  assert.throws(() => parseDateTime('2026-02-30'), /invalid date/);
  assert.throws(() => parseDateTime('2026-13-01'), /invalid date/);
  assert.throws(() => parseDateTime('not a date'), /invalid date/);
  assert.throws(() => parseDateTime('2026-11-13 25:00'), /invalid date/);
});

test('addMonths clamps to the end of short months', () => {
  assert.equal(formatDate(addMonths(parseDateTime('2026-01-31'), 1)), '2026-02-28');
  assert.equal(formatDate(addMonths(parseDateTime('2026-01-31'), 2)), '2026-03-31');
  assert.equal(formatDate(addMonths(parseDateTime('2026-03-31'), -1)), '2026-02-28');
});

test('addDays and minutesBetween', () => {
  assert.equal(formatDate(addDays(parseDateTime('2026-12-31'), 1)), '2027-01-01');
  assert.equal(minutesBetween(parseDateTime('2026-11-13 09:00'), parseDateTime('2026-11-13 10:30')), 90);
});
