import { supabase } from './supabase';

/**
 * Auto-log a time entry when a session is marked Completed.
 * Deduplicates by checking source_id to avoid double entries.
 */
export async function autoLogTime({ counselorId, sessionId, date, durationMinutes, description }) {
  // Check if auto-entry already exists for this session
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('source', 'auto_session')
    .eq('source_id', sessionId)
    .limit(1);

  if (existing?.length) return; // Already logged

  return supabase.from('time_entries').insert({
    counselor_id: counselorId,
    entry_date: date,
    domain: 'responsive',
    activity_description: description,
    duration_minutes: durationMinutes,
    source: 'auto_session',
    source_id: sessionId,
  });
}
