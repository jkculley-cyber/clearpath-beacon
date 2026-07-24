import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { isSecondaryServed } from '../lib/constants';

/* ─── College/Career/Military-Readiness advising log (secondary) ───
 * Documents post-secondary advising touches. Beacon's lane is documentation,
 * not scheduling/SIS — this records WHAT was advised, WHEN, and the next step,
 * so a counselor has a defensible, exportable record of CCMR work. */

const CATEGORIES = [
  { key: 'college_app', label: 'College Application' },
  { key: 'financial_aid', label: 'FAFSA / Financial Aid' },
  { key: 'dual_credit', label: 'Dual Credit / AP / IB' },
  { key: 'cte_cert', label: 'CTE / Industry Certification' },
  { key: 'military', label: 'Military / ASVAB' },
  { key: 'testing', label: 'TSI / SAT / ACT' },
  { key: 'endorsement', label: 'Endorsement / Graduation Plan' },
  { key: 'scholarship', label: 'Scholarships' },
  { key: 'career', label: 'Career Exploration' },
  { key: 'resume', label: 'Resume / Job Readiness' },
  { key: 'other', label: 'Other' },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const STATUSES = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'complete', label: 'Complete' },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
const STATUS_COLOR = { planned: '#f59e0b', in_progress: '#3b82f6', complete: '#22c55e' };

const sName = (s) => s?.name || (s?.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : 'Unknown');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const card = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' };
const badge = (bg, color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color });

function AdvisingModal({ open, onClose, students, entry, counselorId }) {
  const isEdit = !!entry;
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('college_app');
  const [status, setStatus] = useState('planned');
  const [advisingDate, setAdvisingDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextStepDate, setNextStepDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setStudentId(entry.student_id || '');
      setCategory(entry.category || 'college_app');
      setStatus(entry.status || 'planned');
      setAdvisingDate(entry.advising_date || todayStr());
      setNotes(entry.notes || '');
      setNextStep(entry.next_step || '');
      setNextStepDate(entry.next_step_date || '');
    } else {
      setStudentId(''); setCategory('college_app'); setStatus('planned');
      setAdvisingDate(todayStr()); setNotes(''); setNextStep(''); setNextStepDate('');
    }
    setError('');
  }, [entry, open]);

  if (!open) return null;

  const save = async () => {
    if (!studentId) { setError('Please choose a student.'); return; }
    setSaving(true);
    setError('');
    const student = students.find((s) => s.id === studentId);
    const payload = {
      student_id: studentId,
      student_name: sName(student),
      category, status,
      advising_date: advisingDate || null,
      notes: notes.trim(),
      next_step: nextStep.trim(),
      next_step_date: nextStepDate || null,
    };
    const { error: dbErr } = isEdit
      ? await db.update('ccmr_advising', entry.id, payload)
      : await db.insert('ccmr_advising', { counselor_id: counselorId, ...payload });
    setSaving(false);
    if (dbErr) { setError(dbErr.message || 'Could not save.'); return; }
    onClose(true);
  };

  const del = async () => {
    setSaving(true);
    await db.del('ccmr_advising', entry.id);
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>
          {isEdit ? 'Edit Advising Entry' : 'Log Advising'}
        </h3>

        <label className="form-label">Student *</label>
        <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">Select student...</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{sName(s)}{s.grade ? ` — Grade ${s.grade}` : ''}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">Category</label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <label className="form-label">Date advised</label>
        <input className="form-input" type="date" value={advisingDate} onChange={(e) => setAdvisingDate(e.target.value)} style={{ marginBottom: 12 }} />

        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed / advised" style={{ marginBottom: 12 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <label className="form-label">Next step</label>
            <input className="form-input" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Submit application by…" />
          </div>
          <div>
            <label className="form-label">By</label>
            <input className="form-input" type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {isEdit ? (
            <button className="btn" onClick={del} disabled={saving} style={{ color: '#ef4444', border: '1px solid #fecaca', background: '#fff' }}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => onClose(false)} disabled={saving} style={{ border: '1px solid #d1d5db', background: '#fff' }}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Advising'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CcmrPage() {
  const { counselor } = useAuth();
  const [entries, setEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const { data: rows } = await db.select('ccmr_advising', {
      eq: { counselor_id: counselor.id },
      order: { column: 'advising_date', ascending: false },
    });
    const { data: studentRows } = await db.select('students', {
      eq: { counselor_id: counselor.id },
      order: { column: 'name', ascending: true },
    });
    setEntries(rows || []);
    setStudents(studentRows || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => entries.filter((e) =>
    (filterCat === 'all' || e.category === filterCat) &&
    (filterStatus === 'all' || e.status === filterStatus)
  ), [entries, filterCat, filterStatus]);

  const stats = useMemo(() => {
    const total = entries.length;
    const complete = entries.filter((e) => e.status === 'complete').length;
    const openNext = entries.filter((e) => e.next_step && e.status !== 'complete').length;
    const studentsAdvised = new Set(entries.map((e) => e.student_id)).size;
    return { total, complete, openNext, studentsAdvised };
  }, [entries]);

  if (!isSecondaryServed(counselor)) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2332' }}>Post-Secondary Advising</h1>
        <div style={{ ...card, marginTop: 16, color: '#6b7280' }}>
          The CCMR / post-secondary advising log is designed for middle and high school counselors.
          Change your grade band in <strong>Settings</strong> to enable it.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2332', margin: 0 }}>Post-Secondary Advising</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            Document college, career, and military-readiness advising — a defensible record of your CCMR work.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Log Advising</button>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '18px 0' }}>
        {[
          { label: 'Advising entries', value: stats.total },
          { label: 'Students advised', value: stats.studentsAdvised },
          { label: 'Open next steps', value: stats.openNext, color: '#f59e0b' },
          { label: 'Completed', value: stats.complete, color: '#22c55e' },
        ].map((t) => (
          <div key={t.label} style={card}>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.color || '#1a2332' }}>{t.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="form-input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: '#9ca3af', padding: 20 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, color: '#6b7280', textAlign: 'center', padding: 40 }}>
          {entries.length === 0
            ? 'No advising logged yet. Click “Log Advising” to record your first post-secondary conversation.'
            : 'No entries match these filters.'}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Student</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Next step</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => setEditEntry(e)} style={{ borderTop: '1px solid #f0f0f0', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtDate(e.advising_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{e.student_name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{CAT_LABEL[e.category] || e.category}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={badge('#f3f4f6', STATUS_COLOR[e.status] || '#6b7280')}>{STATUS_LABEL[e.status] || e.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#4b5563' }}>
                    {e.next_step ? <>{e.next_step}{e.next_step_date ? <span style={{ color: '#9ca3af' }}> · {fmtDate(e.next_step_date)}</span> : null}</> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdvisingModal
        open={showNew}
        onClose={(changed) => { setShowNew(false); if (changed) loadData(); }}
        students={students}
        entry={null}
        counselorId={counselor?.id}
      />
      <AdvisingModal
        open={!!editEntry}
        onClose={(changed) => { setEditEntry(null); if (changed) loadData(); }}
        students={students}
        entry={editEntry}
        counselorId={counselor?.id}
      />
    </div>
  );
}
