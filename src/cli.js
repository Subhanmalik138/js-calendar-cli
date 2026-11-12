#!/usr/bin/env node
'use strict';

/**
 * CalCLI — a small, dependency-free CLI calendar.
 *
 *   calcli add --title "Team standup" --start "2026-11-13 09:00" --end "2026-11-13 09:30"
 *   calcli list [--from 2026-11-13] [--to 2026-11-20] [--tag work]
 *   calcli show <id>
 *   calcli delete <id>
 *
 * Recurrence, conflicts, agenda views, search, stats and iCal support are
 * added in later stages; each command is a thin wrapper over src/*.js so
 * the logic stays testable without spawning the CLI.
 */

const { Store } = require('./store');
const { createEvent } = require('./events');
const { parseWeekdays } = require('./recurrence');
const { findConflicts, findFreeSlots, formatOccurrence } = require('./conflicts');
const { agenda, formatAgendaDay, monthGrid, searchEvents } = require('./calendar');
const { computeStats, upcoming } = require('./stats');
const { parseDateTime, formatDateTime, formatTime, formatDate, startOfDay, endOfDay, addDays } = require('./dates');

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true; // boolean flag
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function splitTags(value) {
  if (!value) return [];
  return String(value).split(',').map((t) => t.trim()).filter(Boolean);
}

function printEvent(event) {
  const recur = event.recurrence
    ? `  ↻ ${event.recurrence.freq}${event.recurrence.interval > 1 ? ` every ${event.recurrence.interval}` : ''}${event.recurrence.count ? ` ×${event.recurrence.count}` : ''}${event.recurrence.until ? ` until ${event.recurrence.until}` : ''}`
    : '';
  const loc = event.location ? ` @ ${event.location}` : '';
  const tags = event.tags && event.tags.length ? `  [${event.tags.join(', ')}]` : '';
  console.log(`${event.id}  ${event.start} – ${event.end}  ${event.title}${loc}${tags}`);
  if (recur) console.log(recur);
  if (event.notes) console.log(`  ${event.notes}`);
}

function cmdAdd(store, flags) {
  let recurrence;
  if (flags.recur) {
    recurrence = {
      freq: flags.recur,
      interval: flags.interval ? Number(flags.interval) : 1,
      count: flags.count ? Number(flags.count) : undefined,
      until: flags.until,
      byDay: parseWeekdays(flags.byday),
    };
  }
  const event = createEvent({
    title: flags.title,
    start: flags.start,
    end: flags.end,
    location: flags.location,
    notes: flags.notes,
    tags: splitTags(flags.tags),
    recurrence,
  });
  if (!flags.force) {
    const clashes = findConflicts(store.all(), event);
    if (clashes.length) {
      const lines = clashes.slice(0, 5).flatMap((c) => [
        `  ${formatOccurrence(c.occurrence)}`,
        ...c.conflictsWith.map((o) => `    conflicts with: ${formatOccurrence(o)}`),
      ]);
      throw new Error(`event conflicts with existing events:\n${lines.join('\n')}\nAdd --force to save it anyway.`);
    }
  }
  store.add(event);
  console.log(`Added ${event.id}`);
  printEvent(event);
  return event;
}

function cmdList(store, flags) {
  let events = store.all();
  if (flags.tag) {
    events = events.filter((e) => (e.tags || []).includes(flags.tag));
  }
  const from = flags.from ? startOfDay(parseDateTime(flags.from)) : null;
  const to = flags.to ? endOfDay(parseDateTime(flags.to)) : null;
  if (from || to) {
    events = events.filter((e) => {
      const start = parseDateTime(e.start);
      return (!from || start >= from) && (!to || start <= to);
    });
  }
  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (events.length === 0) {
    console.log('No events.');
    return [];
  }
  events.forEach(printEvent);
  return events;
}

function cmdShow(store, positional) {
  const id = positional[0];
  if (!id) throw new Error('usage: calcli show <id>');
  const event = store.find(id);
  if (!event) throw new Error(`no event with id ${id}`);
  printEvent(event);
  return event;
}

function cmdDelete(store, positional) {
  const id = positional[0];
  if (!id) throw new Error('usage: calcli delete <id>');
  const removed = store.remove(id);
  if (!removed) throw new Error(`no event with id ${id}`);
  console.log(`Deleted ${removed.id} (${removed.title})`);
  return removed;
}

function cmdFree(store, flags, positional) {
  const date = positional[0];
  if (!date) throw new Error('usage: calcli free <YYYY-MM-DD> [--duration <minutes>] [--start HH:MM] [--end HH:MM]');
  const slots = findFreeSlots(store.all(), date, {
    dayStart: flags.start,
    dayEnd: flags.end,
    minMinutes: flags.duration ? Number(flags.duration) : 30,
  });
  if (slots.length === 0) {
    console.log(`No free slots of ${flags.duration || 30}+ minutes on ${date}.`);
    return [];
  }
  console.log(`Free slots on ${date}:`);
  for (const s of slots) {
    console.log(`  ${formatTime(s.start)} – ${formatTime(s.end)}  (${s.minutes} min)`);
  }
  return slots;
}

function printAgenda(days) {
  if (days.length === 0) {
    console.log('Nothing scheduled.');
    return days;
  }
  console.log(days.map(formatAgendaDay).join('\n\n'));
  return days;
}

function cmdAgenda(store, flags) {
  const from = flags.from ? parseDateTime(flags.from) : startOfDay(new Date());
  const to = flags.to ? endOfDay(parseDateTime(flags.to)) : endOfDay(addDays(from, 6));
  return printAgenda(agenda(store.all(), from, to));
}

function cmdToday(store) {
  const today = startOfDay(new Date());
  return printAgenda(agenda(store.all(), today, endOfDay(today)));
}

function cmdWeek(store) {
  const today = startOfDay(new Date());
  const monday = addDays(today, -((today.getDay() + 6) % 7)); // Monday of this week
  return printAgenda(agenda(store.all(), monday, endOfDay(addDays(monday, 6))));
}

function cmdMonth(store, positional) {
  const arg = positional[0];
  let year;
  let month;
  if (arg) {
    const m = /^(\d{4})-(\d{2})$/.exec(arg);
    if (!m) throw new Error('usage: calcli month [YYYY-MM]');
    year = +m[1];
    month = +m[2] - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }
  console.log(monthGrid(year, month, store.all()));
  return null;
}

function cmdSearch(store, positional) {
  const query = positional.join(' ');
  if (!query) throw new Error('usage: calcli search <query>');
  const hits = searchEvents(store.all(), query);
  if (hits.length === 0) {
    console.log(`No events matching "${query}".`);
    return [];
  }
  hits.forEach(printEvent);
  return hits;
}

function cmdStats(store, flags) {
  const from = flags.from ? parseDateTime(flags.from) : startOfDay(addDays(new Date(), -29));
  const to = flags.to ? endOfDay(parseDateTime(flags.to)) : endOfDay(new Date());
  const s = computeStats(store.all(), from, to);
  console.log(`Events stored: ${s.storedEvents}`);
  console.log(`Occurrences ${formatDate(from)} – ${formatDate(to)}: ${s.occurrences}`);
  console.log(`Total scheduled time: ${s.totalHours} hours`);
  if (s.busiestDay) {
    console.log(`Busiest day: ${s.busiestDay.date} (${s.busiestDay.count} events, ${Math.round(s.busiestDay.minutes / 60 * 10) / 10} hours)`);
  }
  if (Object.keys(s.hoursByTag).length) {
    console.log('Hours by tag:');
    for (const [tag, hours] of Object.entries(s.hoursByTag)) console.log(`  ${tag}: ${hours}h`);
  }
  return s;
}

function cmdUpcoming(store, flags) {
  const hours = flags.hours ? Number(flags.hours) : 24;
  const next = upcoming(store.all(), hours);
  if (next.length === 0) {
    console.log(`Nothing in the next ${hours} hours.`);
    return [];
  }
  console.log(`Coming up in the next ${hours} hours:`);
  for (const o of next) console.log(`  ${formatOccurrence(o)}`);
  return next;
}

const HELP = `CalCLI — a CLI calendar and event planner

Usage:
  calcli add --title <t> --start "YYYY-MM-DD HH:MM" --end "YYYY-MM-DD HH:MM"
             [--location <l>] [--notes <n>] [--tags a,b]
             [--recur daily|weekly|monthly] [--interval <n>] [--count <n>]
             [--until YYYY-MM-DD] [--byday Mon,Wed,Fri] [--force]
  calcli list [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--tag <tag>]
  calcli show <id>
  calcli delete <id>
  calcli free <YYYY-MM-DD> [--duration <minutes>] [--start HH:MM] [--end HH:MM]
  calcli agenda [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  calcli today | week | month [YYYY-MM]
  calcli search <query>
  calcli stats [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  calcli upcoming [--hours <n>]
  calcli help

Events are stored in ~/.calcli/events.json (override with CALCLI_DATA).
`;

function main(argv) {
  const [command, ...rest] = argv;
  const store = new Store();
  const { flags, positional } = parseFlags(rest);

  switch (command) {
    case 'add': return cmdAdd(store, flags);
    case 'list': return cmdList(store, flags);
    case 'show': return cmdShow(store, positional);
    case 'delete': return cmdDelete(store, positional);
    case 'free': return cmdFree(store, flags, positional);
    case 'agenda': return cmdAgenda(store, flags);
    case 'today': return cmdToday(store);
    case 'week': return cmdWeek(store);
    case 'month': return cmdMonth(store, positional);
    case 'search': return cmdSearch(store, positional);
    case 'stats': return cmdStats(store, flags);
    case 'upcoming': return cmdUpcoming(store, flags);
    case 'help':
    case undefined:
      console.log(HELP);
      return null;
    default:
      throw new Error(`unknown command: ${command}\n${HELP}`);
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { main, parseFlags, printEvent };
