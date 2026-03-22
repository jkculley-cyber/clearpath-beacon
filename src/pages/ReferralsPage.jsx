import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { URGENCY_LEVELS, CONCERN_TYPES } from '../lib/constants';

const urgencyColor = { Urgent: '#ef4444', Soon: '#f59e0b', Routine: '#6b7280' };

function AcceptModal({ open, onClose, referral, counselorId, onAccepted }) {
  const [mode, setMode] = useState('individual');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      db.select('groups', { eq: { counselor_id: counselorId, status: 'active' } }).then(({ data }) => setGroups(data || []));
    }
  }, [open, counselorId]);

  if (!open || !referral) return null;

  const handleAccept = async () => {
    setSaving(true);

    // Create student record
    const nameParts = (referral.student_name || '').split(' ');
    const { data: student } = await db.insert('students', {
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

    // Link to group if selected
    if (mode === 'group' && selectedGroup && student) {
      await db.insert('group_members', { group_id: selectedGroup, student_id: student.id });
    }

    // Update referral status
    await db.update('referrals', referral.id, {
      status: 'closed',
      resolution: mode === 'group' ? `Added to group` : 'Individual services',
      response_date: new Date().toISOString().slice(0, 10),
    });

    // Log teacher notification as a communication record
    const teacherName = referral.teacher_name || referral.submitted_by || 'Unknown';
    const assignmentType = mode === 'group' ? 'group counseling' : 'individual services';
    if (student) {
      await db.insert('communications', {
        counselor_id: counselorId,
        student_id: student.id,
        contact_type: 'Written notice',
        notes: `Referral for ${referral.student_name} accepted. Student assigned to ${assignmentType}. Teacher: ${teacherName}`,
        duration_minutes: 5,
        contact_date: new Date().toISOString().slice(0, 10),
      });
    }

    setSaving(false);
    // Notify parent component to show toast
    if (onAccepted) {
      onAccepted({
        studentName: referral.student_name,
        teacherName,
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

        <label className="form-label">Assign To</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button type="button"
            className={mode === 'individual' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('individual')} style={{ flex: 1 }}>
            Individual Services
          </button>
          <button type="button"
            className={mode === 'group' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('group')} style={{ flex: 1 }}>
            Existing Group
          </button>
        </div>

        {mode === 'group' && (
          <>
            <label className="form-label">Select Group</label>
            <select className="form-input" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">Choose a group...</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={saving || (mode === 'group' && !selectedGroup)} style={{ flex: 1 }}>
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

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 12, color: '#6b7280' }}>
          <strong>Google Form tip:</strong> Create a Google Form with these questions, then export responses as CSV:
          <div style={{ fontFamily: 'monospace', marginTop: 6, fontSize: 11, lineHeight: 1.6 }}>
            Student Name, Grade, Teacher Name, Concern Type, Urgency, Notes
          </div>
        </div>

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

// --- Add Referral Modal (for local mode / manual entry) ---
function AddReferralModal({ open, onClose, counselorId }) {
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [concernType, setConcernType] = useState('');
  const [urgency, setUrgency] = useState('Routine');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
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
    await db.insert('referrals', record);
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Add Referral</h3>
        <form onSubmit={handleSubmit}>
          <label className="form-label">Student Name *</label>
          <input className="form-input" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="First and last name" style={{ marginBottom: 10 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
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
function ShareReferralModal({ open, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const referralUrl = `${window.location.origin}/referral-form`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handlePrintPoster = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Referral Form Link</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 60px 40px; }
        h1 { font-size: 36px; font-weight: 800; color: #1a2332; margin-bottom: 16px; }
        .url { font-size: 28px; font-weight: 700; color: #2A9D8F; word-break: break-all; margin: 32px 0; padding: 24px; border: 3px solid #2A9D8F; border-radius: 12px; }
        p { font-size: 18px; color: #6b7280; line-height: 1.6; max-width: 500px; margin: 0 auto; }
        .footer { margin-top: 40px; font-size: 14px; color: #9ca3af; }
      </style>
    </head><body>
      <h1>Need to refer a student to the counselor?</h1>
      <p>Open this link on your phone, tablet, or computer to submit a referral form.</p>
      <div class="url">${referralUrl}</div>
      <p>Fill out the form with the student's name, grade, and concern. The counselor will be notified.</p>
      <div class="footer">Beacon by Clear Path Education Group</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={{ ...modal, width: 500 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Share Referral Form</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
          Share this link with teachers. They can submit referrals from any device.
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Referral Form URL</label>
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

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          <strong>Note:</strong> In local mode, teachers must be on this same device to submit referrals.
          For cross-device referrals, ask teachers to email you or use a Google Form and import via CSV.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={handlePrintPoster} style={{ flex: 1, fontSize: 13 }}>
            Print Poster
          </button>
          <button className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1, fontSize: 13 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const { counselor } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptRef, setAcceptRef] = useState(null);
  const [toast, setToast] = useState(null);
  const [showImport, setShowImport] = useState(false);
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

  // Sort open referrals by urgency
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setShowShare(true)}>
            Share Referral Form
          </button>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowAdd(true)}>
            + Add Referral
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={toastStyle}>
          <div style={{ flex: 1 }}>
            <strong>Referral accepted!</strong> Remember to notify{' '}
            <strong>{toast.teacherName}</strong> that{' '}
            <strong>{toast.studentName}</strong> has been placed in services.
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
          {/* Open Queue */}
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

          {/* History */}
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
        onAccepted={({ studentName, teacherName }) => {
          setToast({ studentName, teacherName });
          setTimeout(() => setToast(null), 15000);
        }}
      />

      <ImportModal
        open={showImport}
        onClose={() => { setShowImport(false); }}
        counselorId={counselor?.id}
        onImported={(count) => {
          setToast({ studentName: `${count} referral${count !== 1 ? 's' : ''}`, teacherName: 'CSV import' });
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
