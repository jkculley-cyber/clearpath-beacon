import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SESSION_STATUSES, ASCA_DOMAINS, PROGRESS_LEVELS, PROGRESS_COLORS } from '../lib/constants';

const TABS = ['Members', 'Sessions', 'Objectives', 'Lesson Plan'];

/* ---- Log Session Modal ---- */
function LogSessionModal({ open, onClose, group, members, objectives, counselorId }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [attendance, setAttendance] = useState({});
  const [coveredObjs, setCoveredObjs] = useState({});
  const [saving, setSaving] = useState(false);

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

  const toggleObj = (oid) => {
    setCoveredObjs((prev) => ({ ...prev, [oid]: !prev[oid] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { data: sess } = await supabase
      .from('sessions')
      .insert({
        counselor_id: counselorId,
        group_id: group.id,
        session_date: date,
        duration_minutes: parseInt(duration, 10),
        notes,
        status: 'Completed',
      })
      .select()
      .single();

    if (sess) {
      // Save attendance
      const attRows = Object.entries(attendance).map(([student_id, status]) => ({
        session_id: sess.id,
        student_id,
        status,
      }));
      if (attRows.length) await supabase.from('session_attendance').insert(attRows);

      // Save objectives covered
      const objRows = Object.entries(coveredObjs)
        .filter(([, v]) => v)
        .map(([objective_id]) => ({ session_id: sess.id, objective_id }));
      if (objRows.length) await supabase.from('session_objectives').insert(objRows);
    }

    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Log Session</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <input className="form-input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
          </div>

          <label className="form-label">Attendance</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
            {members.map((m) => (
              <div key={m.student_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 14 }}>{m.students?.first_name} {m.students?.last_name}</span>
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
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!coveredObjs[o.id]} onChange={() => toggleObj(o.id)} />
                    {o.description}
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

/* ---- Add Member Modal ---- */
function AddMemberModal({ open, onClose, groupId, existingIds }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    if (!open || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10);
      setResults((data || []).filter((s) => !existingIds.includes(s.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [open, query, existingIds]);

  if (!open) return null;

  const handleAdd = async (studentId) => {
    setAdding(studentId);
    await supabase.from('group_members').insert({ group_id: groupId, student_id: studentId });
    setAdding(null);
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
              <span style={{ fontSize: 14 }}>{s.first_name} {s.last_name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Grade {s.grade}</span></span>
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

/* ---- Main Page ---- */
export default function GroupDetailPage() {
  const { id } = useParams();
  const { counselor } = useAuth();
  const [tab, setTab] = useState('Members');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogSession, setShowLogSession] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [grpRes, memRes, sessRes, objRes, progRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*, students(id, first_name, last_name, grade)').eq('group_id', id),
      supabase.from('sessions').select('*, session_attendance(student_id, status)').eq('group_id', id).order('session_date', { ascending: false }),
      supabase.from('group_objectives').select('*').eq('group_id', id).order('sort_order'),
      supabase.from('progress_ratings').select('*').eq('group_id', id),
    ]);
    setGroup(grpRes.data);
    setMembers(memRes.data || []);
    setSessions(sessRes.data || []);
    setObjectives(objRes.data || []);
    setProgressData(progRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const removeMember = async (memberId) => {
    if (!confirm('Remove this student from the group?')) return;
    await supabase.from('group_members').delete().eq('id', memberId);
    loadAll();
  };

  const getRating = (studentId, objectiveId) => {
    const r = progressData.find((p) => p.student_id === studentId && p.objective_id === objectiveId);
    return r?.rating || 0;
  };

  if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!group) return <div className="page"><p>Group not found.</p></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: '0 0 4px' }}>{group.name}</h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          {group.grade_band && <span>Grades: {group.grade_band}</span>}
          {group.focus_area && <span>Focus: {group.focus_area}</span>}
          <span>{members.length} members</span>
        </div>
      </div>

      {/* Tab bar */}
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

      {/* ---- Members Tab ---- */}
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
                  <span style={{ fontWeight: 600, color: '#1a2332' }}>{m.students?.first_name} {m.students?.last_name}</span>
                  <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>Grade {m.students?.grade}</span>
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

      {/* ---- Sessions Tab ---- */}
      {tab === 'Sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowLogSession(true)}>Log Session</button>
          </div>
          {sessions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No sessions logged yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sessions.map((s) => {
                const att = s.session_attendance || [];
                const present = att.filter((a) => a.status === 'present').length;
                return (
                  <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a2332', marginBottom: 2 }}>{s.session_date}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {s.duration_minutes} min &middot; {present}/{att.length} present
                      </div>
                      {s.notes && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.notes}</div>}
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: s.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                      color: s.status === 'Completed' ? '#16a34a' : '#d97706',
                    }}>{s.status}</span>
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
        </div>
      )}

      {/* ---- Objectives Tab ---- */}
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
                      <th key={o.id} style={th}>
                        <div>{o.description}</div>
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{o.asca_domain}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>{m.students?.first_name} {m.students?.last_name}</td>
                      {objectives.map((o) => {
                        const r = getRating(m.student_id, o.id);
                        return (
                          <td key={o.id} style={{ ...td, textAlign: 'center' }}>
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

      {/* ---- Lesson Plan Tab ---- */}
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
                      {s.lesson_title || 'No lesson attached'}{s.notes ? ` - ${s.notes}` : ''}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: s.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                    color: s.status === 'Completed' ? '#16a34a' : '#d97706',
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

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' };
const td = { padding: '10px 12px' };
