/**
 * Beacon Native Notifications — entirely on-device.
 *
 * Strategy (v1, no Notification Triggers API which has poor support):
 *   - Counselor enables alerts in Settings (one-time browser permission prompt).
 *   - On every Dashboard / Schedule load, scheduleUpcoming() walks the next 24h
 *     of sessions + follow-ups and fires browser notifications for events that
 *     fall inside the configured lead-time window.
 *   - A polling interval (60s) re-checks while the PWA is open. If the page is
 *     installed as a PWA (standalone), notifications fire even when minimized.
 *   - When the page is closed, notifications stop firing — same as Google
 *     Calendar's web-only mode. iOS PWA installs preserve this when added to
 *     home screen.
 *   - For desktop / persistent reminders, the ICS feed (calendarExport.js) is
 *     the secondary path: counselor subscribes / imports into Google or Apple
 *     Calendar which handles its own native push.
 *
 * No data leaves the device. No push server. No subscriptions.
 */

import { db } from './db';

const SETTINGS_KEY = 'notification_prefs';

const DEFAULTS = {
  enabled: false,
  leadMinutes: 5,
  dailyBriefAt: '07:30', // not used in v1 alerts; reserved for Morning Brief feature
  // 3:30 PM end-of-school nudge: "Log today's time" if no time entry yet today.
  // Defaults on so the naysayer's "you'll forget by week 4" cliff stops the
  // 80/20 ring from going fictional.
  timeLogNudgeEnabled: true,
  timeLogNudgeAt: '15:30',
};

export async function getNotificationPrefs() {
  const { data } = await db.select('settings', { eq: { key: SETTINGS_KEY } });
  const stored = data?.[0]?.value;
  return { ...DEFAULTS, ...(stored || {}) };
}

export async function setNotificationPrefs(updates) {
  const current = await getNotificationPrefs();
  const merged = { ...current, ...updates };
  // settings store is keyPath:'key', upsert pattern
  const existing = (await db.select('settings', { eq: { key: SETTINGS_KEY } })).data?.[0];
  if (existing) {
    await db.update('settings', SETTINGS_KEY, { value: merged });
  } else {
    await db.insert('settings', { key: SETTINGS_KEY, value: merged });
  }
  return merged;
}

export function isNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPermissionState() {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!isNotificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Fire a notification via the active service worker (preferred — works when
 * the tab is hidden) or fall back to the Notification constructor.
 */
async function fireNotification({ title, body, url, tag }) {
  if (!isNotificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg?.active) {
      reg.active.postMessage({ type: 'BEACON_NOTIFY', title, body, url, tag });
      return;
    }
  } catch {
    // fall through to direct
  }
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag, data: { url } });
  } catch {
    // permission may have been revoked — silently skip
  }
}

/**
 * In-memory dedupe set so a 60-second poll doesn't re-fire the same alert.
 * Cleared on page reload — that's fine; reload is rare and reload-fire is
 * preferable to silence after a refresh.
 */
const fired = new Set();

const TIME_NUDGE_DISMISS_KEY = 'beacon_time_nudge_last_fired'; // YYYY-MM-DD

/**
 * 3:30 PM "log today's time" nudge. Fires once per day when:
 *   - prefs.timeLogNudgeEnabled (default true)
 *   - local time has crossed prefs.timeLogNudgeAt (default 15:30)
 *   - no time_entry exists for the counselor for today
 *   - we have not already fired the nudge for this date
 */
async function maybeFireTimeLogNudge(counselorId, prefs) {
  if (!prefs.timeLogNudgeEnabled) return;
  const todayIso = new Date().toISOString().slice(0, 10);
  const lastFired = localStorage.getItem(TIME_NUDGE_DISMISS_KEY);
  if (lastFired === todayIso) return;

  const [hh, mm] = (prefs.timeLogNudgeAt || '15:30').split(':').map(Number);
  const now = new Date();
  const trigger = new Date(now);
  trigger.setHours(hh || 15, mm || 30, 0, 0);
  if (now < trigger) return;

  // Only nudge if no time entry yet today
  const { data } = await db.select('time_entries', {
    eq: { counselor_id: counselorId, entry_date: todayIso },
    select: 'id',
  });
  if ((data || []).length > 0) return;

  // Mark fired BEFORE notifying so a poll race can't double-fire
  localStorage.setItem(TIME_NUDGE_DISMISS_KEY, todayIso);
  await fireNotification({
    title: 'Log today\'s time',
    body: 'Two clicks on the dashboard keeps your 80/20 ring honest.',
    url: '/',
    tag: `time-nudge:${todayIso}`,
  });
}

/**
 * Walk upcoming sessions + follow-ups in the next 24h. Fire any whose
 * scheduled time falls inside the lead-time window (now → now + leadMinutes).
 * Safe to call repeatedly.
 */
export async function scheduleUpcomingAlerts(counselorId) {
  if (!counselorId) return;
  const prefs = await getNotificationPrefs();
  if (!prefs.enabled || Notification.permission !== 'granted') return;

  // Daily 3:30 PM time-log nudge — runs alongside the upcoming-event scan.
  await maybeFireTimeLogNudge(counselorId, prefs);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  // Sessions today + tomorrow
  const { data: sessions } = await db.select('sessions', {
    eq: { counselor_id: counselorId },
    gte: { session_date: todayIso },
    lte: { session_date: tomorrowIso },
  });

  for (const s of sessions || []) {
    if (s.status === 'Cancelled' || s.status === 'Completed') continue;
    const startIso = `${s.session_date}T${(s.start_time || '00:00:00').slice(0, 8)}`;
    const start = new Date(startIso);
    if (isNaN(start.getTime())) continue;
    const minsAway = (start - now) / 60000;
    if (minsAway > 0 && minsAway <= prefs.leadMinutes) {
      const key = `session:${s.id}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const minsLabel = Math.max(1, Math.round(minsAway));
      await fireNotification({
        title: `Session in ${minsLabel} min`,
        body: `${(s.start_time || '').slice(0, 5)} - ${(s.end_time || '').slice(0, 5)}`,
        url: '/schedule',
        tag: key,
      });
    }
  }

  // Follow-ups due in the window
  const { data: followUps } = await db.select('follow_ups', {
    eq: { counselor_id: counselorId, status: 'pending' },
  });
  for (const f of followUps || []) {
    if (!f.due_at) continue;
    const due = new Date(f.due_at);
    if (isNaN(due.getTime())) continue;
    const minsAway = (due - now) / 60000;
    // Fire within lead window OR if already overdue (caught up after sleep/close)
    if ((minsAway > 0 && minsAway <= prefs.leadMinutes) || (minsAway <= 0 && minsAway >= -60)) {
      const key = `followup:${f.id}`;
      if (fired.has(key)) continue;
      fired.add(key);
      await fireNotification({
        title: f.title || 'Follow-up due',
        body: f.body || '',
        url: f.target_url || '/',
        tag: key,
      });
    }
  }
}

let pollHandle = null;

/** Start the in-app poll. Idempotent — calling twice is a no-op. */
export function startNotificationPoll(counselorId) {
  if (pollHandle) return;
  scheduleUpcomingAlerts(counselorId);
  pollHandle = setInterval(() => scheduleUpcomingAlerts(counselorId), 60_000);
  // Re-check on tab focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleUpcomingAlerts(counselorId);
  });
}

export function stopNotificationPoll() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}
