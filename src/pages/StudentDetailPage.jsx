import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CONTACT_TYPES, PROGRESS_COLORS, PROGRESS_LEVELS } from '../lib/constants';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { autoLogTime } from '../lib/autoLogTime';
import { generateProgressPDF, generateMTSSReport } from '../lib/pdfExports';

const TABS = ['Services', 'Progress', 'Communications', 'Notes'];

const sName = (s) =>
  s?.first_name
    ? `${s.first_name} ${s.last_name || ''}`.trim()
    : s?.name || 'Unknown';

/* ---- Shared Styles ---- */
const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};
const modal = {
  background: '#fff',
  borderRadius: 12,
  padding: 28,
  width: 440,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};
const modalTitle = {
  fontSize: 18,
  fontWeight: 700,
  color: '#1a2332',
  margin: '0 0 16px',
};
const sectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 10px',
};

const OBJ_COLORS = ['#2A9D8F', '#e76f51', '#264653'];
const OBJ_LABELS = { 1: 'Objective 1', 2: 'Objective 2', 3: 'Objective 3' };

/* ---- Quick Action Modals ---- */
function LogSessionModal({ open, onClose, student, counselorId }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data: sess } = await supabase.from('sessions').insert({
      counselor_id: counselorId,
      student_id: student.id,
      session_date: date,
      duration_minutes: parseInt(duration, 10),
      notes,
      session_type: 'individual',
      status: 'Completed',
    }).select().single();

    if (sess) {
      await autoLogTime({
        counselorId,
        sessionId: sess.id,
        date,
        durationMinutes: parseInt(duration, 10),
        description: `Individual counseling: ${sName(student)}`,
      });
    }

    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Log Individual Session</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="form-label">Date</label>
              <input
                className="form-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onClose(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogContactModal({ open, onClose, student, counselorId }) {
  const [contactType, setContactType] = useState('Phone call');
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('communications').insert({
      counselor_id: counselorId,
      student_id: student.id,
      contact_type: contactType,
      duration_minutes: parseInt(duration, 10),
      notes,
      contact_date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Log Contact</h3>
        <form onSubmit={handleSave}>
          <label className="form-label">Contact Type</label>
          <select
            className="form-input"
            value={contactType}
            onChange={(e) => setContactType(e.target.value)}
            style={{ marginBottom: 10 }}
          >
            {CONTACT_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="form-label">Duration (min)</label>
          <input
            className="form-input"
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onClose(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : 'Log Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoteModal({ open, onClose, student, counselorId, editNote }) {
  const [text, setText] = useState(editNote?.note_text || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(editNote?.note_text || '');
  }, [editNote]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editNote) {
      await supabase
        .from('counselor_notes')
        .update({ note_text: text })
        .eq('id', editNote.id);
    } else {
      await supabase.from('counselor_notes').insert({
        counselor_id: counselorId,
        student_id: student.id,
        note_text: text,
      });
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{editNote ? 'Edit Note' : 'Add Note'}</h3>
        <form onSubmit={handleSave}>
          <textarea
            className="form-input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            style={{ marginBottom: 16 }}
            placeholder="Private counselor note..."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onClose(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Main ---- */
export default function StudentDetailPage() {
  const { id } = useParams();
  const { counselor } = useAuth();
  const [tab, setTab] = useState('Services');
  const [student, setStudent] = useState(null);
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [comms, setComms] = useState([]);
  const [notes, setNotes] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogSession, setShowLogSession] = useState(false);
  const [showLogContact, setShowLogContact] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [editNote, setEditNote] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [stuRes, grpRes, sessRes, commRes, noteRes, progRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase
        .from('group_members')
        .select('*, groups(id, name, focus_area, status)')
        .eq('student_id', id),
      supabase
        .from('sessions')
        .select('*')
        .eq('student_id', id)
        .order('session_date', { ascending: false }),
      supabase
        .from('communications')
        .select('*')
        .eq('student_id', id)
        .order('contact_date', { ascending: false }),
      supabase
        .from('counselor_notes')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('progress_ratings')
        .select('*')
        .eq('student_id', id)
        .order('created_at'),
    ]);
    setStudent(stuRes.data);
    setGroups(grpRes.data || []);
    setSessions(sessRes.data || []);
    setComms(commRes.data || []);
    setNotes(noteRes.data || []);
    setProgress(progRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const deleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    await supabase.from('counselor_notes').delete().eq('id', noteId);
    loadAll();
  };

  const tierColors = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };

  /* Build progress chart data — group by date, pivot objective_index into columns */
  const progressChartMap = {};
  for (const p of progress) {
    const dateKey = p.created_at?.slice(0, 10) || 'unknown';
    if (!progressChartMap[dateKey]) {
      progressChartMap[dateKey] = { date: dateKey };
    }
    progressChartMap[dateKey][`obj${p.objective_index}`] = p.rating;
  }
  const progressChart = Object.values(progressChartMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  /* Determine which objective indices appear in data */
  const objIndices = [...new Set(progress.map((p) => p.objective_index))].sort();

  if (loading) {
    return (
      <div className="page">
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="page">
        <p>Student not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a2332',
                margin: '0 0 6px',
              }}
            >
              {sName(student)}
            </h1>
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 13,
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
              }}
            >
              {student.grade && <span>Grade {student.grade}</span>}
              {student.teacher && <span>Teacher: {student.teacher}</span>}
              {student.referral_source && (
                <span>Referral: {student.referral_source}</span>
              )}
              {student.date_first_seen && (
                <span>First seen: {student.date_first_seen}</span>
              )}
              {!student.date_first_seen && student.created_at && (
                <span>First seen: {student.created_at.slice(0, 10)}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background:
                  (tierColors[student.tier] || '#9ca3af') + '20',
                color: tierColors[student.tier] || '#9ca3af',
              }}
            >
              Tier {student.tier}
            </span>
            <span
              style={{
                textTransform: 'capitalize',
                fontSize: 13,
                color:
                  student.status === 'active' ? '#22c55e' : '#9ca3af',
              }}
            >
              {student.status}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => setShowLogSession(true)}
        >
          Log Session
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setShowLogContact(true)}
        >
          Log Contact
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            setEditNote(null);
            setShowNote(true);
          }}
        >
          Add Note
        </button>
        <button
          className="btn btn-outline"
          onClick={() => generateProgressPDF(student, groups, sessions)}
        >
          Export Progress PDF
        </button>
        <button
          className="btn btn-outline"
          onClick={() =>
            generateMTSSReport(student, groups, sessions, comms)
          }
        >
          Export MTSS Report
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom:
                tab === t
                  ? '2px solid var(--teal)'
                  : '2px solid transparent',
              color: tab === t ? 'var(--teal)' : 'var(--text-muted)',
              marginBottom: -2,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Services */}
      {tab === 'Services' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <h3 style={sectionTitle}>Group Memberships</h3>
            {groups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Not assigned to any groups.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {groups.map((gm) => (
                  <div
                    key={gm.id}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span
                        style={{ fontWeight: 600, color: '#1a2332' }}
                      >
                        {gm.groups?.name}
                      </span>
                      <span
                        style={{
                          marginLeft: 12,
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {gm.groups?.focus_area}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        textTransform: 'capitalize',
                        color:
                          gm.groups?.status === 'active'
                            ? '#22c55e'
                            : '#9ca3af',
                      }}
                    >
                      {gm.groups?.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 style={sectionTitle}>Individual Sessions</h3>
            {sessions.filter(
              (s) => s.session_type === 'individual' || !s.group_id
            ).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                No individual sessions recorded.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {sessions
                  .filter(
                    (s) =>
                      s.session_type === 'individual' || !s.group_id
                  )
                  .map((s) => (
                    <div
                      key={s.id}
                      className="card"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 600,
                            color: '#1a2332',
                          }}
                        >
                          {s.session_date}
                        </span>
                        <span
                          style={{
                            marginLeft: 12,
                            fontSize: 13,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {s.duration_minutes} min
                        </span>
                        {s.notes && (
                          <div
                            style={{
                              fontSize: 13,
                              color: '#6b7280',
                              marginTop: 2,
                            }}
                          >
                            {s.notes}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background:
                            s.status === 'Completed'
                              ? '#dcfce7'
                              : '#fef3c7',
                          color:
                            s.status === 'Completed'
                              ? '#16a34a'
                              : '#d97706',
                        }}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      {tab === 'Progress' && (
        <div>
          {progressChart.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: 'center', padding: 40 }}
            >
              <p style={{ color: 'var(--text-muted)' }}>
                No progress ratings yet.
              </p>
            </div>
          ) : (
            <div className="card">
              <h3 style={sectionTitle}>Progress Over Time</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={progressChart}
                    margin={{
                      top: 5,
                      right: 20,
                      bottom: 5,
                      left: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f3f4f6"
                    />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={[0, 3]}
                      ticks={[1, 2, 3]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        PROGRESS_LEVELS[v] || v
                      }
                    />
                    <Tooltip
                      formatter={(v, name) => [
                        PROGRESS_LEVELS[v] || v,
                        OBJ_LABELS[name.replace('obj', '')] || name,
                      ]}
                    />
                    {objIndices.map((idx, i) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={`obj${idx}`}
                        name={`obj${idx}`}
                        stroke={OBJ_COLORS[i % OBJ_COLORS.length]}
                        strokeWidth={2}
                        dot={{
                          fill: OBJ_COLORS[i % OBJ_COLORS.length],
                          r: 4,
                        }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Objective legend */}
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  marginTop: 12,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap',
                }}
              >
                {objIndices.map((idx, i) => (
                  <span
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background:
                          OBJ_COLORS[i % OBJ_COLORS.length],
                        display: 'inline-block',
                      }}
                    />
                    {OBJ_LABELS[idx] || `Objective ${idx}`}
                  </span>
                ))}
              </div>
              {/* Rating level legend */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 8,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                {Object.entries(PROGRESS_LEVELS).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: PROGRESS_COLORS[k],
                        display: 'inline-block',
                      }}
                    />
                    {k} = {v}
                  </span>
                ))}
              </div>

              {/* Ratings table */}
              <div style={{ marginTop: 20 }}>
                <h3 style={sectionTitle}>Rating History</h3>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Objective</th>
                      <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Rating</th>
                      <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((p) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <td style={{ padding: '6px 8px' }}>
                          {p.created_at?.slice(0, 10)}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          {OBJ_LABELS[p.objective_index] ||
                            `Objective ${p.objective_index}`}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background:
                                  PROGRESS_COLORS[p.rating] ||
                                  '#9ca3af',
                                display: 'inline-block',
                              }}
                            />
                            {p.rating} -{' '}
                            {PROGRESS_LEVELS[p.rating] || ''}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            color: '#6b7280',
                          }}
                        >
                          {p.notes || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Communications */}
      {tab === 'Communications' && (
        <div>
          {comms.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: 'center', padding: 40 }}
            >
              <p style={{ color: 'var(--text-muted)' }}>
                No communications logged.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {comms.map((c) => (
                <div key={c.id} className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{ fontWeight: 600, color: '#1a2332' }}
                    >
                      {c.contact_type}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {c.contact_date} &middot; {c.duration_minutes}{' '}
                      min
                    </span>
                  </div>
                  {c.notes && (
                    <p
                      style={{
                        fontSize: 14,
                        color: '#4b5563',
                        margin: 0,
                      }}
                    >
                      {c.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {tab === 'Notes' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditNote(null);
                setShowNote(true);
              }}
            >
              + Add Note
            </button>
          </div>
          {notes.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: 'center', padding: 40 }}
            >
              <p style={{ color: 'var(--text-muted)' }}>
                No notes yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notes.map((n) => (
                <div key={n.id} className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {n.created_at?.slice(0, 10)}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          setEditNote(n);
                          setShowNote(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--teal)',
                          fontSize: 13,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNote(n.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 13,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: '#374151',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {n.note_text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <LogSessionModal
        open={showLogSession}
        onClose={(s) => {
          setShowLogSession(false);
          if (s) loadAll();
        }}
        student={student}
        counselorId={counselor?.id}
      />
      <LogContactModal
        open={showLogContact}
        onClose={(s) => {
          setShowLogContact(false);
          if (s) loadAll();
        }}
        student={student}
        counselorId={counselor?.id}
      />
      <NoteModal
        open={showNote}
        onClose={(s) => {
          setShowNote(false);
          setEditNote(null);
          if (s) loadAll();
        }}
        student={student}
        counselorId={counselor?.id}
        editNote={editNote}
      />
    </div>
  );
}
