import { db } from './db';

/**
 * Auto-log a time entry when a session is marked Completed.
 * Deduplicates by checking source_id to avoid double entries.
 */
export async function autoLogTime({ counselorId, sessionId, date, durationMinutes, description }) {
  // Check if auto-entry already exists for this session
  const { data: existing } = await db.select('time_entries', {
    eq: { source: 'auto_session', source_id: sessionId },
    limit: 1,
  });

  if (existing?.length) return; // Already logged

  return db.insert('time_entries', {
    counselor_id: counselorId,
    entry_date: date,
    domain: 'responsive',
    activity_description: description,
    duration_minutes: durationMinutes,
    source: 'auto_session',
    source_id: sessionId,
  });
}
