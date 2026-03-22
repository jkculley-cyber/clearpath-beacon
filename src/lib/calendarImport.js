/**
 * Beacon Calendar Import — Parse ICS files and auto-create time entries.
 *
 * Keyword-based domain categorization:
 * - 'counseling', 'session', 'individual', 'group', 'check-in' -> responsive
 * - 'lesson', 'guidance', 'classroom', 'class visit' -> guidance
 * - 'planning', 'goal', 'IEP', 'ARD', 'RTI', 'MTSS' -> planning
 * - 'meeting', 'PLC', 'staff', 'training', 'PD' -> system_support
 * - 'lunch', 'duty', 'testing', 'carpool', 'bus', 'recess', 'supervision' -> non_counseling
 * - Default (no keyword match) -> system_support
 */

const DOMAIN_KEYWORDS = [
  { domain: 'responsive', keywords: ['counseling', 'session', 'individual', 'group', 'check-in', 'checkin', 'check in'] },
  { domain: 'guidance', keywords: ['lesson', 'guidance', 'classroom', 'class visit'] },
  { domain: 'planning', keywords: ['planning', 'goal', 'iep', 'ard', 'rti', 'mtss'] },
  { domain: 'system_support', keywords: ['meeting', 'plc', 'staff', 'training', 'pd'] },
  { domain: 'non_counseling', keywords: ['lunch', 'duty', 'testing', 'carpool', 'bus', 'recess', 'supervision'] },
];

/**
 * Categorize an event title into a time-tracking domain.
 */
export function categorizeDomain(title) {
  if (!title) return 'system_support';
  const lower = title.toLowerCase();
  for (const { domain, keywords } of DOMAIN_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return domain;
    }
  }
  return 'system_support';
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

/**
 * Unfold ICS content lines (lines that start with a space or tab are continuations).
 */
function unfoldIcs(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Parse an ICS string and return an array of time entry objects.
 *
 * @param {string} icsString - The raw ICS file content
 * @returns {Array<{ entry_date: string, domain: string, activity_description: string, duration_minutes: number, source: string, start_time: string, end_time: string }>}
 */
export function parseIcs(icsString) {
  if (!icsString) return [];

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
  }

  const results = [];

  for (const evt of events) {
    const start = parseIcsDateTime(evt.dtstart);
    const end = parseIcsDateTime(evt.dtend);

    // Skip all-day events (no time component)
    if (!start || !end) continue;

    // Skip weekends (0=Sun, 6=Sat)
    const dayOfWeek = start.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Calculate duration
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    if (durationMinutes <= 0) continue;

    const title = (evt.summary || '').replace(/\\n/g, ' ').replace(/\\,/g, ',').trim();
    const domain = categorizeDomain(title);
    const entryDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

    const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    results.push({
      entry_date: entryDate,
      domain,
      activity_description: title || 'Calendar event',
      duration_minutes: durationMinutes,
      source: 'calendar',
      start_time: fmtTime(start),
      end_time: fmtTime(end),
    });
  }

  // Sort by date then start time
  results.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.start_time.localeCompare(b.start_time));

  return results;
}
