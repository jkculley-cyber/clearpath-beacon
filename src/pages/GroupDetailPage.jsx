import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
// supabase import removed — all data flows through db adapter
import { SESSION_STATUSES, ASCA_DOMAINS, PROGRESS_LEVELS, PROGRESS_COLORS } from '../lib/constants';
import { autoLogTime } from '../lib/autoLogTime';
import { generateGroupProgressPDF } from '../lib/pdfExports';

const TABS = ['Members', 'Sessions', 'Objectives', 'Lesson Plan'];

/** Student display name — use name column (always exists), fall back to first_name/last_name if available */
const sName = (s) => s?.name || (s?.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : 'Unknown');

/** Derive objectives array from group obj_1/obj_2/obj_3 + asca_1/asca_2/asca_3 */
function deriveObjectives(group) {
  if (!group) return [];
  const objs = [];
  for (let i = 1; i <= 3; i++) {
    const desc = group[`obj_${i}`];
    if (desc) {
      objs.push({
        index: i,
        description: desc,
        asca_domain: group[`asca_${i}`] || '',
      });
    }
  }
  return objs;
}

/* ---- Shared styles ---- */
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' };
const td = { padding: '10px 12px' };

/* ====================================================================
   Log Session Modal
   ==================================================================== */
function LogSessionModal({ open, onClose, group, members, objectives, counselorId }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Completed');
  const [attendance, setAttendance] = useState({});
  const [coveredObjs, setCoveredObjs] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && members.length) {
      const att = {};
      members.forEach((m) => { att[m.student_id] = 'present'; });
      setAttendance(att);
    }
  }, [open, members]);

  if (!open) return null;

  const toggleAttendance = (sid) => {
    setAttendance((prev) => ({ ...prev, [sid]: prev[sid] === 'present' ? 'absent' : 'present' }));
  };

  const toggleObj = (idx) => {
    setCoveredObjs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0) {
      setError('Duration must be a positive number.');
      return;
    }
    setSaving(true);

    const coveredArr = Object.entries(coveredObjs)
      .filter(([, v]) => v)
      .map(([idx]) => parseInt(idx, 10));

    const { data: sess, error: sessErr } = await db.insert('sessions', {
        counselor_id: counselorId,
        group_id: group.id,
        session_date: date,
        duration_minutes: dur,
        objectives_covered: coveredArr.length ? coveredArr : null,
        notes,
        status,
      });

    if (sessErr) {
      setError(sessErr.message || String(sessErr));
      setSaving(false);
      return;
    }

    if (sess) {
      // Save attendance to `attendance` table
      const attRows = Object.entries(attendance).map(([student_id, attStatus]) => ({
        session_id: sess.id,
        student_id,
        status: attStatus,
      }));
      if (attRows.length) await db.insertMany('attendance', attRows);

      // Feature #1: Auto-log time when session is completed
      if (status === 'Completed' && counselorId) {
        try {
          await autoLogTime({
            counselorId,
            sessionId: sess.id,
            date,
            durationMinutes: parseInt(duration, 10),
            description: 'Group counseling: ' + group.name,
          });
        } catch (err) {
          console.error('Auto-log time failed:', err);
        }
      }
    }

    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Log Session</h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <input className="form-input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {SESSION_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <label className="form-label">Attendance</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
            {members.map((m) => (
              <div key={m.student_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 14 }}>{sName(m.students)}</span>
                <button type="button" onClick={() => toggleAttendance(m.student_id)} style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: attendance[m.student_id] === 'present' ? '#dcfce7' : '#fee2e2',
                  color: attendance[m.student_id] === 'present' ? '#16a34a' : '#dc2626',
                }}>
                  {attendance[m.student_id] === 'present' ? 'Present' : 'Absent'}
                </button>
              </div>
            ))}
          </div>

          {objectives.length > 0 && (
            <>
              <label className="form-label">Objectives Covered</label>
              <div style={{ marginBottom: 12 }}>
                {objectives.map((o) => (
                  <label key={o.index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!coveredObjs[o.index]} onChange={() => toggleObj(o.index)} />
                    {o.description}
                    {o.asca_domain && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({o.asca_domain})</span>}
                  </label>
                ))}
              </div>
            </>
          )}

          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 16 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ====================================================================
   Add Member Modal
   ==================================================================== */
function AddMemberModal({ open, onClose, groupId, existingIds }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [adding, setAdding] = useState(null);

  // Reset search field every time the modal opens so the previous search
  // doesn't persist when a user adds members to a different group.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setAdding(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await db.select('students', {});
      const q = query.toLowerCase();
      const filtered = (data || [])
        .filter((s) => s.name?.toLowerCase().includes(q) && !existingIds.includes(s.id))
        .slice(0, 10);
      setResults(filtered);
    }, 300);
    return () => clearTimeout(t);
  }, [open, query, existingIds]);

  if (!open) return null;

  const handleAdd = async (studentId) => {
    setAdding(studentId);
    const { error: err } = await db.insert('group_members', { group_id: groupId, student_id: studentId });
    setAdding(null);
    if (err) {
      alert(err.message || String(err));
      return;
    }
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Add Member</h3>
        <input className="form-input" placeholder="Search students..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus style={{ marginBottom: 12 }} />
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {results.length === 0 && query.length >= 2 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No matching students found</p>
          )}
          {results.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 14 }}>
                {sName(s)} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Grade {s.grade}</span>
              </span>
              <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleAdd(s.id)} disabled={adding === s.id}>
                {adding === s.id ? '...' : 'Add'}
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline" onClick={() => onClose(false)} style={{ width: '100%', marginTop: 12 }}>Close</button>
      </div>
    </div>
  );
}

/* ====================================================================
   Rate Progress Modal
   ==================================================================== */
function RateProgressModal({ open, onClose, sessionId, members, objectives }) {
  const [ratings, setRatings] = useState({});
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const key = (studentId, objIndex) => `${studentId}_${objIndex}`;

  const setRating = (studentId, objIndex, rating) => {
    setRatings((prev) => ({ ...prev, [key(studentId, objIndex)]: rating }));
  };

  const handleSave = async () => {
    setSaving(true);
    const rows = [];
    for (const [k, rating] of Object.entries(ratings)) {
      if (!rating) continue;
      const [student_id, objective_index] = k.split('_');
      rows.push({
        session_id: sessionId,
        student_id,
        objective_index: parseInt(objective_index, 10),
        rating: parseInt(rating, 10),
      });
    }
    if (rows.length) {
      await db.insertMany('progress_ratings', rows);
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Rate Progress</h3>
        <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
          {members.map((m) => (
            <div key={m.student_id} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#1a2332' }}>
                {sName(m.students)}
              </div>
              {objectives.map((o) => (
                <div key={o.index} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
                  <span style={{ fontSize: 13, flex: 1, color: '#374151' }}>{o.description}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(m.student_id, o.index, r)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          fontWeight: 700, fontSize: 13, color: '#fff',
                          background: ratings[key(m.student_id, o.index)] === r ? PROGRESS_COLORS[r] : '#e5e7eb',
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save Ratings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   AI Next Session Plan Modal (Feature #9)
   ==================================================================== */
function AIPlanModal({ open, onClose, group, members, sessions, objectives }) {
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setPlan('');
      setError(null);
      return;
    }
    generatePlan();
  }, [open]);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    setPlan('');

    const recentSessions = (sessions || []).slice(0, 5);
    const memberNames = (members || []).map((m) => sName(m.students));
    const objList = objectives.map((o) => o.description).filter(Boolean);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-session-plan', {
        body: {
          groupName: group.name,
          focusArea: group.focus_area || '',
          gradeBand: group.grade_band || '',
          objectives: objList,
          recentSessions: recentSessions.map((s) => ({
            date: s.session_date,
            notes: s.notes || '',
            status: s.status,
          })),
          members: memberNames,
        },
      });

      if (fnErr) throw fnErr;
      setPlan(data?.plan || data?.text || (typeof data === 'string' ? data : ''));
      if (!plan && data) {
        // Handle case where data might be structured differently
        setPlan(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error('AI plan generation failed:', err);
      setError(true);
      // Build a fallback plan based on objectives
      const fallbackLines = [
        `Next Session Plan for ${group.name}`,
        `Grade Band: ${group.grade_band || 'N/A'}`,
        `Focus Area: ${group.focus_area || 'N/A'}`,
        '',
        'Suggested Activities:',
      ];
      objectives.forEach((o, i) => {
        fallbackLines.push(`${i + 1}. Objective: ${o.description}`);
        if (o.asca_domain) fallbackLines.push(`   ASCA Domain: ${o.asca_domain}`);
        fallbackLines.push(`   Activity: Facilitate a group discussion or skill-building exercise related to "${o.description}".`);
        fallbackLines.push('');
      });
      if (objectives.length === 0) {
        fallbackLines.push('- Review group goals and set individual targets');
        fallbackLines.push('- Conduct a check-in round with all members');
        fallbackLines.push('- Introduce a new skill-building activity aligned with the focus area');
      }
      fallbackLines.push('');
      fallbackLines.push(`Members (${memberNames.length}): ${memberNames.join(', ')}`);
      setPlan(fallbackLines.join('\n'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const handleSaveAsNotes = () => {
    // Copy plan text to clipboard and inform user
    if (navigator.clipboard) {
      navigator.clipboard.writeText(plan).then(() => {
        alert('Plan copied to clipboard. Paste it into session notes when logging your next session.');
      });
    } else {
      // Fallback: select and copy
      const ta = document.createElement('textarea');
      ta.value = plan;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Plan copied to clipboard. Paste it into session notes when logging your next session.');
    }
    onClose();
  };

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={{ ...modal, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>
          AI Next Session Plan
          {error && <span style={{ fontSize: 12, fontWeight: 400, color: '#d97706', marginLeft: 8 }}>(fallback suggestion)</span>}
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: 'var(--teal)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Generating session plan...</p>
          </div>
        ) : (
          <>
            <textarea
              className="form-input"
              rows={14}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              style={{ marginBottom: 16, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1 }}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveAsNotes} style={{ flex: 1 }}>
                Save as Session Notes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   Main Page
   ==================================================================== */
export default function GroupDetailPage() {
  const { id } = useParams();
  const { counselor, isLocalMode } = useAuth();
  const [tab, setTab] = useState('Members');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogSession, setShowLogSession] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRateProgress, setShowRateProgress] = useState(null); // session id or null
  const [showAIPlan, setShowAIPlan] = useState(false);

  const objectives = deriveObjectives(group);

  const loadAll = useCallback(async () => {
    setLoading(true);

    // 1. Load group
    const { data: grpData } = await db.select('groups', { eq: { id } });
    const grp = grpData?.[0] || null;
    setGroup(grp);

    if (!grp) {
      setLoading(false);
      return;
    }

    // 2. Load members + students, sessions + attendance in parallel
    const [memRes, sessRes, studRes, attRes] = await Promise.all([
      db.select('group_members', { eq: { group_id: id } }),
      db.select('sessions', { eq: { group_id: id }, order: { column: 'session_date', ascending: false } }),
      db.select('students', {}),
      db.select('attendance', {}),
    ]);

    const allStudents = studRes.data || [];
    const allAtt = attRes.data || [];
    const sessData = sessRes.data || [];

    // Attach student data to members
    const membersWithStudents = (memRes.data || []).map(m => ({
      ...m,
      students: allStudents.find(s => s.id === m.student_id) || null,
    }));

    // Attach attendance to sessions
    const sessionsWithAtt = sessData.map(s => ({
      ...s,
      attendance: allAtt.filter(a => a.session_id === s.id),
    }));

    setMembers(membersWithStudents);
    setSessions(sessionsWithAtt);

    // 3. Load progress_ratings for all sessions in this group
    if (sessData.length > 0) {
      const { data: allProg } = await db.select('progress_ratings', {});
      const sessionIds = new Set(sessData.map(s => s.id));
      setProgressData((allProg || []).filter(p => sessionIds.has(p.session_id)));
    } else {
      setProgressData([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const removeMember = async (memberId) => {
    if (!confirm('Remove this student from the group?')) return;
    await db.del('group_members', memberId);
    loadAll();
  };

  /**
   * Get latest rating for a student + objective_index across all sessions.
   * progress_ratings has: session_id, student_id, objective_index, rating, notes, created_at
   */
  const getLatestRating = (studentId, objectiveIndex) => {
    const matches = progressData.filter(
      (p) => p.student_id === studentId && p.objective_index === objectiveIndex
    );
    if (matches.length === 0) return 0;
    // Sort by created_at descending and take latest
    matches.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return matches[0].rating || 0;
  };

  const handleExportPDF = () => {
    if (!group) return;
    generateGroupProgressPDF(group, members, sessions);
  };

  if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!group) return <div className="page"><p>Group not found.</p></div>;

  return (
    <div className="page">
      {/* ---- Header ---- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>{group.name}</h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            {group.grade_band && <span>Grades: {group.grade_band}</span>}
            {group.focus_area && <span>Focus: {group.focus_area}</span>}
            <span>{members.length} members</span>
            {group.status && <span>Status: {group.status}</span>}
          </div>
        </div>
        {/* Feature #4: PDF Export */}
        <button className="btn btn-outline" onClick={handleExportPDF} style={{ whiteSpace: 'nowrap' }}>
          Export PDF
        </button>
      </div>

      {/* ---- Tab bar ---- */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--teal)' : '2px solid transparent',
            color: tab === t ? 'var(--teal)' : 'var(--text-muted)', marginBottom: -2,
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* ==== Members Tab ==== */}
      {tab === 'Members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>+ Add Student</button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {members.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No members yet.</p>
            ) : members.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1a2332' }}>{sName(m.students)}</span>
                  <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>Grade {m.students?.grade}</span>
                  {m.joined_date && <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>Joined {m.joined_date}</span>}
                </div>
                <button onClick={() => removeMember(m.id)} style={{
                  background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                }}>Remove</button>
              </div>
            ))}
          </div>
          <AddMemberModal
            open={showAddMember}
            onClose={(changed) => { setShowAddMember(false); if (changed) loadAll(); }}
            groupId={id}
            existingIds={members.map((m) => m.student_id)}
          />
        </div>
      )}

      {/* ==== Sessions Tab ==== */}
      {tab === 'Sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
            {/* Feature #9: Generate Next Session — cloud mode only (needs edge function) */}
            {!isLocalMode && (
              <button className="btn btn-outline" onClick={() => setShowAIPlan(true)}>
                Generate Next Session
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowLogSession(true)}>Log Session</button>
          </div>
          {sessions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No sessions logged yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sessions.map((s) => {
                const att = s.attendance || [];
                const present = att.filter((a) => a.status === 'present').length;
                return (
                  <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1a2332', marginBottom: 2 }}>{s.session_date}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {s.duration_minutes} min &middot; {present}/{att.length} present
                        {s.objectives_covered && s.objectives_covered.length > 0 && (
                          <span> &middot; Obj: {s.objectives_covered.join(', ')}</span>
                        )}
                      </div>
                      {s.notes && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.status === 'Completed' && objectives.length > 0 && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setShowRateProgress(s.id)}
                        >
                          Rate
                        </button>
                      )}
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: s.status === 'Completed' ? '#dcfce7' : s.status === 'Cancelled' ? '#fee2e2' : '#fef3c7',
                        color: s.status === 'Completed' ? '#16a34a' : s.status === 'Cancelled' ? '#dc2626' : '#d97706',
                      }}>{s.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <LogSessionModal
            open={showLogSession}
            onClose={(saved) => { setShowLogSession(false); if (saved) loadAll(); }}
            group={group}
            members={members}
            objectives={objectives}
            counselorId={counselor?.id}
          />
          <RateProgressModal
            open={!!showRateProgress}
            onClose={(saved) => { setShowRateProgress(null); if (saved) loadAll(); }}
            sessionId={showRateProgress}
            members={members}
            objectives={objectives}
          />
          <AIPlanModal
            open={showAIPlan}
            onClose={() => setShowAIPlan(false)}
            group={group}
            members={members}
            sessions={sessions}
            objectives={objectives}
          />
        </div>
      )}

      {/* ==== Objectives Tab ==== */}
      {tab === 'Objectives' && (
        <div>
          {objectives.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No objectives defined for this group.</p>
            </div>
          ) : (
            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={th}>Student</th>
                    {objectives.map((o) => (
                      <th key={o.index} style={th}>
                        <div>{o.description}</div>
                        {o.asca_domain && (
                          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{o.asca_domain}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>{sName(m.students)}</td>
                      {objectives.map((o) => {
                        const r = getLatestRating(m.student_id, o.index);
                        return (
                          <td key={o.index} style={{ ...td, textAlign: 'center' }}>
                            {r > 0 ? (
                              <span style={{
                                display: 'inline-block', width: 28, height: 28, borderRadius: '50%',
                                background: PROGRESS_COLORS[r], color: '#fff', lineHeight: '28px',
                                fontSize: 13, fontWeight: 700,
                              }}>{r}</span>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>--</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                {Object.entries(PROGRESS_LEVELS).map(([k, v]) => (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: PROGRESS_COLORS[k], display: 'inline-block' }} />
                    {k} = {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==== Lesson Plan Tab ==== */}
      {tab === 'Lesson Plan' && (
        <div>
          {sessions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No sessions scheduled yet. Log sessions to build the semester plan.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sessions.map((s, i) => (
                <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--teal)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }}>
                    {sessions.length - i}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1a2332' }}>{s.session_date}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {s.duration_minutes} min
                      {s.objectives_covered && s.objectives_covered.length > 0 && (
                        <span>
                          {' '}&middot; Objectives: {s.objectives_covered.map((idx) => {
                            const obj = objectives.find((o) => o.index === idx);
                            return obj ? obj.description : `#${idx}`;
                          }).join(', ')}
                        </span>
                      )}
                    </div>
                    {s.notes && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.notes}</div>}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: s.status === 'Completed' ? '#dcfce7' : s.status === 'Cancelled' ? '#fee2e2' : '#fef3c7',
                    color: s.status === 'Completed' ? '#16a34a' : s.status === 'Cancelled' ? '#dc2626' : '#d97706',
                  }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
