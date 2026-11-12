'use strict';

/**
 * Atomic JSON store.
 *
 * Events live in a single JSON file: { "events": [ ... ] }.
 * Every write goes to a temp file in the same directory and is then
 * renamed over the real file, so a crash mid-write can never leave a
 * half-written calendar behind. Reads tolerate a missing file (empty
 * calendar) and report a corrupt file instead of silently dropping data.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function defaultPath() {
  if (process.env.CALCLI_DATA) return process.env.CALCLI_DATA;
  return path.join(os.homedir(), '.calcli', 'events.json');
}

class Store {
  constructor(filePath) {
    this.filePath = filePath || defaultPath();
  }

  load() {
    let raw;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`calendar file is corrupt (not valid JSON): ${this.filePath}`);
    }
    if (!data || !Array.isArray(data.events)) {
      throw new Error(`calendar file has unexpected shape (expected {"events": [...]}): ${this.filePath}`);
    }
    return data.events;
  }

  save(events) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.events-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify({ events }, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  add(event) {
    const events = this.load();
    events.push(event);
    this.save(events);
    return event;
  }

  remove(id) {
    const events = this.load();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const [removed] = events.splice(idx, 1);
    this.save(events);
    return removed;
  }

  find(id) {
    return this.load().find((e) => e.id === id) || null;
  }

  all() {
    return this.load();
  }
}

module.exports = { Store, defaultPath };
