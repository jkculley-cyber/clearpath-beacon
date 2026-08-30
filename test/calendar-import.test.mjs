/* Offline tests for ICS import: date-range windowing + RRULE expansion.
 * Pure functions only (calendarImport.js has no browser deps). */
import {
  parseIcs, parseIcsDetailed, expandRecurrence, categorizeDomain, defaultImportWindow,
} from '../src/lib/calendarImport.js';

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label, detail = '') {
  if (cond) { pass++; } else { fail++; fails.push(`${label}${detail ? ' :: ' + detail : ''}`); }
}
function eq(a, b, label) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, label, `got ${A} want ${B}`);
}

/** Build an ICS document from VEVENT bodies. */
function ics(...bodies) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0']
    .concat(bodies.map((b) => `BEGIN:VEVENT\n${b}\nEND:VEVENT`))
    .concat(['END:VCALENDAR'])
    .join('\n');
}
const ev = ({ summary, start, end, rrule, exdate }) => [
  `SUMMARY:${summary}`,
  `DTSTART:${start}`,
  `DTEND:${end}`,
  rrule ? `RRULE:${rrule}` : null,
  exdate ? `EXDATE:${exdate}` : null,
].filter(Boolean).join('\n');

console.log('=== 1. Date-range windowing (Nicole: "imported every event back to 2024") ===');
{
  const doc = ics(
    ev({ summary: 'Ancient staff meeting', start: '20240912T090000', end: '20240912T100000' }),
    ev({ summary: 'Last year lesson', start: '20250915T090000', end: '20250915T100000' }),
    ev({ summary: 'This year lesson', start: '20260915T090000', end: '20260915T100000' }),
  );

  const all = parseIcs(doc);
  eq(all.length, 3, 'no window = every event (backwards compatible)');

  const windowed = parseIcsDetailed(doc, { from: '2026-08-01', to: '2027-05-31' });
  eq(windowed.entries.length, 1, 'window keeps only in-range events');
  eq(windowed.entries[0].activity_description, 'This year lesson', 'the surviving event is the right one');
  eq(windowed.stats.outOfRange, 2, 'out-of-range count is reported, not silent');

  // Boundaries are inclusive on both ends.
  const edge = ics(
    ev({ summary: 'First day', start: '20260803T090000', end: '20260803T100000' }),
    ev({ summary: 'Last day', start: '20270531T090000', end: '20270531T100000' }),
    ev({ summary: 'Day before', start: '20260731T090000', end: '20260731T100000' }), // Fri Jul 31
    ev({ summary: 'Day after', start: '20270601T090000', end: '20270601T100000' }),
  );
  const edgeRes = parseIcs(edge, { from: '2026-08-03', to: '2027-05-31' });
  eq(edgeRes.map((e) => e.activity_description).sort(), ['First day', 'Last day'], 'window bounds are inclusive');

  // A garbage/absent bound must not silently drop everything.
  eq(parseIcs(doc, { from: 'not-a-date', to: '' }).length, 3, 'unparseable bounds fall back to no filter');
}

console.log('=== 2. RRULE expansion — a weekly duty is many entries, not one ===');
{
  // Every Monday from Aug 3 2026, through the window.
  const doc = ics(ev({
    summary: 'Bus duty', start: '20260803T073000', end: '20260803T080000',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260831T235959Z',
  }));
  const res = parseIcsDetailed(doc, { from: '2026-08-01', to: '2026-08-31' });
  const dates = res.entries.map((e) => e.entry_date);
  eq(dates, ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'], 'weekly Monday series expands');
  eq(res.stats.recurringExpanded, 1, 'expansion is counted');
  eq(res.entries[0].duration_minutes, 30, 'every occurrence keeps the series duration');
  eq(res.entries[0].domain, 'non_counseling', 'duty still categorizes as non-counseling');

  // Multi-day BYDAY (the same thing Nicole wants when creating events in Beacon).
  const multi = parseIcs(ics(ev({
    summary: 'Morning check-in', start: '20260803T073000', end: '20260803T074500',
    rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  })), { from: '2026-08-03', to: '2026-08-14' });
  eq(multi.map((e) => e.entry_date),
    ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-10', '2026-08-12', '2026-08-14'],
    'BYDAY with several days expands to each of them');

  // INTERVAL=2 means every OTHER week.
  const biweekly = parseIcs(ics(ev({
    summary: 'PLC meeting', start: '20260803T150000', end: '20260803T160000',
    rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
  })), { from: '2026-08-01', to: '2026-09-30' });
  eq(biweekly.map((e) => e.entry_date),
    ['2026-08-03', '2026-08-17', '2026-08-31', '2026-09-14', '2026-09-28'],
    'INTERVAL=2 skips alternate weeks');

  // COUNT stops the series even when the window is wider.
  const counted = parseIcs(ics(ev({
    summary: 'New student group', start: '20260803T100000', end: '20260803T104500',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3',
  })), { from: '2026-08-01', to: '2026-12-31' });
  eq(counted.length, 3, 'COUNT caps the series');

  // COUNT is counted from DTSTART, not from the window start.
  const countedLate = parseIcs(ics(ev({
    summary: 'Early group', start: '20260601T100000', end: '20260601T104500',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3',
  })), { from: '2026-08-01', to: '2026-12-31' });
  eq(countedLate.length, 0, 'a COUNT series that ended before the window yields nothing');

  // DAILY + EXDATE.
  const daily = parseIcs(ics(ev({
    summary: 'Cafeteria supervision', start: '20260803T113000', end: '20260803T120000',
    rrule: 'FREQ=DAILY;UNTIL=20260807T235959Z', exdate: '20260805T113000',
  })), { from: '2026-08-01', to: '2026-08-31' });
  eq(daily.map((e) => e.entry_date),
    ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'],
    'DAILY expands and EXDATE removes the cancelled day');

  // MONTHLY on the same day-of-month.
  const monthly = parseIcs(ics(ev({
    summary: 'Faculty meeting', start: '20260910T160000', end: '20260910T170000',
    rrule: 'FREQ=MONTHLY',
  })), { from: '2026-09-01', to: '2026-12-31' });
  eq(monthly.map((e) => e.entry_date),
    ['2026-09-10', '2026-11-10', '2026-12-10'],
    'MONTHLY repeats on the same date; Oct 10 2026 is a Saturday so it drops out');
}

console.log('=== 3. Expansion can never run away ===');
{
  // Open-ended weekly rule with NO window: must not hang, must not expand.
  const openEnded = expandRecurrence(
    new Date(2024, 0, 1, 9, 0), 'FREQ=WEEKLY;BYDAY=MO', [], null, null,
  );
  eq(openEnded.occurrences.length, 1, 'unbounded rule yields a single occurrence');
  ok(openEnded.unsupported === true, 'unbounded rule is flagged unsupported, not silently dropped');

  // A daily rule across a 10-year window is capped, not infinite.
  const huge = expandRecurrence(
    new Date(2020, 0, 1, 9, 0), 'FREQ=DAILY', [],
    new Date(2020, 0, 1), new Date(2030, 0, 1),
  );
  ok(huge.occurrences.length > 0 && huge.occurrences.length <= 750, 'daily 10-year expansion hits the cap',
    `got ${huge.occurrences.length}`);

  // Unknown FREQ falls back to one occurrence and says so.
  const weird = expandRecurrence(
    new Date(2026, 7, 3, 9, 0), 'FREQ=SECONDLY', [], new Date(2026, 7, 1), new Date(2026, 7, 31),
  );
  eq(weird.occurrences.length, 1, 'unknown FREQ yields one occurrence');
  ok(weird.unsupported === true, 'unknown FREQ is reported');
}

console.log('=== 4. Pre-existing rules still hold ===');
{
  const doc = ics(
    ev({ summary: 'Saturday makeup', start: '20260808T090000', end: '20260808T100000' }),
    ev({ summary: 'Weekday session', start: '20260806T090000', end: '20260806T100000' }),
  );
  const res = parseIcsDetailed(doc, { from: '2026-08-01', to: '2026-08-31' });
  eq(res.entries.length, 1, 'weekend events are still skipped');
  eq(res.stats.weekend, 1, 'weekend skips are counted');

  const allDay = parseIcsDetailed(ics('SUMMARY:Staff holiday\nDTSTART;VALUE=DATE:20260907\nDTEND;VALUE=DATE:20260908'),
    { from: '2026-08-01', to: '2026-09-30' });
  eq(allDay.entries.length, 0, 'all-day events are still skipped');
  eq(allDay.stats.allDay, 1, 'all-day skips are counted');

  eq(categorizeDomain('Whole Class Lesson — Kindness'), 'guidance', 'whole-class lessons categorize as guidance');
  eq(categorizeDomain('Marcus individual session'), 'responsive', 'individual sessions stay responsive');
  eq(categorizeDomain('Lunch duty'), 'non_counseling', 'lunch duty stays non-counseling');
  eq(categorizeDomain(''), 'system', 'empty title defaults to system');

  eq(parseIcs(''), [], 'empty input is safe');
  eq(parseIcs(null), [], 'null input is safe');
}

console.log('=== 5. Default import window follows the Texas school year ===');
{
  eq(defaultImportWindow(new Date(2026, 7, 30)), { from: '2026-08-01', to: '2026-08-30' }, 'August lands in the new year');
  eq(defaultImportWindow(new Date(2027, 2, 15)), { from: '2026-08-01', to: '2027-03-15' }, 'March looks back to last August');
  eq(defaultImportWindow(new Date(2026, 6, 31)), { from: '2025-08-01', to: '2026-07-31' }, 'July still belongs to the prior year');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
