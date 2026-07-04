/**
 * Morning Brief — the zoomed-out executive view of the counselor's day + week.
 *
 * Aggregates from local IndexedDB. Pure function (caller passes data in).
 * Returns a structured object the UI renders as a card. No AI required for v1
 * — the dashboard's "My Day" already covers the granular view.
 *
 * Brief is dismissed for the day after the counselor reads it. Reappears
 * every morning at first dashboard load.
 */

import { db } from './db';
import { getNextCrestDeadline, overallProgress } from './crestData';
import { getLicenseKey, getLicenseDaysLeft } from './license';
import { format, startOfWeek, endOfWeek } from 'date-fns';

const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
const SB179_TARGET_PCT = 80;
const TRIAL_DAYS = 14;

const SETTINGS_KEY = 'morning_brief_dismissed';

export async function isBriefDismissedToday() {
  const { data } = await db.select('settings', { eq: { key: SETTINGS_KEY } });
  const dismissed = data?.[0]?.value;
  if (!dismissed) return false;
  return dismissed === todayIso();
}

export async function dismissBriefToday() {
  const today = todayIso();
  const existing = (await db.select('settings', { eq: { key: SETTINGS_KEY } })).data?.[0];
  if (existing) {
    await db.update('settings', SETTINGS_KEY, { value: today });
  } else {
    await db.insert('settings', { key: SETTINGS_KEY, value: today });
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build the brief for a given counselor as of `now`.
 * Returns:
 *   {
 *     greeting: string,
 *     today: { sessionCount, blockCount, firstSessionTime|null, openFollowUps },
 *     thisWeek: { sb179: { hoursLogged, hoursToTarget, pct }, scheduledSessions, openReferrals },
 *     deadlines: [{ label, daysUntil, severity }]   // CREST + custom
 *     signals: [string]                              // 0-3 short bullets
 *   }
 */
export async function buildMorningBrief(counselorId, now = new Date()) {
  if (!counselorId) return null;
  const today = format(now, 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const todayDow = now.getDay(); // 0=Sun..6=Sat

  const [
    sessionsTodayRes,
    sessionsWeekRes,
    blocksRes,
    followUpsRes,
    referralsRes,
    timeEntriesRes,
    crestRes,
  ] = await Promise.all([
    db.select('sessions', {
      eq: { counselor_id: counselorId },
      gte: { session_date: today },
      lte: { session_date: today },
    }),
    db.select('sessions', {
      eq: { counselor_id: counselorId },
      gte: { session_date: weekStart },
      lte: { session_date: weekEnd },
    }),
    db.select('campus_schedule_blocks', { eq: { counselor_id: counselorId } }),
    db.select('follow_ups', { eq: { counselor_id: counselorId, status: 'pending' } }),
    db.select('referrals', { eq: { counselor_id: counselorId, status: 'open' } }),
    db.select('time_entries', {
      eq: { counselor_id: counselorId },
      gte: { entry_date: weekStart },
      lte: { entry_date: weekEnd },
    }),
    db.select('crest_artifacts', { eq: { counselor_id: counselorId } }),
  ]);

  const sessionsToday = (sessionsTodayRes.data || []).filter((s) => s.status !== 'Cancelled');
  const blocksToday = (blocksRes.data || []).filter((b) => b.day_of_week === todayDow);
  const firstSession = sessionsToday
    .filter((s) => s.start_time)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))[0];

  // Follow-ups due today + this week
  const followUps = followUpsRes.data || [];
  const followUpsToday = followUps.filter((f) => {
    if (!f.due_at) return false;
    return f.due_at.slice(0, 10) === today;
  });
  const followUpsOverdue = followUps.filter((f) => {
    if (!f.due_at) return false;
    return f.due_at.slice(0, 10) < today;
  });

  // SB 179 this-week pct + delta-to-target
  const entries = timeEntriesRes.data || [];
  const totalMin = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const counselingMin = entries
    .filter((e) => COUNSELING_DOMAINS.includes(e.domain))
    .reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const pct = totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : 0;
  const hoursLogged = Math.round((totalMin / 60) * 10) / 10;
  // Hours of pure counseling needed to *raise* this week's pct to 80% (assumes
  // non-counseling stays fixed). If already over, returns 0.
  const nonCounselingMin = totalMin - counselingMin;
  const targetCounselingMin = (SB179_TARGET_PCT / (100 - SB179_TARGET_PCT)) * nonCounselingMin;
  const minToTarget = Math.max(0, targetCounselingMin - counselingMin);
  const hoursToTarget = Math.round((minToTarget / 60) * 10) / 10;

  // CREST deadline
  const deadline = getNextCrestDeadline(now);
  const crestPct = overallProgress(crestRes.data || []).pct;

  const deadlines = [];

  // Trial / license runway — surface it here BEFORE the hard banners kick in
  // (trial banner starts at 4 days, soft gate at 0). The brief starts the
  // conversation at day 7 so expiry is never a surprise.
  const { data: counselorRow } = await db.selectById('counselor', counselorId);
  if (!getLicenseKey() && counselorRow?.subscription_status === 'trial' && counselorRow?.trial_started_at) {
    const trialEnd = new Date(counselorRow.trial_started_at);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / 86400000));
    if (trialDaysLeft > 0 && trialDaysLeft <= 7) {
      deadlines.push({
        label: 'Free trial ends — activate a license in Settings to keep logging',
        daysUntil: trialDaysLeft,
        severity: trialDaysLeft <= 3 ? 'red' : 'amber',
      });
    }
  }
  const licenseDaysLeft = getLicenseDaysLeft();
  if (licenseDaysLeft !== null && licenseDaysLeft > 0 && licenseDaysLeft <= 30) {
    deadlines.push({
      label: 'Beacon license renewal (your key stays the same)',
      daysUntil: licenseDaysLeft,
      severity: licenseDaysLeft <= 7 ? 'red' : licenseDaysLeft <= 14 ? 'amber' : 'info',
    });
  }

  if (deadline.daysUntil <= 60) {
    deadlines.push({
      label: `CREST submission (currently ${crestPct}% complete)`,
      daysUntil: deadline.daysUntil,
      severity: deadline.daysUntil <= 14 ? 'red' : deadline.daysUntil <= 30 ? 'amber' : 'info',
    });
  }
  if (followUpsOverdue.length > 0) {
    deadlines.push({
      label: `${followUpsOverdue.length} overdue follow-up${followUpsOverdue.length === 1 ? '' : 's'}`,
      daysUntil: 0,
      severity: 'red',
    });
  }

  // Soft signals — short bullets
  const signals = [];
  if (pct > 0 && pct < SB179_TARGET_PCT) {
    signals.push(`SB 179 this week is ${pct}% — about ${hoursToTarget} more counseling hours hits 80%.`);
  }
  if ((referralsRes.data || []).length >= 5) {
    signals.push(`${(referralsRes.data || []).length} open referrals waiting for triage.`);
  }
  if (followUpsToday.length > 0) {
    signals.push(`${followUpsToday.length} follow-up${followUpsToday.length === 1 ? '' : 's'} due today — top: ${followUpsToday[0].title}.`);
  }
  if (sessionsToday.length === 0 && blocksToday.length === 0) {
    signals.push('No sessions or recurring blocks on the calendar today — open block to use for catch-up?');
  }

  // Greeting
  const hour = now.getHours();
  const dayName = format(now, 'EEEE');
  const greeting = hour < 12 ? `Good morning` : hour < 17 ? `Good afternoon` : `Good evening`;

  return {
    greeting: `${greeting}. Here's your ${dayName}.`,
    today: {
      sessionCount: sessionsToday.length,
      blockCount: blocksToday.length,
      firstSessionTime: firstSession?.start_time?.slice(0, 5) || null,
      openFollowUps: followUpsToday.length + followUpsOverdue.length,
    },
    thisWeek: {
      sb179: { pct, hoursLogged, hoursToTarget },
      scheduledSessions: (sessionsWeekRes.data || []).filter((s) => s.status !== 'Cancelled').length,
      openReferrals: (referralsRes.data || []).length,
    },
    deadlines,
    signals: signals.slice(0, 3),
  };
}
