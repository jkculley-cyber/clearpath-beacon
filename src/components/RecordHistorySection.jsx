/**
 * RecordHistorySection — read-only change log for a student, shown as a tab
 * on StudentDetailPage (only when entries exist).
 *
 * Extends the tamper-evident story from the PDFs into the working records:
 * edits to the student record and their sessions no longer silently
 * overwrite — each one is listed here with field-level before → after, and
 * deletes keep enough of a snapshot to say what was removed.
 *
 * Detection, not prevention: the log itself lives in the same local
 * database. It protects against accidental edits and honest-mistake
 * disputes, not a determined admin with DevTools.
 */

const FIELD_LABELS = {
  first_name: 'First name', last_name: 'Last name', name: 'Name',
  grade: 'Grade', teacher: 'Teacher', tier: 'Tier', status: 'Status',
  referral_source: 'Referral source',
  permission_slip_on_file: 'Permission slip on file',
  permission_slip_signed_date: 'Permission slip signed',
  session_date: 'Date', start_time: 'Start time', end_time: 'End time',
  duration_minutes: 'Duration (min)', domain: 'Domain', notes: 'Notes',
  session_type: 'Session type', objectives_covered: 'Objectives covered',
};

const fmtVal = (v) => {
  if (v === null || v === undefined || v === '') return '(empty)';
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export default function RecordHistorySection({ entries }) {
  return (
    <div className="card">
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Change History</h2>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px', lineHeight: 1.5 }}>
        Every edit or deletion of this student's record and sessions, logged automatically. Entries cannot be edited from the app.
      </p>

      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>No changes recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((h) => (
            <div key={h.id} style={{
              border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px',
              borderLeft: `4px solid ${h.action === 'delete' ? '#ef4444' : '#2A9D8F'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2332' }}>
                  {h.table_name === 'students' ? 'Student record' : 'Session'}
                  {' '}{h.action === 'delete' ? 'deleted' : 'edited'}
                </span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{fmtWhen(h.at || h.created_at)}</span>
              </div>

              {h.action === 'update' && Array.isArray(h.changes) && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                  {h.changes.map((c, i) => (
                    <li key={i}>
                      <strong>{FIELD_LABELS[c.field] || c.field}:</strong>{' '}
                      <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{fmtVal(c.from)}</span>
                      {' → '}
                      <span>{fmtVal(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {h.action === 'delete' && h.snapshot && (
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {h.table_name === 'sessions'
                    ? <>Was: {h.snapshot.session_date || '?'} · {h.snapshot.duration_minutes ?? '?'} min · {h.snapshot.status || ''}{h.snapshot.notes ? <> · “{fmtVal(h.snapshot.notes)}”</> : null}</>
                    : <>Record removed (snapshot retained).</>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
