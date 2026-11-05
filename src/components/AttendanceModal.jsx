import { useState, useEffect } from 'react';
import { db } from '../lib/db';

const sName = (s) => s?.name || (s?.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : 'Unknown');

/**
 * Take or correct attendance for an already-saved group session.
 * Group sessions scheduled from the Schedule page (and later marked Completed
 * there) never pass through the Group page's Log Session form, so this is the
 * only place their attendance can be recorded.
 *
 * Roster = current group members plus anyone who already has an attendance row
 * for this session (so a student who has since left the group keeps their record).
 * Students without a row default to Present.
 */
export default function AttendanceModal({ session, onClose }) {
  const [roster, setRoster] = useState([]);
  const [existing, setExisting] = useState({});
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [memRes, attRes, stuRes] = await Promise.all([
        db.select('group_members', { eq: { group_id: session.group_id } }),
        db.select('attendance', { eq: { session_id: session.id } }),
        db.select('students', {}),
      ]);
      if (cancelled) return;
      const students = stuRes.data || [];
      const rows = attRes.data || [];
      const ids = [...new Set([...(memRes.data || []).map((m) => m.student_id), ...rows.map((r) => r.student_id)])];
      const byStudent = {};
      rows.forEach((r) => { byStudent[r.student_id] = r; });
      const att = {};
      ids.forEach((sid) => { att[sid] = byStudent[sid]?.status || 'present'; });
      setRoster(
        ids
          .map((sid) => ({ student_id: sid, student: students.find((s) => s.id === sid) }))
          .sort((a, b) => sName(a.student).localeCompare(sName(b.student))),
      );
      setExisting(byStudent);
      setAttendance(att);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (!session) return null;

  const toggle = (sid) => {
    setAttendance((prev) => ({ ...prev, [sid]: prev[sid] === 'present' ? 'absent' : 'present' }));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const toInsert = [];
    for (const [student_id, status] of Object.entries(attendance)) {
      const row = existing[student_id];
      if (row) {
        if (row.status !== status) {
          const { error: upErr } = await db.update('attendance', row.id, { status });
          if (upErr) { setError(upErr.message || String(upErr)); setSaving(false); return; }
        }
      } else {
        toInsert.push({ session_id: session.id, student_id, status });
      }
    }
    if (toInsert.length) {
      const { error: insErr } = await db.insertMany('attendance', toInsert);
      if (insErr) { setError(insErr.message || String(insErr)); setSaving(false); return; }
    }
    setSaving(false);
    onClose(true);
  };

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Attendance</h3>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
          {session.session_date}
          {session.start_time ? ` · ${session.start_time.slice(0, 5)}` : ''}
          {!loading && roster.length > 0 ? ` · ${presentCount}/${roster.length} present` : ''}
        </div>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {loading ? (
          <p style={{ fontSize: 14, color: '#6b7280' }}>Loading…</p>
        ) : roster.length === 0 ? (
          <p style={{ fontSize: 14, color: '#6b7280' }}>This group has no members yet. Add students on the group's Members tab.</p>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
            {roster.map((r) => (
              <div key={r.student_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 14 }}>{sName(r.student)}</span>
                <button type="button" onClick={() => toggle(r.student_id)} style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: attendance[r.student_id] === 'present' ? '#dcfce7' : '#fee2e2',
                  color: attendance[r.student_id] === 'present' ? '#16a34a' : '#dc2626',
                }}>
                  {attendance[r.student_id] === 'present' ? 'Present' : 'Absent'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loading || roster.length === 0} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
