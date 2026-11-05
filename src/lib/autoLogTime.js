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

/**
 * Remove the auto-logged time entry for a session.
 * Called when a session moves Completed → Cancelled / Make-up Needed / Scheduled,
 * or when the session is deleted.
 */
export async function removeAutoLoggedTime(sessionId, source = 'auto_session') {
  if (!sessionId) return;
  const { data: existing } = await db.select('time_entries', {
    eq: { source, source_id: sessionId },
    limit: 1,
  });
  if (!existing?.length) return;
  await db.del('time_entries', existing[0].id);
}

/**
 * Upsert the time entry for a completed schedule event (whole class lesson,
 * duty, meeting, …). Unlike sessions, the domain varies by event, and the
 * counselor can re-save a completed event with a new duration or domain — so
 * an existing entry is updated in place rather than skipped.
 */
export async function autoLogEventTime({ counselorId, eventId, date, durationMinutes, domain, description }) {
  const { data: existing } = await db.select('time_entries', {
    eq: { source: 'auto_event', source_id: eventId },
    limit: 1,
  });
  const fields = {
    entry_date: date,
    domain,
    activity_description: description,
    duration_minutes: durationMinutes,
  };
  if (existing?.length) return db.update('time_entries', existing[0].id, fields);
  return db.insert('time_entries', {
    counselor_id: counselorId,
    ...fields,
    source: 'auto_event',
    source_id: eventId,
  });
}
