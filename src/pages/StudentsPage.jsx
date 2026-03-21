import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MTSS_TIERS, STUDENT_STATUSES, CONCERN_TYPES } from '../lib/constants';

const GRADES = ['K', '1', '2', '3', '4', '5'];

function AddStudentModal({ open, onClose, counselorId }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacher, setTeacher] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [tier, setTier] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('students').insert({
      counselor_id: counselorId,
      name: (firstName + ' ' + lastName).trim(),
      first_name: firstName,
      last_name: lastName,
      grade: grade || null,
      teacher,
      referral_source: referralSource,
      tier: parseInt(tier, 10),
      status: 'active',
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>Add Student</h3>
        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">First Name *</label>
              <input className="form-input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input className="form-input" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
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
          <label className="form-label">Referral Source</label>
          <select className="form-input" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} style={{ marginBottom: 16 }}>
            <option value="">Select...</option>
            {CONCERN_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { counselor } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showAdd, setShowAdd] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    let q = supabase
      .from('students')
      .select('*, sessions:sessions(id)')
      .eq('counselor_id', counselor.id)
      .order('name');

    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterGrade) q = q.eq('grade', filterGrade);
    if (filterTier) q = q.eq('tier', parseInt(filterTier, 10));

    const { data } = await q;
    setStudents(data || []);
    setLoading(false);
  }, [counselor, filterStatus, filterGrade, filterTier]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const studentName = (s) => s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || '');

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return studentName(s).toLowerCase().includes(q) || (s.teacher || '').toLowerCase().includes(q);
  });

  const tierBadge = (t) => {
    const colors = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
        background: (colors[t] || '#9ca3af') + '20', color: colors[t] || '#9ca3af',
      }}>
        Tier {t}
      </span>
    );
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Students</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Student</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by name or teacher..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="form-input" value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={{ width: 120 }}>
          <option value="">All Grades</option>
          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select className="form-input" value={filterTier} onChange={(e) => setFilterTier(e.target.value)} style={{ width: 120 }}>
          <option value="">All Tiers</option>
          {MTSS_TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
        </select>
        <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 130 }}>
          <option value="">All Statuses</option>
          {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Grade</th>
                <th style={thStyle}>Teacher</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: '#1a2332' }}>{studentName(s)}</span>
                  </td>
                  <td style={tdStyle}>{s.grade || '--'}</td>
                  <td style={tdStyle}>{s.teacher || '--'}</td>
                  <td style={tdStyle}>{tierBadge(s.tier)}</td>
                  <td style={tdStyle}>
                    <span style={{ textTransform: 'capitalize', color: s.status === 'active' ? '#22c55e' : '#9ca3af' }}>{s.status}</span>
                  </td>
                  <td style={tdStyle}>{s.sessions?.length || 0}</td>
                  <td style={tdStyle}>{s.last_seen_date || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddStudentModal
        open={showAdd}
        onClose={(created) => { setShowAdd(false); if (created) loadStudents(); }}
        counselorId={counselor?.id}
      />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '10px 14px' };
