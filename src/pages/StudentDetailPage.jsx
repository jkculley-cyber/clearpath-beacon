import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { CONTACT_TYPES, PROGRESS_COLORS, PROGRESS_LEVELS, MTSS_TIERS, STUDENT_STATUSES } from '../lib/constants';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { autoLogTime } from '../lib/autoLogTime';
import { generateProgressPDF, generateMTSSReport } from '../lib/pdfExports';
import ExportNotesModal from '../components/ExportNotesModal';
import CrisisRecordsSection from '../components/CrisisRecordsSection';
import RecordHistorySection from '../components/RecordHistorySection';

const TABS = ['Services', 'Progress', 'Communications', 'Notes'];

const sName = (s) =>
  s?.first_name
    ? `${s.first_name} ${s.last_name || ''}`.trim()
    : s?.name || 'Unknown';

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTimeStr = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

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
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const { data: sess, error: sessErr } = await db.insert('sessions', {
      counselor_id: counselorId,
      student_id: student.id,
      session_date: date,
      duration_minutes: parseInt(duration, 10),
      notes,
      session_type: 'individual',
      status: 'Completed',
    });

    if (sessErr) {
      setError(sessErr.message || String(sessErr));
      setSaving(false);
      return;
    }

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
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
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

function LogContactModal({ open, onClose, student, counselorId, editContact }) {
  const [contactType, setContactType] = useState('Phone call');
  const [contactDate, setContactDate] = useState(todayStr);
  const [contactTime, setContactTime] = useState(nowTimeStr);
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editContact) {
      setContactType(editContact.contact_type || 'Phone call');
      setContactDate(editContact.contact_date || todayStr());
      setContactTime((editContact.contact_time || '').slice(0, 5) || nowTimeStr());
      setDuration(String(editContact.duration_minutes ?? 15));
      setNotes(editContact.notes || '');
    } else {
      setContactType('Phone call');
      setContactDate(todayStr());
      setContactTime(nowTimeStr());
      setDuration('15');
      setNotes('');
    }
    setError('');
  }, [editContact, open]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      contact_type: contactType,
      contact_date: contactDate || todayStr(),
      contact_time: contactTime || null,
      duration_minutes: parseInt(duration, 10),
      notes,
    };
    let err;
    if (editContact) {
      ({ error: err } = await db.update('communications', editContact.id, payload));
    } else {
      ({ error: err } = await db.insert('communications', {
        counselor_id: counselorId,
        student_id: student.id,
        ...payload,
      }));
    }
    if (err) {
      setError(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  const handleDelete = async () => {
    if (!editContact) return;
    if (!confirm('Delete this contact log entry? This cannot be undone.')) return;
    setSaving(true);
    const { error: err } = await db.del('communications', editContact.id);
    if (err) {
      setError(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{editContact ? 'Edit Contact' : 'Log Contact'}</h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Date</label>
              <input
                className="form-input"
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Time</label>
              <input
                className="form-input"
                type="time"
                value={contactTime}
                onChange={(e) => setContactTime(e.target.value)}
              />
            </div>
          </div>
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
            {editContact && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #fecaca',
                  background: '#fff', color: '#b91c1c', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : (editContact ? 'Save Changes' : 'Log Contact')}
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
  const [error, setError] = useState('');

  useEffect(() => {
    setText(editNote?.note_text || '');
  }, [editNote]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    let err;
    if (editNote) {
      ({ error: err } = await db.update('counselor_notes', editNote.id, { note_text: text }));
    } else {
      ({ error: err } = await db.insert('counselor_notes', {
        counselor_id: counselorId,
        student_id: student.id,
        note_text: text,
      }));
    }
    if (err) {
      setError(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{editNote ? 'Edit Note' : 'Add Note'}</h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
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

const GRADES = ['K', '1', '2', '3', '4', '5'];

/* ---- Edit Student Modal ---- */
function EditStudentModal({ open, onClose, student }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacher, setTeacher] = useState('');
  const [tier, setTier] = useState(1);
  const [status, setStatus] = useState('active');
  const [referralSource, setReferralSource] = useState('');
  const [permissionSlipOnFile, setPermissionSlipOnFile] = useState(false);
  const [permissionSlipSignedDate, setPermissionSlipSignedDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) {
      setFirstName(student.first_name || student.name?.split(' ')[0] || '');
      setLastName(student.last_name || student.name?.split(' ').slice(1).join(' ') || '');
      setGrade(student.grade || '');
      setTeacher(student.teacher || '');
      setTier(student.tier || 1);
      setStatus(student.status || 'active');
      setReferralSource(student.referral_source || '');
      setPermissionSlipOnFile(!!student.permission_slip_on_file);
      setPermissionSlipSignedDate(student.permission_slip_signed_date || '');
    }
  }, [student]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await db.update('students', student.id, {
      name: (firstName + ' ' + lastName).trim(),
      first_name: firstName,
      last_name: lastName,
      grade: grade || null,
      teacher,
      tier: parseInt(tier, 10),
      status,
      referral_source: referralSource,
      permission_slip_on_file: permissionSlipOnFile,
      permission_slip_signed_date: permissionSlipOnFile
        ? (permissionSlipSignedDate || new Date().toISOString().slice(0, 10))
        : null,
    });
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Edit Student</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">First Name *</label>
              <input className="form-input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Grade</label>
              <select className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Select...</option>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">MTSS Tier</label>
              <select className="form-input" value={tier} onChange={(e) => setTier(e.target.value)}>
                {MTSS_TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
              </select>
            </div>
          </div>
          <label className="form-label">Teacher</label>
          <input className="form-input" value={teacher} onChange={(e) => setTeacher(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Referral Source</label>
              <input className="form-input" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} />
            </div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={permissionSlipOnFile}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPermissionSlipOnFile(checked);
                  if (checked && !permissionSlipSignedDate) {
                    setPermissionSlipSignedDate(new Date().toISOString().slice(0, 10));
                  }
                }}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Signed permission slip for counseling services on file
            </label>
            {permissionSlipOnFile && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Date signed</label>
                <input
                  className="form-input"
                  type="date"
                  value={permissionSlipSignedDate}
                  onChange={(e) => setPermissionSlipSignedDate(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Rate Progress Modal ---- */
function RateProgressModal({ open, onClose, student, counselorId, groups }) {
  const [objectiveIndex, setObjectiveIndex] = useState(1);
  const [rating, setRating] = useState(2);
  const [ratingNotes, setRatingNotes] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [recentSessions, setRecentSessions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && student?.id) {
      db.select('sessions', {
        eq: { student_id: student.id, status: 'Completed' },
        order: { column: 'session_date', ascending: false },
        limit: 10,
      }).then(({ data }) => {
          setRecentSessions(data || []);
          if (data?.length) setSessionId(data[0].id);
        });
    }
  }, [open, student]);

  if (!open) return null;

  // Build objective labels from group memberships
  const objLabels = {};
  (groups || []).forEach((gm) => {
    const g = gm.groups;
    if (g) {
      if (g.obj_1) objLabels[`${g.name} - Obj 1`] = { groupName: g.name, idx: 1, desc: g.obj_1 };
      if (g.obj_2) objLabels[`${g.name} - Obj 2`] = { groupName: g.name, idx: 2, desc: g.obj_2 };
      if (g.obj_3) objLabels[`${g.name} - Obj 3`] = { groupName: g.name, idx: 3, desc: g.obj_3 };
    }
  });
  const objOptions = Object.entries(objLabels);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!sessionId) return;
    setSaving(true);
    const { error: err } = await db.insert('progress_ratings', {
      session_id: sessionId,
      student_id: student.id,
      objective_index: parseInt(objectiveIndex, 10),
      rating: parseInt(rating, 10),
      notes: ratingNotes || null,
    });
    if (err) {
      alert(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Rate Progress</h3>
        <form onSubmit={handleSave}>
          <label className="form-label">Session *</label>
          <select className="form-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)} required style={{ marginBottom: 10 }}>
            <option value="">Select session...</option>
            {recentSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.session_date} — {s.session_type}</option>
            ))}
          </select>

          <label className="form-label">Objective *</label>
          {objOptions.length > 0 ? (
            <select className="form-input" value={objectiveIndex} onChange={(e) => setObjectiveIndex(e.target.value)} style={{ marginBottom: 10 }}>
              {objOptions.map(([label, { idx, desc }]) => (
                <option key={label} value={idx}>{label}: {desc}</option>
              ))}
            </select>
          ) : (
            <select className="form-input" value={objectiveIndex} onChange={(e) => setObjectiveIndex(e.target.value)} style={{ marginBottom: 10 }}>
              <option value={1}>Objective 1</option>
              <option value={2}>Objective 2</option>
              <option value={3}>Objective 3</option>
            </select>
          )}

          <label className="form-label">Rating *</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {Object.entries(PROGRESS_LEVELS).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRating(parseInt(val, 10))}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: `2px solid ${rating === parseInt(val, 10) ? PROGRESS_COLORS[val] : '#d1d5db'}`,
                  background: rating === parseInt(val, 10) ? PROGRESS_COLORS[val] + '20' : '#fff',
                  color: rating === parseInt(val, 10) ? PROGRESS_COLORS[val] : '#6b7280',
                }}
              >
                {val} — {label}
              </button>
            ))}
          </div>

          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={ratingNotes} onChange={(e) => setRatingNotes(e.target.value)} style={{ marginBottom: 16 }} placeholder="Optional notes on this rating..." />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !sessionId} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save Rating'}
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
  const [editContact, setEditContact] = useState(null);
  const [showNote, setShowNote] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showRateProgress, setShowRateProgress] = useState(false);
  const [exportKind, setExportKind] = useState(null); // 'progress' | 'mtss' | null
  const [crisisEvents, setCrisisEvents] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [stuRes, grpRes, sessRes, commRes, noteRes, progRes, crisisRes] = await Promise.all([
      db.selectById('students', id),
      db.select('group_members', { eq: { student_id: id } }),
      db.select('sessions', {
        eq: { student_id: id },
        order: { column: 'session_date', ascending: false },
      }),
      db.select('communications', {
        eq: { student_id: id },
        order: { column: 'contact_date', ascending: false },
      }),
      db.select('counselor_notes', {
        eq: { student_id: id },
        order: { column: 'created_at', ascending: false },
      }),
      db.select('progress_ratings', {
        eq: { student_id: id },
        order: { column: 'created_at', ascending: true },
      }),
      db.select('crisis_events', {
        eq: { student_id: id },
        order: { column: 'created_at', ascending: false },
      }),
    ]);
    setStudent(stuRes.data);

    // Manually join groups onto group_members (replaces nested select)
    const members = grpRes.data || [];
    if (members.length > 0) {
      const groupIds = [...new Set(members.map((m) => m.group_id).filter(Boolean))];
      const groupMap = {};
      for (const gid of groupIds) {
        const { data: g } = await db.selectById('groups', gid);
        if (g) groupMap[gid] = g;
      }
      for (const m of members) {
        m.groups = groupMap[m.group_id] || null;
      }
    }
    setGroups(members);

    setSessions(sessRes.data || []);
    setComms(commRes.data || []);
    setNotes(noteRes.data || []);
    setProgress(progRes.data || []);
    setCrisisEvents(crisisRes.data || []);

    // Change history for this student: edits to the student record itself,
    // plus edits/deletes of their sessions. Deleted sessions are matched via
    // the snapshot each delete entry carries (the live sessions list no
    // longer knows them).
    try {
      const { data: allHistory } = await db.select('record_history', {});
      const sessionIds = new Set((sessRes.data || []).map((s) => s.id));
      for (const h of allHistory || []) {
        if (h.table_name === 'sessions' && h.action === 'delete' && h.snapshot?.student_id === id) {
          sessionIds.add(h.record_id);
        }
      }
      const mine = (allHistory || [])
        .filter((h) =>
          (h.table_name === 'students' && h.record_id === id) ||
          (h.table_name === 'sessions' && sessionIds.has(h.record_id)))
        .sort((a, b) => (b.at || b.created_at || '').localeCompare(a.at || a.created_at || ''));
      setHistoryEntries(mine);
    } catch {
      setHistoryEntries([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const deleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    await db.del('counselor_notes', noteId);
    loadAll();
  };

  const togglePermissionSlip = async () => {
    if (!student) return;
    const nowOnFile = !student.permission_slip_on_file;
    const today = new Date().toISOString().slice(0, 10);
    const { error: err } = await db.update('students', student.id, {
      permission_slip_on_file: nowOnFile,
      permission_slip_signed_date: nowOnFile ? (student.permission_slip_signed_date || today) : null,
    });
    if (err) {
      alert(err.message || 'Could not update permission slip status.');
      return;
    }
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
            <button
              className="btn btn-outline"
              onClick={() => setShowEditStudent(true)}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              Edit
            </button>
          </div>
        </div>
        {/* Permission slip status row */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={!!student.permission_slip_on_file}
              onChange={togglePermissionSlip}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
              aria-label="Signed permission slip for counseling services on file"
            />
            <span
              style={{
                fontWeight: 600,
                color: student.permission_slip_on_file ? '#15803d' : '#b45309',
              }}
            >
              {student.permission_slip_on_file
                ? '✓ Signed permission slip on file'
                : '⚠ No signed permission slip on file'}
            </span>
            {student.permission_slip_on_file && student.permission_slip_signed_date && (
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                · signed {student.permission_slip_signed_date}
              </span>
            )}
          </label>
          {!student.permission_slip_on_file && (
            <span style={{ fontSize: 12, color: '#b45309' }}>
              Check the box once the signed consent form is received.
            </span>
          )}
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
          onClick={() => {
            setEditContact(null);
            setShowLogContact(true);
          }}
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
          onClick={() => setShowRateProgress(true)}
        >
          Rate Progress
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setExportKind('progress')}
        >
          Export Progress PDF
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setExportKind('mtss')}
        >
          Export MTSS Report
        </button>
      </div>

      {exportKind && (
        <ExportNotesModal
          title={exportKind === 'progress' ? 'Export Progress PDF' : 'Export MTSS Report'}
          onClose={() => setExportKind(null)}
          onConfirm={(info) => {
            if (exportKind === 'progress') generateProgressPDF(student, groups, sessions, info);
            else generateMTSSReport(student, groups, sessions, comms, info);
          }}
        />
      )}

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {[
          ...TABS,
          ...(crisisEvents.length > 0 ? ['Crisis'] : []),
          ...(historyEntries.length > 0 ? ['History'] : []),
        ].map((t) => (
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
                <div
                  key={c.id}
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditContact(c);
                    setShowLogContact(true);
                  }}
                  title="Click to edit"
                >
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
                      {c.contact_date}
                      {c.contact_time ? ` · ${c.contact_time.slice(0, 5)}` : ''}
                      {' · '}{c.duration_minutes} min
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

      {tab === 'Crisis' && (
        <CrisisRecordsSection
          student={student}
          counselor={counselor}
          events={crisisEvents}
          onChanged={loadAll}
        />
      )}

      {tab === 'History' && (
        <RecordHistorySection entries={historyEntries} />
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
          setEditContact(null);
          if (s) loadAll();
        }}
        student={student}
        counselorId={counselor?.id}
        editContact={editContact}
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
      <EditStudentModal
        open={showEditStudent}
        onClose={(s) => {
          setShowEditStudent(false);
          if (s) loadAll();
        }}
        student={student}
      />
      <RateProgressModal
        open={showRateProgress}
        onClose={(s) => {
          setShowRateProgress(false);
          if (s) loadAll();
        }}
        student={student}
        counselorId={counselor?.id}
        groups={groups}
      />
    </div>
  );
}
