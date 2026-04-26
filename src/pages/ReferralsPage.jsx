import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { URGENCY_LEVELS, CONCERN_TYPES } from '../lib/constants';

const urgencyColor = { Urgent: '#ef4444', Soon: '#f59e0b', Routine: '#6b7280' };

// ── Helper: parse Beacon referral blocks out of pasted email body ──
function parseReferralEmail(text) {
  const blockPattern = /---\s*BEACON REFERRAL\s*---([\s\S]*?)---\s*END BEACON REFERRAL\s*---/gi;
  const fieldPattern = /^([A-Za-z]+):\s*(.+)$/;
  const out = [];
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    const block = match[1];
    const fields = {};
    block.split(/\r?\n/).forEach((line) => {
      const m = line.trim().match(fieldPattern);
      if (m) fields[m[1].toLowerCase()] = m[2].trim();
    });
    if (fields.student) {
      out.push({
        student_name: fields.student,
        grade: fields.grade || '',
        teacher_name: fields.teacher && fields.teacher !== '(not provided)' ? fields.teacher : '',
        concern_type: fields.concern || 'Academic',
        urgency: ['Routine', 'Soon', 'Urgent'].includes(fields.urgency) ? fields.urgency : 'Routine',
        notes: fields.notes && fields.notes !== '(none)' ? fields.notes : '',
      });
    }
  }
  return out;
}

function AcceptModal({ open, onClose, referral, counselorId, onAccepted }) {
  const [mode, setMode] = useState('individual');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matchedStudent, setMatchedStudent] = useState(null);

  useEffect(() => {
    if (open) {
      setMode('individual');
      setSelectedGroup('');
      // Default to next school day 9am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Skip weekends
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 1);
      setSessionDate(tomorrow.toISOString().slice(0, 10));
      setStartTime('09:00');
      setDuration(30);
      setSaving(false);
      setError('');
      setMatchedStudent(null);
      db.select('groups', { eq: { counselor_id: counselorId, status: 'active' } }).then(({ data }) => setGroups(data || []));
    }
  }, [open, counselorId]);

  if (!open || !referral) return null;

  const computeEndTime = (start, durationMin) => {
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + durationMin;
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  };

  const handleAccept = async () => {
    setSaving(true);
    setError('');

    // Dedup: check if a student with matching name already exists for this counselor
    let student = null;
    const normalizedName = (referral.student_name || '').trim().toLowerCase();
    const { data: existingStudents } = await db.select('students', {
      eq: { counselor_id: counselorId },
    });
    const match = (existingStudents || []).find(
      (s) => (s.name || '').trim().toLowerCase() === normalizedName
    );

    if (match) {
      student = match;
      setMatchedStudent(match);
    } else {
      const nameParts = (referral.student_name || '').split(' ');
      const { data: newStudent, error: insertErr } = await db.insert('students', {
        counselor_id: counselorId,
        name: referral.student_name,
        first_name: nameParts[0] || referral.student_name,
        last_name: nameParts.slice(1).join(' ') || '',
        grade: referral.grade,
        teacher: referral.teacher_name || referral.submitted_by,
        referral_source: referral.concern_type,
        tier: referral.urgency === 'Urgent' ? 3 : referral.urgency === 'Soon' ? 2 : 1,
        status: 'active',
      });
      if (insertErr) {
        setError(insertErr.message || String(insertErr));
        setSaving(false);
        return;
      }
      student = newStudent;
    }

    // Mode-specific actions
    if (mode === 'group' && selectedGroup && student) {
      const { error: gmErr } = await db.insert('group_members', { group_id: selectedGroup, student_id: student.id });
      if (gmErr) {
        setError(gmErr.message || String(gmErr));
        setSaving(false);
        return;
      }
    } else if (mode === 'session' && student) {
      const endTime = computeEndTime(startTime, duration);
      const { error: sErr } = await db.insert('sessions', {
        counselor_id: counselorId,
        student_id: student.id,
        group_id: null,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        status: 'Scheduled',
        session_type: 'individual',
        notes: `From referral: ${referral.concern_type} (${referral.urgency})${referral.notes ? '. ' + referral.notes : ''}`,
      });
      if (sErr) {
        setError(sErr.message || String(sErr));
        setSaving(false);
        return;
      }
    }

    // Update referral status
    const resolutionLabel = mode === 'group'
      ? 'Added to group'
      : mode === 'session'
        ? `Individual session scheduled ${sessionDate} ${startTime}`
        : 'Individual services';

    await db.update('referrals', referral.id, {
      status: 'closed',
      resolution: resolutionLabel,
      response_date: new Date().toISOString().slice(0, 10),
    });

    // Log teacher notification as a communication record
    const teacherName = referral.teacher_name || referral.submitted_by || 'Unknown';
    const assignmentType = mode === 'group'
      ? 'group counseling'
      : mode === 'session'
        ? `an individual session on ${sessionDate} at ${startTime}`
        : 'individual services';
    if (student) {
      const { error: commErr } = await db.insert('communications', {
        counselor_id: counselorId,
        student_id: student.id,
        contact_type: 'Written notice',
        notes: `Referral for ${referral.student_name} accepted. Student assigned to ${assignmentType}. Teacher: ${teacherName}`,
        duration_minutes: 5,
        contact_date: new Date().toISOString().slice(0, 10),
      });
      if (commErr) {
        setError(commErr.message || String(commErr));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    if (onAccepted) {
      onAccepted({
        studentName: referral.student_name,
        teacherName,
        matched: !!match,
        mode,
        sessionDate: mode === 'session' ? sessionDate : null,
      });
    }
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Accept Referral</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          Student: <strong>{referral.student_name}</strong> &middot; {referral.concern_type}
        </p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {matchedStudent && (
          <div style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            Linked to existing student: <strong>{matchedStudent.name}</strong> (Grade {matchedStudent.grade || 'N/A'})
          </div>
        )}

        <label className="form-label">Assign To</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <button type="button"
            className={mode === 'individual' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('individual')} style={{ fontSize: 12, padding: '8px 4px' }}>
            Individual<br />Services
          </button>
          <button type="button"
            className={mode === 'session' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('session')} style={{ fontSize: 12, padding: '8px 4px' }}>
            Schedule<br />1:1 Session
          </button>
          <button type="button"
            className={mode === 'group' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('group')} style={{ fontSize: 12, padding: '8px 4px' }}>
            Existing<br />Group
          </button>
        </div>

        {mode === 'group' && (
          <>
            <label className="form-label">Select Group</label>
            <select className="form-input" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">Choose a group...</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {groups.length === 0 && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -8, marginBottom: 14 }}>
                No active groups yet. Create one in Groups, then come back.
              </p>
            )}
          </>
        )}

        {mode === 'session' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="form-label">Session Date</label>
              <input type="date" className="form-input" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Start Time</label>
              <input type="time" className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Duration</label>
              <select className="form-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={saving || (mode === 'group' && !selectedGroup) || (mode === 'session' && !sessionDate)} style={{ flex: 1 }}>
            {saving ? 'Processing...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- CSV Parser (handles quoted fields with commas) ---
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  }).filter(r => r.student_name);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// --- CSV Import Modal ---
function ImportModal({ open, onClose, counselorId, onImported }) {
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPreview([]);
      setImporting(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) {
        setError('No valid rows found. Make sure the CSV has a "Student Name" column header.');
        return;
      }
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    const validUrgencies = ['Routine', 'Soon', 'Urgent'];
    const records = preview.map(r => ({
      counselor_id: counselorId,
      student_name: r.student_name || r.student || '',
      grade: r.grade || '',
      teacher_name: r.teacher_name || r.teacher || r.your_name || r.submitted_by || '',
      concern_type: r.concern_type || r.concern_category || r.concern || 'Academic',
      urgency: validUrgencies.includes(r.urgency) ? r.urgency : 'Routine',
      notes: r.notes || r.additional_notes || '',
      status: 'open',
    }));

    for (const rec of records) {
      const { error: err } = await db.insert('referrals', rec);
      if (err) { setError(err.message || String(err)); setImporting(false); return; }
    }

    setImporting(false);
    onImported(records.length);
    onClose();
  };

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={{ ...modal, width: 600, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Import Referrals from CSV</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
          Upload a CSV exported from Google Sheets. Required column: <strong>Student Name</strong>.
          Optional columns: Grade, Teacher Name, Concern Type, Urgency, Notes.
        </p>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ marginBottom: 14 }} />

        {preview.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Preview ({preview.length} referral{preview.length !== 1 ? 's' : ''})
            </p>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Grade</th>
                    <th style={thStyle}>Teacher</th>
                    <th style={thStyle}>Concern</th>
                    <th style={thStyle}>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{r.student_name || r.student || '--'}</td>
                      <td style={tdStyle}>{r.grade || '--'}</td>
                      <td style={tdStyle}>{r.teacher_name || r.teacher || r.your_name || '--'}</td>
                      <td style={tdStyle}>{r.concern_type || r.concern_category || '--'}</td>
                      <td style={tdStyle}>{r.urgency || 'Routine'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || preview.length === 0} style={{ flex: 1 }}>
            {importing ? 'Importing...' : `Import ${preview.length} Referral${preview.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Email-Paste Import Modal (paste teacher referral email body → parse → batch insert) ---
function ImportEmailModal({ open, onClose, counselorId, onImported }) {
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPasted('');
      setParsed([]);
      setImporting(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleParse = () => {
    setError('');
    const blocks = parseReferralEmail(pasted);
    if (blocks.length === 0) {
      setError('No referral blocks found. Make sure to paste the email body that includes the "--- BEACON REFERRAL ---" markers.');
      return;
    }
    setParsed(blocks);
  };

  const updateField = (idx, field, value) => {
    setParsed((p) => p.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeBlock = (idx) => {
    setParsed((p) => p.filter((_, i) => i !== idx));
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    for (const r of parsed) {
      const rec = {
        counselor_id: counselorId,
        student_name: r.student_name,
        grade: r.grade,
        teacher_name: r.teacher_name,
        concern_type: r.concern_type,
        urgency: r.urgency,
        notes: r.notes || null,
        status: 'open',
      };
      const { error: err } = await db.insert('referrals', rec);
      if (err) {
        setError(err.message || String(err));
        setImporting(false);
        return;
      }
    }
    setImporting(false);
    onImported(parsed.length);
    onClose();
  };

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={{ ...modal, width: 700, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Import from Email</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
          Paste a teacher's referral email below. You can paste multiple referrals at once — Beacon will detect each
          <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 12, margin: '0 4px' }}>--- BEACON REFERRAL ---</code> block.
        </p>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {parsed.length === 0 ? (
          <>
            <textarea
              className="form-input"
              rows={10}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'Paste the email body here...\n\nExample:\n--- BEACON REFERRAL ---\nStudent: Marcus Johnson\nGrade: 3\nTeacher: Ms. Smith\nConcern: Behavioral\nUrgency: Soon\nNotes: Hitting peers at recess.\n--- END BEACON REFERRAL ---'}
              style={{ marginBottom: 14, fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleParse} disabled={!pasted.trim()} style={{ flex: 1 }}>
                Detect Referrals
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
              Found {parsed.length} referral{parsed.length !== 1 ? 's' : ''}. Review and edit before importing.
            </p>
            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              {parsed.map((r, i) => (
                <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: '#1a2332' }}>Referral {i + 1}</strong>
                    <button onClick={() => removeBlock(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={smallLbl}>Student</label>
                      <input className="form-input" value={r.student_name} onChange={(e) => updateField(i, 'student_name', e.target.value)} style={{ fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={smallLbl}>Grade</label>
                      <input className="form-input" value={r.grade} onChange={(e) => updateField(i, 'grade', e.target.value)} style={{ fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={smallLbl}>Teacher</label>
                      <input className="form-input" value={r.teacher_name} onChange={(e) => updateField(i, 'teacher_name', e.target.value)} style={{ fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={smallLbl}>Concern</label>
                      <select className="form-input" value={r.concern_type} onChange={(e) => updateField(i, 'concern_type', e.target.value)} style={{ fontSize: 13 }}>
                        {CONCERN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={smallLbl}>Urgency</label>
                      <select className="form-input" value={r.urgency} onChange={(e) => updateField(i, 'urgency', e.target.value)} style={{ fontSize: 13 }}>
                        {URGENCY_LEVELS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={smallLbl}>Notes</label>
                      <textarea className="form-input" rows={2} value={r.notes} onChange={(e) => updateField(i, 'notes', e.target.value)} style={{ fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => { setParsed([]); setPasted(''); }} style={{ flex: 1 }}>Back</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing || parsed.length === 0} style={{ flex: 1 }}>
                {importing ? 'Importing...' : `Import ${parsed.length} Referral${parsed.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Add Referral Modal (for local mode / manual entry) ---
function AddReferralModal({ open, onClose, counselorId }) {
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [concernType, setConcernType] = useState('');
  const [urgency, setUrgency] = useState('Routine');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStudentName('');
      setGrade('');
      setTeacherName('');
      setConcernType('');
      setUrgency('Routine');
      setNotes('');
      setSaving(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const record = {
      counselor_id: counselorId,
      student_name: studentName,
      grade,
      teacher_name: teacherName,
      concern_type: concernType,
      urgency,
      notes: notes || null,
      submitted_by: teacherName,
      status: 'open',
    };
    const { error: err } = await db.insert('referrals', record);
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
      <div style={{ ...modal, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Add Referral</h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label className="form-label">Student Name *</label>
          <input className="form-input" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="First and last name" style={{ marginBottom: 10 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Grade</label>
              <select className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Select...</option>
                {['K', '1', '2', '3', '4', '5'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Teacher Name</label>
              <input className="form-input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Referring teacher" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Concern Type *</label>
              <select className="form-input" required value={concernType} onChange={(e) => setConcernType(e.target.value)}>
                <option value="">Select...</option>
                {CONCERN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Urgency</label>
              <select className="form-input" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                {URGENCY_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the concern..." style={{ marginBottom: 14 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Add Referral'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Share Referral Form Modal ---
// Local mode: builds a mailto-relay URL (?to=email&n=name) and renders a QR code.
//             Teacher's submission opens their email client and routes through email — zero Clear Path storage.
// Cloud mode: builds a direct-submit URL (?c=counselor_id) and renders a QR code.
function ShareReferralModal({ open, onClose, counselor, refreshCounselor }) {
  const { isLocalMode: localMode } = useAuth();
  const [copied, setCopied] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (open && counselor) {
      // Initialize email editor with current counselor email (or blank if it's the placeholder)
      setEditEmail(counselor.email && counselor.email !== 'local@beacon.local' ? counselor.email : '');
      setCopied(false);
      setSavingEmail(false);
    }
  }, [open, counselor]);

  if (!open || !counselor) return null;

  const emailIsPlaceholder = !counselor.email || counselor.email === 'local@beacon.local';
  const counselorName = counselor.name || 'your counselor';
  const counselorEmail = counselor.email && !emailIsPlaceholder ? counselor.email : '';

  // Mailto-relay URL for local mode; direct-submit URL for cloud mode
  const referralUrl = localMode
    ? (counselorEmail
        ? `${window.location.origin}/referral-form?to=${encodeURIComponent(counselorEmail)}&n=${encodeURIComponent(counselorName)}`
        : '')
    : `${window.location.origin}/referral-form?c=${counselor.id}`;

  const canShare = !localMode || !!counselorEmail;

  const handleCopy = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    const trimmed = editEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setSavingEmail(false);
      return;
    }
    await db.update('counselor', counselor.id, { email: trimmed });
    setSavingEmail(false);
    if (refreshCounselor) await refreshCounselor();
  };

  const handlePrintPoster = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    // QR code as PNG via a small inline SVG-to-data-URL for the print poster.
    // We render a simple HTML page; the QR code is embedded via a Google Chart fallback link
    // (the print preview shows the QR clearly without needing the React component to mount).
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(referralUrl)}`;
    w.document.write(`<!DOCTYPE html><html><head><title>Referral Form Link</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 60px 40px; }
        h1 { font-size: 36px; font-weight: 800; color: #1a2332; margin-bottom: 16px; }
        h2 { font-size: 22px; font-weight: 600; color: #2A9D8F; margin: 24px 0 12px; }
        .qr { margin: 24px auto; padding: 24px; background: #fff; border: 3px solid #2A9D8F; border-radius: 16px; display: inline-block; }
        .qr img { width: 280px; height: 280px; display: block; }
        .url { font-size: 14px; font-weight: 500; color: #6b7280; word-break: break-all; margin: 12px auto 32px; max-width: 600px; padding: 14px; background: #f9fafb; border-radius: 8px; }
        p { font-size: 18px; color: #6b7280; line-height: 1.6; max-width: 500px; margin: 0 auto 12px; }
        .footer { margin-top: 40px; font-size: 13px; color: #9ca3af; }
        .steps { text-align: left; max-width: 500px; margin: 24px auto; font-size: 15px; color: #374151; line-height: 1.8; }
        .steps li { margin-bottom: 6px; }
      </style>
    </head><body>
      <h1>Need to refer a student?</h1>
      <p>Scan this QR code with your phone, or open the link below.</p>
      <div class="qr"><img src="${qrSrc}" alt="QR code" /></div>
      <h2>${(new URL(referralUrl)).pathname.slice(1) + (new URL(referralUrl)).search}</h2>
      <div class="url">${referralUrl}</div>
      <ol class="steps">
        <li>Fill out the form with the student's name, grade, and concern.</li>
        <li>Tap <strong>Open Email to Send</strong>.</li>
        <li>Your email app will open with the referral pre-filled — tap <strong>Send</strong>.</li>
      </ol>
      <div class="footer">Beacon by Clear Path Education Group &middot; Your referral goes directly to ${counselorName}.</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={{ ...modal, width: 540, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Share Referral Form with Teachers</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
          {localMode
            ? "Teachers fill the form and their email client opens with the referral pre-filled. They click Send, you receive it in your email, then paste it into Beacon's Import from Email."
            : 'Share this link with teachers. They can submit referrals from any device.'}
        </p>

        {localMode && (
          <div style={{ background: emailIsPlaceholder ? '#fffbeb' : '#f0fdfa', border: `1px solid ${emailIsPlaceholder ? '#fde68a' : '#a7f3d0'}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: emailIsPlaceholder ? '#92400e' : '#0d9488', display: 'block', marginBottom: 6 }}>
              {emailIsPlaceholder ? '⚠ Set your email to enable referrals' : 'Your referral inbox'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="you@yourschool.org"
                style={{ flex: 1, fontSize: 13 }}
              />
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                onClick={handleSaveEmail}
                disabled={savingEmail || !editEmail.trim() || editEmail === counselorEmail}
              >
                {savingEmail ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
              Teachers' referrals will be emailed here. No data is stored on Clear Path servers — referrals only exist in your inbox and your local Beacon device.
            </p>
          </div>
        )}

        {canShare && referralUrl && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Referral Form URL</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="form-input"
                value={referralUrl}
                readOnly
                onClick={(e) => e.target.select()}
                style={{ flex: 1, fontSize: 13, fontFamily: 'monospace' }}
              />
              <button className="btn btn-primary" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, padding: 16, background: '#fff', border: '2px solid #2A9D8F', borderRadius: 12 }}>
              <QRCodeSVG value={referralUrl} size={180} level="M" includeMargin={false} fgColor="#1a2332" />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={handlePrintPoster} style={{ flex: 1, fontSize: 13 }}>
                Print Poster (with QR)
              </button>
              <button className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1, fontSize: 13 }}>
                Close
              </button>
            </div>
          </>
        )}

        {!canShare && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
            Set your email above to generate a teacher referral link and QR code.
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const { counselor, refreshCounselor } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptRef, setAcceptRef] = useState(null);
  const [toast, setToast] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showImportEmail, setShowImportEmail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const loadReferrals = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const { data } = await db.select('referrals', {
      eq: { counselor_id: counselor.id },
      order: { column: 'created_at', ascending: false },
    });
    setReferrals(data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const openRefs = referrals.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const closedRefs = referrals.filter((r) => r.status === 'closed' || r.status === 'deferred');

  const urgencyOrder = { Urgent: 0, Soon: 1, Routine: 2 };
  openRefs.sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));

  const daysOpen = (ref) => {
    const created = new Date(ref.created_at);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  };

  const handleDefer = async (ref) => {
    const changes = { status: 'deferred', response_date: new Date().toISOString().slice(0, 10) };
    await db.update('referrals', ref.id, changes);
    loadReferrals();
  };

  const handleClose = async (ref) => {
    const changes = { status: 'closed', resolution: 'Closed without action', response_date: new Date().toISOString().slice(0, 10) };
    await db.update('referrals', ref.id, changes);
    loadReferrals();
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Referrals</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setShowShare(true)}>
            Share Form
          </button>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setShowImportEmail(true)}>
            Import from Email
          </button>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowAdd(true)}>
            + Add Referral
          </button>
        </div>
      </div>

      {toast && (
        <div style={toastStyle}>
          <div style={{ flex: 1 }}>
            <strong>{toast.title || 'Referral accepted!'}</strong> {toast.detail || (
              <>Remember to notify <strong>{toast.teacherName}</strong> that <strong>{toast.studentName}</strong> has been placed in services.</>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700, fontSize: 18, padding: '0 4px', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          <h2 style={sectionTitle}>Open Referrals ({openRefs.length})</h2>
          {openRefs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--text-muted)' }}>No pending referrals. Nice work!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
              {openRefs.map((r) => (
                <div key={r.id} className="card" style={{ borderLeft: `4px solid ${urgencyColor[r.urgency] || '#6b7280'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1a2332', fontSize: 16 }}>{r.student_name}</span>
                      <span style={{
                        marginLeft: 10, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: (urgencyColor[r.urgency] || '#6b7280') + '20',
                        color: urgencyColor[r.urgency] || '#6b7280',
                      }}>{r.urgency}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{daysOpen(r)} day{daysOpen(r) !== 1 ? 's' : ''} open</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                    <span>{r.concern_type}</span>
                    {(r.teacher_name || r.submitted_by) && <span> &middot; From: {r.teacher_name || r.submitted_by}</span>}
                    {r.created_at && <span> &middot; {r.created_at.slice(0, 10)}</span>}
                  </div>
                  {r.notes && <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 10px' }}>{r.notes}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => setAcceptRef(r)}>Accept</button>
                    <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => handleDefer(r)}>Defer</button>
                    <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: 13, color: '#9ca3af' }} onClick={() => handleClose(r)}>Close</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={sectionTitle}>History</h2>
          {closedRefs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No closed referrals.</p>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Concern</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Resolution</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRefs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{r.student_name}</td>
                      <td style={tdStyle}>{r.concern_type}</td>
                      <td style={tdStyle}><span style={{ textTransform: 'capitalize' }}>{r.status}</span></td>
                      <td style={tdStyle}>{r.resolution || '--'}</td>
                      <td style={tdStyle}>{r.response_date?.slice(0, 10) || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AcceptModal
        open={!!acceptRef}
        onClose={(done) => { setAcceptRef(null); if (done) loadReferrals(); }}
        referral={acceptRef}
        counselorId={counselor?.id}
        onAccepted={({ studentName, teacherName, mode, sessionDate }) => {
          const detail = mode === 'session'
            ? <>Individual session for <strong>{studentName}</strong> scheduled <strong>{sessionDate}</strong>. Notify <strong>{teacherName}</strong>.</>
            : mode === 'group'
              ? <>Added <strong>{studentName}</strong> to a group. Notify <strong>{teacherName}</strong>.</>
              : <>Remember to notify <strong>{teacherName}</strong> that <strong>{studentName}</strong> has been placed in services.</>;
          setToast({ title: 'Referral accepted!', detail, studentName, teacherName });
          setTimeout(() => setToast(null), 15000);
        }}
      />

      <ImportModal
        open={showImport}
        onClose={() => { setShowImport(false); }}
        counselorId={counselor?.id}
        onImported={(count) => {
          setToast({ title: 'CSV imported!', detail: `${count} referral${count !== 1 ? 's' : ''} added to the open queue.` });
          setTimeout(() => setToast(null), 8000);
          loadReferrals();
        }}
      />

      <ImportEmailModal
        open={showImportEmail}
        onClose={() => { setShowImportEmail(false); }}
        counselorId={counselor?.id}
        onImported={(count) => {
          setToast({ title: 'Email referrals imported!', detail: `${count} referral${count !== 1 ? 's' : ''} added to the open queue.` });
          setTimeout(() => setToast(null), 8000);
          loadReferrals();
        }}
      />

      <AddReferralModal
        open={showAdd}
        onClose={(saved) => { setShowAdd(false); if (saved) loadReferrals(); }}
        counselorId={counselor?.id}
      />

      <ShareReferralModal
        open={showShare}
        onClose={() => setShowShare(false)}
        counselor={counselor}
        refreshCounselor={refreshCounselor}
      />
    </div>
  );
}

const toastStyle = {
  background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8,
  padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#065f46',
  display: 'flex', alignItems: 'flex-start', gap: 12,
};
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' };
const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px' };
const smallLbl = { fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 };
