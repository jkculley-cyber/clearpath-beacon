import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { ASCA_DOMAINS } from '../lib/constants';

/* ─── Helpers ─── */

const sName = (s) =>
  s?.name || (s?.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : 'Unknown');

const STATUS_OPTIONS = ['active', 'met', 'not_met', 'discontinued'];

const STATUS_LABELS = {
  active: 'Active',
  met: 'Met',
  not_met: 'Not Met',
  discontinued: 'Discontinued',
};

const STATUS_COLORS = {
  active: '#f59e0b',
  met: '#22c55e',
  not_met: '#ef4444',
  discontinued: '#9ca3af',
};

const DOMAIN_COLORS = {
  Academic: '#3b82f6',
  Career: '#8b5cf6',
  'Social-Emotional': '#2A9D8F',
};

const FILTER_TABS = ['All', 'Active', 'Met', 'Discontinued'];

function filterKey(tab) {
  if (tab === 'All') return null;
  return tab.toLowerCase();
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

/* ─── Styles ─── */

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
  width: 540,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};

const statCardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: '16px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  textAlign: 'center',
  minWidth: 120,
  flex: 1,
};

const statNumber = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.1,
};

const statLabel = {
  fontSize: 12,
  color: '#6b7280',
  marginTop: 4,
  fontWeight: 500,
};

/* ─── Student Search Dropdown ─── */

function StudentSearchSelect({ students, value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = students.filter((s) => {
    const n = sName(s).toLowerCase();
    return n.includes(search.toLowerCase());
  });

  const selected = students.find((s) => s.id === value);

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          cursor: 'pointer',
          background: '#fff',
          color: selected ? '#1a2332' : '#9ca3af',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{selected ? sName(selected) : 'Select student...'}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            marginTop: 4,
            zIndex: 10,
            maxHeight: 200,
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ padding: 8 }}>
            <input
              autoFocus
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', color: '#9ca3af', fontSize: 13 }}>No students found</div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                  setSearch('');
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  background: s.id === value ? '#f0fdfa' : 'transparent',
                  color: '#1a2332',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdfa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = s.id === value ? '#f0fdfa' : 'transparent'; }}
              >
                {sName(s)}
                {s.grade ? <span style={{ color: '#9ca3af', marginLeft: 8 }}>Grade {s.grade}</span> : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── New Goal Modal ─── */

function NewGoalModal({ open, onClose, counselorId, students, onCreated }) {
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ascaDomain, setAscaDomain] = useState('Social-Emotional');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStudentId('');
      setTitle('');
      setDescription('');
      setAscaDomain('Social-Emotional');
      setTargetDate('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please select a student.');
      return;
    }
    if (!title.trim()) {
      setError('Goal title is required.');
      return;
    }
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const { error: dbErr } = await db.insert('student_goals', {
      counselor_id: counselorId,
      student_id: studentId,
      title: title.trim(),
      description: description.trim() || null,
      asca_domain: ascaDomain,
      target_date: targetDate || null,
      status: 'active',
      progress_notes: null,
      created_at: now,
      updated_at: now,
    });

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>New Goal</h3>
        {error && (
          <div style={{
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 12,
            background: '#fef2f2',
            padding: '8px 12px',
            borderRadius: 6,
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label className="form-label">Student *</label>
          <div style={{ marginBottom: 12 }}>
            <StudentSearchSelect students={students} value={studentId} onChange={setStudentId} />
          </div>

          <label className="form-label">Goal Title *</label>
          <input
            className="form-input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Improve conflict resolution skills"
            style={{ marginBottom: 12 }}
          />

          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details about the goal..."
            rows={3}
            style={{ marginBottom: 12, resize: 'vertical' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">ASCA Domain *</label>
              <select
                className="form-input"
                value={ascaDomain}
                onChange={(e) => setAscaDomain(e.target.value)}
              >
                {ASCA_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Target Date</label>
              <input
                className="form-input"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
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
              {saving ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Goal Modal ─── */

function EditGoalModal({ open, goal, student, onClose, onUpdated }) {
  const [status, setStatus] = useState('active');
  const [targetDate, setTargetDate] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && goal) {
      setStatus(goal.status || 'active');
      setTargetDate(goal.target_date || '');
      setProgressNotes(goal.progress_notes || '');
      setError('');
    }
  }, [open, goal]);

  if (!open || !goal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { error: dbErr } = await db.update('student_goals', goal.id, {
      status,
      target_date: targetDate || null,
      progress_notes: progressNotes.trim() || null,
      updated_at: new Date().toISOString(),
    });

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onUpdated();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Edit Goal</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
          {sName(student)} &mdash; {goal.title}
        </p>
        {error && (
          <div style={{
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 12,
            background: '#fef2f2',
            padding: '8px 12px',
            borderRadius: 6,
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label className="form-label">Status</label>
          <select
            className="form-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ marginBottom: 12 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <label className="form-label">Target Date</label>
          <input
            className="form-input"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <label className="form-label">Progress Notes</label>
          <textarea
            className="form-input"
            value={progressNotes}
            onChange={(e) => setProgressNotes(e.target.value)}
            placeholder="Add notes about progress toward this goal..."
            rows={5}
            style={{ marginBottom: 12, resize: 'vertical' }}
          />

          {goal.description && (
            <div style={{
              background: '#f9fafb',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 13,
              color: '#6b7280',
            }}>
              <strong style={{ color: '#374151' }}>Goal description:</strong> {goal.description}
            </div>
          )}

          <div style={{
            background: '#f9fafb',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: '#9ca3af',
            display: 'flex',
            gap: 16,
          }}>
            <span>Created: {formatDate(goal.created_at?.slice(0, 10))}</span>
            {goal.updated_at && (
              <span>Last updated: {formatDate(goal.updated_at.slice(0, 10))}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function GoalsPage() {
  const { counselor } = useAuth();
  const [goals, setGoals] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentMap, setStudentMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    setError('');

    // Load goals
    const { data: goalRows, error: gErr } = await db.select('student_goals', {
      eq: { counselor_id: counselor.id },
      order: { column: 'created_at', ascending: false },
    });

    if (gErr) {
      setError(gErr.message);
      setLoading(false);
      return;
    }

    // Load students for name lookups and the new-goal dropdown
    const { data: studentRows, error: sErr } = await db.select('students', {
      eq: { counselor_id: counselor.id },
      order: { column: 'name', ascending: true },
    });

    if (sErr) {
      setError(sErr.message);
      setLoading(false);
      return;
    }

    const sMap = {};
    (studentRows || []).forEach((s) => {
      sMap[s.id] = s;
    });

    setGoals(goalRows || []);
    setStudents(studentRows || []);
    setStudentMap(sMap);
    setLoading(false);
  }, [counselor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute summary stats
  const totalGoals = goals.length;
  const activeGoals = goals.filter((g) => g.status === 'active').length;

  // "Met this semester" — goals with status 'met' updated in the current semester window
  // Simple heuristic: goals met in the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString();
  const metThisSemester = goals.filter(
    (g) => g.status === 'met' && (g.updated_at || g.created_at) >= sixMonthsAgoStr
  ).length;

  const completedGoals = goals.filter((g) => g.status === 'met').length;
  const eligibleForRate = goals.filter((g) => g.status === 'met' || g.status === 'not_met').length;
  const percentMet = eligibleForRate > 0 ? Math.round((completedGoals / eligibleForRate) * 100) : 0;

  // Filter goals by active tab
  const fKey = filterKey(activeTab);
  const filteredGoals = fKey ? goals.filter((g) => g.status === fKey) : goals;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Goal</button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#ef4444',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              padding: '0 4px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={statCardStyle}>
          <div style={{ ...statNumber, color: '#1a2332' }}>{totalGoals}</div>
          <div style={statLabel}>Total Goals</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statNumber, color: STATUS_COLORS.active }}>{activeGoals}</div>
          <div style={statLabel}>Active</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statNumber, color: STATUS_COLORS.met }}>{metThisSemester}</div>
          <div style={statLabel}>Met This Semester</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statNumber, color: '#2A9D8F' }}>{percentMet}%</div>
          <div style={statLabel}>Percentage Met</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: isActive ? '2px solid #2A9D8F' : '1px solid #d1d5db',
                background: isActive ? '#f0fdfa' : '#fff',
                color: isActive ? '#2A9D8F' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Goal Cards */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : filteredGoals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 15, color: '#6b7280' }}>
            {activeTab === 'All'
              ? 'No goals yet. Create your first goal to start tracking student outcomes.'
              : `No ${activeTab.toLowerCase()} goals.`}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}>
          {filteredGoals.map((g) => {
            const student = studentMap[g.student_id];
            const domainColor = DOMAIN_COLORS[g.asca_domain] || '#6b7280';
            const statusColor = STATUS_COLORS[g.status] || '#9ca3af';

            return (
              <div
                key={g.id}
                onClick={() => setEditGoal(g)}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '16px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  borderLeft: `4px solid ${statusColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Student name + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    {sName(student)}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: statusColor + '20',
                    color: statusColor,
                    textTransform: 'capitalize',
                  }}>
                    {STATUS_LABELS[g.status] || g.status}
                  </span>
                </div>

                {/* Goal title */}
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', lineHeight: 1.3 }}>
                  {g.title}
                </div>

                {/* ASCA domain badge + target date */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: domainColor + '18',
                    color: domainColor,
                  }}>
                    {g.asca_domain}
                  </span>
                  {g.target_date && (
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      Target: {formatDate(g.target_date)}
                    </span>
                  )}
                </div>

                {/* Progress notes preview */}
                {g.progress_notes && (
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: 6,
                    padding: '6px 10px',
                    lineHeight: 1.4,
                  }}>
                    {truncate(g.progress_notes, 120)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <NewGoalModal
        open={showNew}
        onClose={() => setShowNew(false)}
        counselorId={counselor?.id}
        students={students}
        onCreated={() => {
          setShowNew(false);
          loadData();
        }}
      />

      <EditGoalModal
        open={!!editGoal}
        goal={editGoal}
        student={editGoal ? studentMap[editGoal.student_id] : null}
        onClose={() => setEditGoal(null)}
        onUpdated={() => {
          setEditGoal(null);
          loadData();
        }}
      />
    </div>
  );
}
