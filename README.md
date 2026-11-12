# CalCLI — a CLI calendar and event planner

A small, dependency-free command-line calendar for people who live in the
terminal. Add events, repeat them with real recurrence rules, catch
double-bookings before they happen, find free time, and take your calendar
with you as a standard `.ics` file.

```bash
# One-off event
calcli add --title "Team standup" --start "2026-11-13 09:00" --end "2026-11-13 09:30" --tags work

# Every Monday and Wednesday, four times
calcli add --title "Gym" --start "2026-11-16 07:00" --end "2026-11-16 08:00" \
  --recur weekly --byday Mon,Wed --count 4

# See the week, find a free hour, export to Google Calendar
calcli week
calcli free 2026-11-13 --duration 60
calcli export --file calendar.ics
```

## Why this exists

Most calendar CLIs are either a thin wrapper over a cloud API or a
single-file script with no model of time. CalCLI keeps its own small JSON
store (atomic writes, human-readable) and treats recurrence, overlap and
free time as first-class problems:

- **Recurrence is expanded, not faked.** Daily, weekly (with `BYDAY`) and
  monthly rules with `interval`, `count` and `until`. Monthly rules clamp
  to short months (Jan 31 → Feb 28), and expansion is always
  window-bounded so an open-ended series can't run away.
- **Conflicts are checked on expanded occurrences.** Adding a weekly
  meeting that collides with a recurring gym session three weeks out is
  caught at add time — unless you pass `--force`.
- **Free slots merge busy blocks** and respect a minimum duration and a
  configurable day window.
- **iCalendar is a real interchange format here**, not a dump: export
  writes one `VEVENT` per event with a proper `RRULE`; import reads
  `.ics` files from other calendars, including UTC times and all-day
  events.

## Install

Requires Node.js 18+ and nothing else — zero dependencies.

```bash
git clone https://github.com/Subhanmalik138/js-calendar-cli.git
cd js-calendar-cli
npm link        # puts `calcli` on your PATH
# or run it directly:
node src/cli.js help
```

Events are stored in `~/.calcli/events.json` (override with the
`CALCLI_DATA` environment variable).

## Usage

| Command | What it does |
| --- | --- |
| `add --title … --start … --end …` | Add an event. `--location`, `--notes`, `--tags a,b`, `--recur daily\|weekly\|monthly`, `--interval`, `--count`, `--until YYYY-MM-DD`, `--byday Mon,Wed`, `--force` |
| `list [--from …] [--to …] [--tag …]` | List stored events (not expanded) |
| `show <id>` / `delete <id>` | Inspect / remove one event |
| `agenda [--from …] [--to …]` | Day-by-day agenda (defaults to the next 7 days) |
| `today` / `week` / `month [YYYY-MM]` | Quick views; `month` draws a text calendar with `*` on busy days |
| `search <query>` | Case-insensitive search over title, location, notes, tags |
| `free <YYYY-MM-DD> [--duration 60]` | Free slots in the day (default window 08:00–20:00, min 30 min) |
| `stats [--from …] [--to …]` | Occurrences, total hours, busiest day, hours by tag |
| `upcoming [--hours 24]` | Events starting in the next N hours |
| `export [--file out.ics]` | Write the whole calendar as iCalendar (stdout by default) |
| `import <file.ics>` | Import events from an `.ics` file |

Times are local and written as `YYYY-MM-DD HH:MM`. Two events that touch
(09:00–10:00 then 10:00–11:00) are **not** a conflict — only overlapping
time is.

## Design decisions

1. **Naive local times, stored as strings.** A personal CLI calendar
   doesn't need a timezone database; storing `"2026-11-13 09:00"` keeps
   the JSON file readable and editable by hand, and iCal export uses
   floating times for the same reason.
2. **Atomic JSON store.** Every write goes to a temp file in the same
   directory and is renamed over the real file, so a crash mid-write
   can't corrupt the calendar. A corrupt file is reported, never silently
   emptied.
3. **Logic lives in `src/`, the CLI is a thin shell.** `recurrence.js`,
   `conflicts.js`, `calendar.js`, `stats.js` and `ical.js` are pure
   functions over plain objects, so they're unit-tested without spawning
   the CLI.
4. **Half-open intervals everywhere.** `[start, end)` makes back-to-back
   events, free-slot edges and overlap tests consistent.

## Project structure

```
src/
  cli.js          argument parsing + command dispatch
  dates.js        parsing/formatting, month arithmetic (clamped)
  events.js       event model + validation
  store.js        atomic JSON store
  recurrence.js   daily/weekly/monthly expansion
  conflicts.js    overlap detection, free-slot search
  calendar.js     agenda, month grid, search
  stats.js        aggregates + upcoming reminders
  ical.js         RFC 5545 export/import
tests/            node:test suites (33 tests)
```

## Tests

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
