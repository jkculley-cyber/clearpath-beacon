import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';

/* ─── Constants ─── */

const DOMAINS = [
  { key: 'academic', label: 'Academic', icon: '\u{1F4DA}' },
  { key: 'behavioral', label: 'Behavioral', icon: '\u{1F9E9}' },
  { key: 'social_emotional', label: 'Social-Emotional', icon: '\u{1F49B}' },
  { key: 'attendance', label: 'Attendance', icon: '\u{1F4C5}' },
  { key: 'family', label: 'Family', icon: '\u{1F3E0}' },
];

const SCORE_LABELS = {
  1: 'Critical need',
  2: 'Significant need',
  3: 'Moderate need',
  4: 'Mild need',
  5: 'No concern',
};

function computeTier(domains) {
  const scores = DOMAINS.map((d) => domains[d.key]?.score).filter((s) => s != null && s > 0);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg <= 2.0) return 3;
  if (avg <= 3.5) return 2;
  return 1;
}

function computeAvg(domains) {
  const scores = DOMAINS.map((d) => domains[d.key]?.score).filter((s) => s != null && s > 0);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function scoreColor(score) {
  if (score <= 2) return '#ef4444';
  if (score === 3) return '#f59e0b';
  return '#22c55e';
}

function tierColor(tier) {
  if (tier === 3) return '#ef4444';
  if (tier === 2) return '#f59e0b';
  return '#22c55e';
}

function tierLabel(tier) {
  if (tier === 3) return 'Tier 3';
  if (tier === 2) return 'Tier 2';
  if (tier === 1) return 'Tier 1';
  return '--';
}

const sName = (s) => s?.name || 'Unknown';

/* ─── Student Search Component ─── */

function StudentSearch({ counselorId, value, onChange }) {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!counselorId) return;
    db.select('students', { eq: { counselor_id: counselorId } }).then(({ data }) => {
      setStudents(data || []);
    });
  }, [counselorId]);

  const filtered = query.trim()
    ? students.filter((s) => (s.name || '').toLowerCase().includes(query.toLowerCase()))
    : students;

  const selected = value ? students.find((s) => s.id === value) : null;

  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={formLabel}>Student *</label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#f9fafb', fontSize: 14, color: '#1a2332',
          }}>
            {sName(selected)} {selected.grade ? `(Grade ${selected.grade})` : ''}
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#9ca3af', padding: '4px 8px',
            }}
          >
            &times;
          </button>
        </div>
      ) : (
        <>
          <input
            style={inputStyle}
            placeholder="Search student by name..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && filtered.length > 0 && (
            <div style={dropdownStyle}>
              {filtered.slice(0, 20).map((s) => (
                <div
                  key={s.id}
                  style={dropdownItem}
                  onMouseDown={() => { onChange(s.id); setQuery(''); setOpen(false); }}
                >
                  <span style={{ fontWeight: 600, color: '#1a2332' }}>{sName(s)}</span>
                  {s.grade && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>Grade {s.grade}</span>}
                  {s.tier && (
                    <span style={{
                      marginLeft: 8, padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: tierColor(s.tier) + '20', color: tierColor(s.tier),
                    }}>
                      T{s.tier}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {open && query.trim() && filtered.length === 0 && (
            <div style={{ ...dropdownStyle, padding: '10px 14px', color: '#9ca3af', fontSize: 13 }}>
              No students found
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Domain Score Card ─── */

function DomainCard({ domain, value, onChange }) {
  const score = value?.score || 0;
  const notes = value?.notes || '';

  return (
    <div style={{
      flex: '1 1 170px', minWidth: 170, background: '#fff', borderRadius: 10,
      border: score > 0 ? `2px solid ${scoreColor(score)}` : '2px solid #e5e7eb',
      padding: 16, transition: 'border-color 0.2s',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textAlign: 'center' }}>
        <span style={{ fontSize: 18, marginRight: 4 }}>{domain.icon}</span>
        {domain.label}
      </div>

      {/* Score radio buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ ...value, score: s, notes })}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
              background: score === s ? scoreColor(s) : '#f3f4f6',
              color: score === s ? '#fff' : '#6b7280',
              boxShadow: score === s ? `0 2px 8px ${scoreColor(s)}40` : 'none',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Score label */}
      <div style={{
        textAlign: 'center', fontSize: 11, fontWeight: 600, minHeight: 16, marginBottom: 8,
        color: score > 0 ? scoreColor(score) : '#9ca3af',
      }}>
        {score > 0 ? SCORE_LABELS[score] : 'Not scored'}
      </div>

      {/* Notes */}
      <textarea
        placeholder="Notes..."
        value={notes}
        onChange={(e) => onChange({ ...value, score, notes: e.target.value })}
        rows={2}
        style={{
          width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px',
          fontSize: 12, resize: 'vertical', fontFamily: 'inherit', color: '#374151',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/* ─── Tier Badge ─── */

function TierBadge({ tier, size = 'normal' }) {
  if (!tier) return <span style={{ color: '#9ca3af', fontSize: size === 'large' ? 16 : 13 }}>--</span>;
  const bg = tierColor(tier) + '18';
  const fg = tierColor(tier);
  const isLarge = size === 'large';
  return (
    <span style={{
      display: 'inline-block', padding: isLarge ? '6px 16px' : '2px 10px',
      borderRadius: isLarge ? 10 : 12, fontSize: isLarge ? 16 : 12,
      fontWeight: 700, background: bg, color: fg,
      border: `1.5px solid ${fg}30`,
    }}>
      {tierLabel(tier)}
    </span>
  );
}

/* ─── New / Edit Assessment Modal ─── */

function AssessmentModal({ open, onClose, counselorId, existing, onSaved }) {
  const isEdit = !!existing;

  const makeDomainDefaults = () =>
    Object.fromEntries(DOMAINS.map((d) => [d.key, { score: 0, notes: '' }]));

  const [studentId, setStudentId] = useState('');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [domains, setDomains] = useState(makeDomainDefaults);
  const [interventions, setInterventions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate when editing
  useEffect(() => {
    if (open && existing) {
      setStudentId(existing.student_id || '');
      setAssessmentDate(existing.assessment_date || '');
      const d = {};
      for (const dom of DOMAINS) {
        d[dom.key] = existing[dom.key] || { score: 0, notes: '' };
      }
      setDomains(d);
      setInterventions(existing.recommended_interventions || '');
    } else if (open && !existing) {
      setStudentId('');
      setAssessmentDate(new Date().toISOString().slice(0, 10));
      setDomains(makeDomainDefaults());
      setInterventions('');
    }
    if (open) setError('');
  }, [open, existing]);

  if (!open) return null;

  const tier = computeTier(domains);
  const avg = computeAvg(domains);
  const allScored = DOMAINS.every((d) => domains[d.key]?.score > 0);

  const handleSave = async (status) => {
    if (!studentId) { setError('Please select a student.'); return; }
    if (status === 'complete' && !allScored) { setError('Please score all domains before completing.'); return; }

    setSaving(true);
    setError('');

    const record = {
      counselor_id: counselorId,
      student_id: studentId,
      assessment_date: assessmentDate || new Date().toISOString().slice(0, 10),
      recommended_tier: tier,
      recommended_interventions: interventions || null,
      status,
      updated_at: new Date().toISOString(),
    };

    // Add domain objects
    for (const d of DOMAINS) {
      record[d.key] = domains[d.key];
    }

    if (isEdit) {
      const { error: err } = await db.update('needs_assessments', existing.id, record);
      if (err) { setError(err.message || String(err)); setSaving(false); return; }
    } else {
      record.created_at = new Date().toISOString();
      const { error: err } = await db.insert('needs_assessments', record);
      if (err) { setError(err.message || String(err)); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalLarge} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>
            {isEdit ? 'Edit Assessment' : 'New Needs Assessment'}
          </h3>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {/* Student + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>
          <StudentSearch counselorId={counselorId} value={studentId} onChange={setStudentId} />
          <div>
            <label style={formLabel}>Date</label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              style={{ ...inputStyle, width: 160 }}
            />
          </div>
        </div>

        {/* Scoring Guide */}
        <div style={{
          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#115e59', marginBottom: 16, lineHeight: 1.6,
        }}>
          <strong>Scoring:</strong> 1 = Critical need &middot; 2 = Significant &middot; 3 = Moderate &middot; 4 = Mild &middot; 5 = No concern
        </div>

        {/* Domain Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {DOMAINS.map((d) => (
            <DomainCard
              key={d.key}
              domain={d}
              value={domains[d.key]}
              onChange={(val) => setDomains((prev) => ({ ...prev, [d.key]: val }))}
            />
          ))}
        </div>

        {/* Tier Result */}
        <div style={{
          background: tier ? tierColor(tier) + '08' : '#f9fafb',
          border: `1.5px solid ${tier ? tierColor(tier) + '40' : '#e5e7eb'}`,
          borderRadius: 10, padding: '16px 20px', marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Recommended Tier
          </div>
          <TierBadge tier={tier} size="large" />
          {avg != null && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Average score: <strong>{avg.toFixed(2)}</strong>
            </div>
          )}
        </div>

        {/* Interventions */}
        <div style={{ marginBottom: 20 }}>
          <label style={formLabel}>Recommended Interventions</label>
          <textarea
            value={interventions}
            onChange={(e) => setInterventions(e.target.value)}
            rows={3}
            placeholder="Describe recommended interventions, strategies, or next steps..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnOutline, flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            style={{ ...btnOutline, flex: 1, borderColor: '#f59e0b', color: '#f59e0b' }}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('complete')}
            disabled={saving || !allScored}
            style={{
              ...btnPrimary, flex: 1,
              opacity: (!allScored || saving) ? 0.5 : 1,
              cursor: (!allScored || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal (read-only with edit option) ─── */

function DetailModal({ open, onClose, assessment, students, onEdit, onDelete }) {
  if (!open || !assessment) return null;
  const student = students.find((s) => s.id === assessment.student_id);
  const avg = computeAvg(assessment);

  const handleDelete = async () => {
    if (!window.confirm('Delete this assessment? This cannot be undone.')) return;
    const { error: err } = await db.del('needs_assessments', assessment.id);
    if (err) { alert(err.message || String(err)); return; }
    onDelete();
    onClose();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalLarge} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>
            Assessment Detail
          </h3>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {/* Student Info */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1a2332' }}>{sName(student)}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {student?.grade ? `Grade ${student.grade}` : ''}{' '}
              &middot; {assessment.assessment_date || '--'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <TierBadge tier={assessment.recommended_tier} size="large" />
            {avg != null && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Avg: {avg.toFixed(2)}</div>
            )}
          </div>
        </div>

        {/* Domain Scores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          {DOMAINS.map((d) => {
            const val = assessment[d.key] || {};
            const s = val.score || 0;
            return (
              <div key={d.key} style={{
                background: '#fff', border: `1.5px solid ${s > 0 ? scoreColor(s) + '60' : '#e5e7eb'}`,
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {d.icon} {d.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-block', width: 28, height: 28, borderRadius: '50%', textAlign: 'center',
                    lineHeight: '28px', fontWeight: 700, fontSize: 14,
                    background: s > 0 ? scoreColor(s) : '#e5e7eb',
                    color: s > 0 ? '#fff' : '#9ca3af',
                  }}>
                    {s || '-'}
                  </span>
                  <span style={{ fontSize: 12, color: s > 0 ? scoreColor(s) : '#9ca3af', fontWeight: 600 }}>
                    {s > 0 ? SCORE_LABELS[s] : 'Not scored'}
                  </span>
                </div>
                {val.notes && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>
                    {val.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Interventions */}
        {assessment.recommended_interventions && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Recommended Interventions</div>
            <div style={{
              background: '#f9fafb', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#4b5563', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {assessment.recommended_interventions}
            </div>
          </div>
        )}

        {/* Status + metadata */}
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
          Status: <span style={{
            textTransform: 'capitalize', fontWeight: 600,
            color: assessment.status === 'complete' ? '#22c55e' : '#f59e0b',
          }}>
            {assessment.status}
          </span>
          {assessment.created_at && <span> &middot; Created: {assessment.created_at.slice(0, 10)}</span>}
          {assessment.updated_at && <span> &middot; Updated: {assessment.updated_at.slice(0, 10)}</span>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={handleDelete} style={{ ...btnOutline, color: '#ef4444', borderColor: '#fecaca' }}>
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={btnOutline}>Close</button>
          <button type="button" onClick={() => { onEdit(assessment); onClose(); }} style={btnPrimary}>Edit</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function NeedsAssessmentPage() {
  const { counselor } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const [aRes, sRes] = await Promise.all([
      db.select('needs_assessments', {
        eq: { counselor_id: counselor.id },
        order: { column: 'assessment_date', ascending: false },
      }),
      db.select('students', { eq: { counselor_id: counselor.id } }),
    ]);
    setAssessments(aRes.data || []);
    setStudents(sRes.data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadData(); }, [loadData]);

  // Summary stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thisMonth = assessments.filter((a) => (a.assessment_date || a.created_at || '') >= monthStart);
  const completed = assessments.filter((a) => a.status === 'complete');
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  for (const a of completed) {
    if (a.recommended_tier >= 1 && a.recommended_tier <= 3) {
      tierCounts[a.recommended_tier]++;
    }
  }

  const findStudent = (id) => students.find((s) => s.id === id);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Needs Assessments</h1>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowNew(true); }}>
          + New Assessment
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {/* This Month */}
        <div style={summaryCard}>
          <div style={summaryValue}>{thisMonth.length}</div>
          <div style={summaryLabel}>This Month</div>
        </div>
        {/* Total Assessments */}
        <div style={summaryCard}>
          <div style={summaryValue}>{assessments.length}</div>
          <div style={summaryLabel}>Total</div>
        </div>
        {/* Tier Distribution */}
        <div style={{ ...summaryCard, background: '#f0fdf4' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#22c55e' }}>{tierCounts[1]}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>T1</span>
          </div>
          <div style={summaryLabel}>Tier 1</div>
        </div>
        <div style={{ ...summaryCard, background: '#fffbeb' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#f59e0b' }}>{tierCounts[2]}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>T2</span>
          </div>
          <div style={summaryLabel}>Tier 2</div>
        </div>
        <div style={{ ...summaryCard, background: '#fef2f2' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#ef4444' }}>{tierCounts[3]}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>T3</span>
          </div>
          <div style={summaryLabel}>Tier 3</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : assessments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
            No needs assessments yet. Click "+ New Assessment" to get started.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Student</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Acad</th>
                <th style={thStyle}>Behav</th>
                <th style={thStyle}>SEL</th>
                <th style={thStyle}>Attend</th>
                <th style={thStyle}>Family</th>
                <th style={thStyle}>Avg</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const student = findStudent(a.student_id);
                const avg = computeAvg(a);
                return (
                  <tr
                    key={a.id}
                    onClick={() => setDetailItem(a)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: '#1a2332' }}>{sName(student)}</span>
                    </td>
                    <td style={tdStyle}>{a.assessment_date || '--'}</td>
                    {DOMAINS.map((d) => {
                      const s = a[d.key]?.score || 0;
                      return (
                        <td key={d.key} style={{ ...tdStyle, textAlign: 'center' }}>
                          {s > 0 ? (
                            <span style={{
                              display: 'inline-block', width: 24, height: 24, borderRadius: '50%',
                              lineHeight: '24px', fontSize: 12, fontWeight: 700, textAlign: 'center',
                              background: scoreColor(s) + '20', color: scoreColor(s),
                            }}>
                              {s}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>-</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: avg ? scoreColor(Math.round(avg)) : '#d1d5db' }}>
                      {avg != null ? avg.toFixed(1) : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <TierBadge tier={a.recommended_tier} />
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                        fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                        background: a.status === 'complete' ? '#dcfce7' : '#fef9c3',
                        color: a.status === 'complete' ? '#166534' : '#854d0e',
                      }}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AssessmentModal
        open={showNew}
        onClose={() => { setShowNew(false); setEditItem(null); }}
        counselorId={counselor?.id}
        existing={editItem}
        onSaved={loadData}
      />

      <DetailModal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        assessment={detailItem}
        students={students}
        onEdit={(a) => { setEditItem(a); setShowNew(true); }}
        onDelete={loadData}
      />
    </div>
  );
}

/* ─── Shared Styles ─── */

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalLarge = {
  background: '#fff', borderRadius: 14, padding: 28, width: 720,
  maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
};

const closeBtn = {
  background: 'none', border: 'none', fontSize: 22, color: '#9ca3af',
  cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
};

const formLabel = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280',
  marginBottom: 4,
};

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 14, color: '#1a2332', fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimary = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#2A9D8F', color: '#fff', fontWeight: 600, fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit',
};

const btnOutline = {
  padding: '8px 18px', borderRadius: 8, border: '1.5px solid #d1d5db',
  background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit',
};

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
  background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
  maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
};

const dropdownItem = {
  padding: '8px 12px', cursor: 'pointer', fontSize: 14,
  borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s',
};

const summaryCard = {
  background: '#fff', borderRadius: 10, padding: '16px 12px',
  textAlign: 'center', border: '1px solid #e5e7eb',
};

const summaryValue = {
  fontSize: 22, fontWeight: 700, color: '#1a2332', marginBottom: 2,
};

const summaryLabel = {
  fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const thStyle = {
  padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3,
};

const tdStyle = {
  padding: '10px 12px',
};
