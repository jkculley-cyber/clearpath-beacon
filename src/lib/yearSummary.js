/**
 * Year-end summary snapshots — the memory that makes Beacon a multi-year
 * system of record instead of a tool that wipes itself every June.
 *
 * A summary is computed from live data at School Year Transition time and
 * persisted to the `settings` store under `year_summary_<label>`. Settings
 * is license-exempt in db.js, so snapshots work for trial and soft-gated
 * counselors too (protective features gate on "has data," not "has paid").
 *
 * Consumers:
 *  - SettingsPage transition flow (writes the snapshot before mutating)
 *  - ReportsPage Year-over-Year section (reads all snapshots + live year)
 */

import { db } from './db';

const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
const KEY_PREFIX = 'year_summary_';

/**
 * School-year window for a counselor. Uses the Settings school-year dates
 * when present; falls back to Aug 1 – Jul 31 around `now`.
 */
export function schoolYearWindow(counselor, now = new Date()) {
  if (counselor?.school_year_start && counselor?.school_year_end) {
    return { start: counselor.school_year_start, end: counselor.school_year_end };
  }
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-08-01`, end: `${y + 1}-07-31` };
}

/** "2025–26" style label from a window's start date. */
export function schoolYearLabel(startIso) {
  const y = parseInt(startIso.slice(0, 4), 10);
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
}

/**
 * Compute the summary for a date window from live data.
 * All counts are within [start, end] except caseload, which is "as of now."
 */
export async function computeYearSummary(counselorId, { start, end }) {
  const [studentsRes, sessionsRes, timeRes, referralsRes, commsRes, groupsRes] = await Promise.all([
    db.select('students', { eq: { counselor_id: counselorId } }),
    db.select('sessions', { eq: { counselor_id: counselorId }, gte: { session_date: start }, lte: { session_date: end } }),
    db.select('time_entries', { eq: { counselor_id: counselorId }, gte: { entry_date: start }, lte: { entry_date: end } }),
    db.select('referrals', { eq: { counselor_id: counselorId } }),
    db.select('communications', { eq: { counselor_id: counselorId }, gte: { contact_date: start }, lte: { contact_date: end } }),
    db.select('groups', { eq: { counselor_id: counselorId } }),
  ]);

  const students = (studentsRes.data || []).filter((s) => s.status === 'active' || s.status === 'graduated');
  const tierOf = (t) => students.filter((s) => Number(s.tier) === t).length;

  const sessions = (sessionsRes.data || []).filter((s) => s.status !== 'Cancelled');
  const completed = sessions.filter((s) => s.status === 'Completed');
  const sessionMinutes = completed.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  const entries = timeRes.data || [];
  const totalMin = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const counselingMin = entries
    .filter((e) => COUNSELING_DOMAINS.includes(e.domain))
    .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const sb179Pct = totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : null;

  // Referrals lack a reliable in-window date on every record shape; count by
  // created_at when present, else include (older records predate created_at).
  const referrals = (referralsRes.data || []).filter((r) => {
    const d = (r.created_at || '').slice(0, 10);
    return !d || (d >= start && d <= end);
  });

  const groups = (groupsRes.data || []).filter((g) => g.status !== 'archived');

  return {
    label: schoolYearLabel(start),
    window: { start, end },
    students_served: students.length,
    tier1: tierOf(1),
    tier2: tierOf(2),
    tier3: tierOf(3),
    sessions_completed: completed.length,
    session_hours: Math.round((sessionMinutes / 60) * 10) / 10,
    sb179_pct: sb179Pct,
    referrals_received: referrals.length,
    contacts_logged: (commsRes.data || []).length,
    groups_run: groups.length,
    snapshot_at: new Date().toISOString(),
  };
}

/** Persist a summary. Overwrites an existing snapshot for the same label
 *  (re-running a transition refreshes rather than duplicates). */
export async function saveYearSummary(summary) {
  const key = KEY_PREFIX + summary.label;
  const existing = (await db.select('settings', { eq: { key } })).data?.[0];
  const value = JSON.stringify(summary);
  if (existing) {
    await db.update('settings', key, { value });
  } else {
    await db.insert('settings', { key, value });
  }
}

/** All saved snapshots, oldest first. */
export async function listYearSummaries() {
  const { data } = await db.select('settings', {});
  return (data || [])
    .filter((row) => typeof row.key === 'string' && row.key.startsWith(KEY_PREFIX))
    .map((row) => {
      try { return JSON.parse(row.value); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (a.window?.start || '').localeCompare(b.window?.start || ''));
}
