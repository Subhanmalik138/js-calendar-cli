'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/store');
const { createEvent } = require('../src/events');

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calcli-test-'));
  return { store: new Store(path.join(dir, 'events.json')), dir };
}

test('store starts empty, round-trips events, and deletes', () => {
  const { store } = tmpStore();
  assert.deepEqual(store.all(), []);
  const e = createEvent({ title: 'Demo', start: '2026-11-13 09:00', end: '2026-11-13 10:00' });
  store.add(e);
  assert.equal(store.all().length, 1);
  assert.equal(store.find(e.id).title, 'Demo');
  const removed = store.remove(e.id);
  assert.equal(removed.id, e.id);
  assert.deepEqual(store.all(), []);
  assert.equal(store.remove('evt_missing'), null);
});

test('store reports corrupt files instead of silently dropping data', () => {
  const { store } = tmpStore();
  fs.writeFileSync(store.filePath, '{not json', 'utf8');
  assert.throws(() => store.all(), /corrupt/);
  fs.writeFileSync(store.filePath, '{"events": "nope"}', 'utf8');
  assert.throws(() => store.all(), /unexpected shape/);
});

test('store writes atomically (no temp files left behind)', () => {
  const { store, dir } = tmpStore();
  const e = createEvent({ title: 'Demo', start: '2026-11-13 09:00', end: '2026-11-13 10:00' });
  store.add(e);
  const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
  const parsed = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
  assert.equal(parsed.events[0].title, 'Demo');
});
