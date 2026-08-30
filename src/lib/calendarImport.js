/**
 * Beacon Calendar Import — Parse ICS files and auto-create time entries.
 *
 * Keyword-based domain categorization:
 * - 'counseling', 'session', 'individual', 'group', 'check-in' -> responsive
 * - 'lesson', 'guidance', 'classroom', 'class visit' -> guidance
 * - 'planning', 'goal', 'IEP', 'ARD', 'RTI', 'MTSS' -> planning
 * - 'meeting', 'PLC', 'staff', 'training', 'PD' -> system
 * - 'lunch', 'duty', 'testing', 'carpool', 'bus', 'recess', 'supervision' -> non_counseling
 * - Default (no keyword match) -> system
 *
 * Google Calendar's export has no date-range option — it hands you every event
 * you have ever had. Callers pass a { from, to } window so the counselor imports
 * one school year instead of a decade. The window also bounds RRULE expansion:
 * a recurring VEVENT is a single block in the file, so without expansion a weekly
 * duty would import as ONE entry and silently understate non-counseling time.
 */

const DOMAIN_KEYWORDS = [
  { domain: 'responsive', keywords: ['counseling', 'session', 'individual', 'group', 'check-in', 'checkin', 'check in'] },
  { domain: 'guidance', keywords: ['lesson', 'guidance', 'classroom', 'class visit'] },
  { domain: 'planning', keywords: ['planning', 'goal', 'iep', 'ard', 'rti', 'mtss'] },
  { domain: 'system', keywords: ['meeting', 'plc', 'staff', 'training', 'pd'] },
  { domain: 'non_counseling', keywords: ['lunch', 'duty', 'testing', 'carpool', 'bus', 'recess', 'supervision'] },
];

/** Hard ceiling on candidate dates examined per recurring event (runaway guard). */
const MAX_EXPANSION_STEPS = 4000;
/** Hard ceiling on occurrences produced by a single recurring event. */
const MAX_OCCURRENCES_PER_EVENT = 750;

/**
 * Categorize an event title into a time-tracking domain.
 */
export function categorizeDomain(title) {
  if (!title) return 'system';
  const lower = title.toLowerCase();
  for (const { domain, keywords } of DOMAIN_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return domain;
    }
  }
  return 'system';
}

/**
 * Parse an ICS datetime string (e.g. "20260315T093000" or "20260315T093000Z")
 * into a JS Date. Returns null for date-only values (all-day events).
 */
function parseIcsDateTime(str) {
  if (!str) return null;
  // Strip TZID prefix if present (e.g. "TZID=America/Chicago:20260315T093000")
  const colonIdx = str.lastIndexOf(':');
  const raw = colonIdx > 0 && !str.startsWith('http') ? str.slice(colonIdx + 1) : str;

  // Date-only (no 'T') = all-day event
  if (!raw.includes('T')) return null;

  const clean = raw.replace(/Z$/, '');
  if (clean.length < 15) return null;

  const year = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(4, 6), 10) - 1;
  const day = parseInt(clean.slice(6, 8), 10);
  const hour = parseInt(clean.slice(9, 11), 10);
  const min = parseInt(clean.slice(11, 13), 10);
  const sec = parseInt(clean.slice(13, 15), 10);

  if (raw.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
  return new Date(year, month, day, hour, min, sec);
}

/** UNTIL and EXDATE are often date-only (e.g. "20260601"). Treat as end-of-day, local. */
function parseIcsDateOnly(str) {
  if (!str) return null;
  const raw = str.slice(str.lastIndexOf(':') + 1).replace(/Z$/, '');
  if (raw.length < 8) return null;
  const d = new Date(
    parseInt(raw.slice(0, 4), 10),
    parseInt(raw.slice(4, 6), 10) - 1,
    parseInt(raw.slice(6, 8), 10),
    23, 59, 59,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local yyyy-mm-dd for a Date. */
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a yyyy-mm-dd string into a local Date at midnight. Returns null if unusable. */
function parseIsoDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Unfold ICS content lines (lines that start with a space or tab are continuations).
 */
function unfoldIcs(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

const ICS_DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Parse an RRULE value into a plain object. Returns null if there is no FREQ. */
function parseRrule(value) {
  if (!value) return null;
  const parts = {};
  for (const chunk of value.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq < 0) continue;
    parts[chunk.slice(0, eq).trim().toUpperCase()] = chunk.slice(eq + 1).trim();
  }
  if (!parts.FREQ) return null;

  const interval = parseInt(parts.INTERVAL, 10);
  const count = parseInt(parts.COUNT, 10);

  return {
    freq: parts.FREQ.toUpperCase(),
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    count: Number.isFinite(count) && count > 0 ? count : null,
    until: parts.UNTIL ? (parseIcsDateTime(parts.UNTIL) || parseIcsDateOnly(parts.UNTIL)) : null,
    byDay: parts.BYDAY
      ? parts.BYDAY.split(',')
        // Strip an ordinal prefix (e.g. "2FR" = 2nd Friday) — we honour the weekday,
        // not the ordinal, which over-produces rather than dropping the series entirely.
        .map((d) => ICS_DAY_CODES[d.trim().toUpperCase().slice(-2)])
        .filter((n) => n !== undefined)
      : null,
  };
}

/** Days since the epoch for a local Date (calendar days, DST-safe). */
function dayNumber(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** Week index using WKST=MO (the RFC 5545 default), so INTERVAL>1 counts real weeks. */
function weekNumber(d) {
  const mondayOffset = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  return Math.floor((dayNumber(d) - mondayOffset) / 7);
}

/**
 * Expand a recurring event into the start Date of every occurrence falling
 * inside [windowStart, windowEnd]. Non-recurring events yield [start].
 *
 * Only FREQ=DAILY/WEEKLY/MONTHLY/YEARLY are expanded. Anything else yields the
 * single DTSTART occurrence and is reported as unsupported rather than hidden.
 *
 * @returns {{ occurrences: Date[], expanded: boolean, unsupported: boolean }}
 */
export function expandRecurrence(start, rrule, exdates, windowStart, windowEnd) {
  const inWindow = (d) => (!windowStart || d >= windowStart) && (!windowEnd || d <= windowEnd);
  const single = () => (inWindow(start) ? [start] : []);

  if (!rrule) return { occurrences: single(), expanded: false, unsupported: false };

  const rule = typeof rrule === 'string' ? parseRrule(rrule) : rrule;
  if (!rule) return { occurrences: single(), expanded: false, unsupported: false };
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) {
    return { occurrences: single(), expanded: false, unsupported: true };
  }
  // Expansion is only safe when something bounds it — an open-ended weekly rule
  // with no UNTIL, no COUNT and no import window would run forever.
  if (!windowEnd && !rule.until && !rule.count) {
    return { occurrences: single(), expanded: false, unsupported: true };
  }

  const excluded = new Set((exdates || []).map((d) => isoDate(d)));
  const bounds = [windowEnd, rule.until].filter(Boolean).sort((a, b) => a - b);
  const hardEnd = bounds.length ? bounds[0] : null;

  const startDay = dayNumber(start);
  const startWeek = weekNumber(start);
  const occurrences = [];
  let emittedFromSeriesStart = 0; // COUNT counts from DTSTART, not from the window
  let steps = 0;

  // With COUNT we must walk from DTSTART to know where the series ends; without
  // it we can skip straight to the window and save the iterations.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (!rule.count && windowStart && windowStart > cursor) {
    cursor.setFullYear(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate());
  }

  while (steps < MAX_EXPANSION_STEPS && occurrences.length < MAX_OCCURRENCES_PER_EVENT) {
    steps++;
    if (hardEnd && cursor > hardEnd) break;
    if (rule.count && emittedFromSeriesStart >= rule.count) break;

    let matches = false;
    if (dayNumber(cursor) >= startDay) {
      if (rule.freq === 'DAILY') {
        matches = (dayNumber(cursor) - startDay) % rule.interval === 0;
      } else if (rule.freq === 'WEEKLY') {
        const onDay = rule.byDay && rule.byDay.length
          ? rule.byDay.includes(cursor.getDay())
          : cursor.getDay() === start.getDay();
        matches = onDay && (weekNumber(cursor) - startWeek) % rule.interval === 0;
      } else if (rule.freq === 'MONTHLY') {
        const monthDiff = (cursor.getFullYear() - start.getFullYear()) * 12 + (cursor.getMonth() - start.getMonth());
        matches = cursor.getDate() === start.getDate() && monthDiff % rule.interval === 0;
      } else if (rule.freq === 'YEARLY') {
        const yearDiff = cursor.getFullYear() - start.getFullYear();
        matches = cursor.getMonth() === start.getMonth()
          && cursor.getDate() === start.getDate()
          && yearDiff % rule.interval === 0;
      }
    }

    if (matches) {
      emittedFromSeriesStart++;
      const occ = new Date(cursor);
      occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
      if (!excluded.has(isoDate(occ)) && inWindow(occ)) occurrences.push(occ);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { occurrences, expanded: true, unsupported: false };
}

/**
 * Parse an ICS string and return time entry objects.
 *
 * @param {string} icsString - The raw ICS file content
 * @param {{ from?: string, to?: string }} [options] - yyyy-mm-dd window. Events
 *   outside it are dropped; recurring events are expanded inside it.
 * @returns {Array<{ entry_date, domain, activity_description, duration_minutes, source, start_time, end_time }>}
 */
export function parseIcs(icsString, options = {}) {
  return parseIcsDetailed(icsString, options).entries;
}

/**
 * Same as parseIcs but also reports what was dropped, so the UI can say so out
 * loud instead of quietly importing a subset.
 *
 * @returns {{ entries: Array, stats: { totalEvents, outOfRange, allDay, weekend, recurringExpanded, recurringUnsupported } }}
 */
export function parseIcsDetailed(icsString, options = {}) {
  const stats = {
    totalEvents: 0, outOfRange: 0, allDay: 0, weekend: 0,
    recurringExpanded: 0, recurringUnsupported: 0,
  };
  if (!icsString) return { entries: [], stats };

  const windowStart = parseIsoDate(options.from);
  const windowEndDay = parseIsoDate(options.to);
  const windowEnd = windowEndDay
    ? new Date(windowEndDay.getFullYear(), windowEndDay.getMonth(), windowEndDay.getDate(), 23, 59, 59)
    : null;

  const unfolded = unfoldIcs(icsString);
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      events.push(current);
      continue;
    }
    if (!inEvent) continue;

    // Parse property:value (handle properties with params like DTSTART;TZID=...)
    const sepIdx = line.indexOf(':');
    if (sepIdx < 0) continue;
    const propFull = line.slice(0, sepIdx);
    const value = line.slice(sepIdx + 1);
    const propName = propFull.split(';')[0].toUpperCase();

    if (propName === 'SUMMARY') current.summary = value;
    else if (propName === 'DESCRIPTION') current.description = value;
    else if (propName === 'DTSTART') current.dtstart = propFull.includes(';') ? propFull.split(';').slice(1).join(';') + ':' + value : value;
    else if (propName === 'DTEND') current.dtend = propFull.includes(';') ? propFull.split(';').slice(1).join(';') + ':' + value : value;
    else if (propName === 'RRULE') current.rrule = value;
    else if (propName === 'EXDATE') current.exdates = (current.exdates || []).concat(value.split(','));
  }

  const results = [];

  for (const evt of events) {
    stats.totalEvents++;
    const start = parseIcsDateTime(evt.dtstart);
    const end = parseIcsDateTime(evt.dtend);

    // Skip all-day events (no time component)
    if (!start || !end) { stats.allDay++; continue; }

    // Duration is computed once — every occurrence of a series shares it
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (durationMinutes <= 0) continue;

    const exdates = (evt.exdates || [])
      .map((raw) => parseIcsDateTime(raw) || parseIcsDateOnly(raw))
      .filter(Boolean);

    const { occurrences, expanded, unsupported } = expandRecurrence(
      start, evt.rrule, exdates, windowStart, windowEnd,
    );
    if (expanded && occurrences.length > 1) stats.recurringExpanded++;
    if (unsupported) stats.recurringUnsupported++;

    if (occurrences.length === 0) {
      // Nothing landed in the window — outside the range, or a series that ended
      // before it. Either way the counselor asked not to see it.
      if (windowStart || windowEnd) stats.outOfRange++;
      continue;
    }

    const title = (evt.summary || '').replace(/\\n/g, ' ').replace(/\\,/g, ',').trim();
    const domain = categorizeDomain(title);
    const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    for (const occStart of occurrences) {
      // Skip weekends (0=Sun, 6=Sat) — counselors log school-day time
      const dow = occStart.getDay();
      if (dow === 0 || dow === 6) { stats.weekend++; continue; }

      const occEnd = new Date(occStart.getTime() + durationMinutes * 60000);
      results.push({
        entry_date: isoDate(occStart),
        domain,
        activity_description: title || 'Calendar event',
        duration_minutes: durationMinutes,
        source: 'calendar',
        start_time: fmtTime(occStart),
        end_time: fmtTime(occEnd),
      });
    }
  }

  // Sort by date then start time
  results.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.start_time.localeCompare(b.start_time));

  return { entries: results, stats };
}

/**
 * The school year containing (or most recently started before) `today`, as a
 * yyyy-mm-dd pair. Texas school years start in August.
 */
export function defaultImportWindow(today = new Date()) {
  const y = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${y}-08-01`, to: isoDate(today) };
}
