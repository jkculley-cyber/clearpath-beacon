import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { autoLogTime, removeAutoLoggedTime } from '../lib/autoLogTime';
import { downloadCsv } from '../lib/csvExport';
import { SESSION_STATUSES } from '../lib/constants';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from 'date-fns';
import SessionNoteTemplateModal from '../components/SessionNoteTemplateModal';

const sName = (s) => s?.name || 'Unknown';

const TEAL = '#2A9D8F';
const TEAL_LIGHT = '#2A9D8F20';
const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#8b5cf620';

const STATUS_COLORS = {
  Scheduled: { bg: '#3b82f620', fg: '#3b82f6' },
  Completed: { bg: '#22c55e20', fg: '#22c55e' },
  Cancelled: { bg: '#ef444420', fg: '#ef4444' },
  'Make-up Needed': { bg: '#f59e0b20', fg: '#f59e0b' },
};

const DATE_RANGES = {
  this_week: 'This Week',
  this_month: 'This Month',
  custom: 'Custom',
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Group' },
];

/* ─── Quick Log Modal (also used for edit) ─── */
function QuickLogModal({ open, onClose, counselorId, counselorName, students, groups, onSaved, editingSession, onDelete }) {
  const isEditing = !!editingSession;
  const [sessionType, setSessionType] = useState('individual');
  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [domain, setDomain] = useState('responsive');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Completed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tmplOpen, setTmplOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingSession) {
      const s = editingSession;
      setSessionType(s.session_type || (s.group_id ? 'group' : 'individual'));
      setStudentId(s.student_id || '');
      setGroupId(s.group_id || '');
      const stu = students.find((x) => x.id === s.student_id);
      setStudentSearch(stu ? stu.name : '');
      setSessionDate(s.session_date || format(new Date(), 'yyyy-MM-dd'));
      setStartTime((s.start_time || '').slice(0, 5));
      setDuration(s.duration_minutes ?? 30);
      setDomain(s.domain || 'responsive');
      setNotes(s.notes || '');
      setStatus(s.status || 'Completed');
    } else {
      setSessionType('individual');
      setStudentId('');
      setGroupId('');
      setStudentSearch('');
      setSessionDate(format(new Date(), 'yyyy-MM-dd'));
      setStartTime('');
      setDuration(30);
      setDomain('responsive');
      setNotes('');
      setStatus('Completed');
    }
    setError('');
    setTmplOpen(false);
  }, [open, editingSession, students]);

  if (!open) return null;

  const filteredStudents = students.filter((s) =>
    (s.name || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (sessionType === 'individual' && !studentId) {
      setError('Please select a student.');
      return;
    }
    if (sessionType === 'group' && !groupId) {
      setError('Please select a group.');
      return;
    }
    if (!sessionDate) {
      setError('Please select a date.');
      return;
    }
    if (!duration || duration < 1) {
      setError('Duration must be at least 1 minute.');
      return;
    }

    setSaving(true);

    const record = {
      counselor_id: counselorId,
      session_type: sessionType,
      student_id: sessionType === 'individual' ? studentId : null,
      group_id: sessionType === 'group' ? groupId : null,
      session_date: sessionDate,
      start_time: startTime || null,
      duration_minutes: Number(duration),
      domain,
      notes: notes.trim() || null,
      status,
    };

    let saved;
    if (isEditing) {
      const { data, error: updateErr } = await db.update('sessions', editingSession.id, record);
      if (updateErr) {
        setError(updateErr.message || 'Failed to update session.');
        setSaving(false);
        return;
      }
      saved = data || { id: editingSession.id };
    } else {
      const { data, error: insertErr } = await db.insert('sessions', record);
      if (insertErr) {
        setError(insertErr.message || 'Failed to save session.');
        setSaving(false);
        return;
      }
      saved = data;
    }

    // Auto-log time for completed sessions (autoLogTime is idempotent by source_id).
    // If status moved away from Completed (e.g. Completed → Cancelled), remove the prior auto-entry.
    if (saved) {
      if (status === 'Completed') {
        const selectedGroup = groups.find((g) => g.id === groupId);
        const selectedStudent = students.find((s) => s.id === studentId);
        await autoLogTime({
          counselorId,
          sessionId: saved.id,
          date: sessionDate,
          durationMinutes: Number(duration),
          description:
            sessionType === 'group'
              ? `Group counseling: ${selectedGroup?.name || 'Group session'}`
              : `Individual counseling: ${sName(selectedStudent)}`,
        });
      } else if (isEditing) {
        await removeAutoLoggedTime(saved.id);
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>
          {isEditing ? 'Edit Session' : 'Log Session'}
        </h3>
        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSave}>
          {/* Session Type Toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {['individual', 'group'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setSessionType(t); setStudentId(''); setGroupId(''); }}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  background: sessionType === t ? TEAL : '#fff',
                  color: sessionType === t ? '#fff' : '#6b7280',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'individual' ? 'Individual' : 'Group'}
              </button>
            ))}
          </div>

          {/* Student or Group selection */}
          {sessionType === 'individual' ? (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Student *</label>
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 4 }}
              />
              {studentSearch && filteredStudents.length > 0 && !studentId && (
                <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
                  {filteredStudents.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setStudentId(s.id); setStudentSearch(s.name); }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        background: studentId === s.id ? TEAL_LIGHT : 'transparent',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = studentId === s.id ? TEAL_LIGHT : 'transparent'; }}
                    >
                      {s.name} {s.grade ? `(Grade ${s.grade})` : ''}
                    </div>
                  ))}
                </div>
              )}
              {studentId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: TEAL, fontWeight: 600 }}>
                    Selected: {students.find((s) => s.id === studentId)?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setStudentId(''); setStudentSearch(''); }}
                    style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Group *</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Date *</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={lbl}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={lbl}>Duration (min) *</label>
              <input
                type="number"
                min="1"
                max="480"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} style={inputStyle}>
                <option value="guidance">Guidance Curriculum</option>
                <option value="planning">Individual Student Planning</option>
                <option value="responsive">Responsive Services</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                {SESSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={lbl}>Notes</label>
              <button
                type="button"
                onClick={() => setTmplOpen(true)}
                style={{ background: 'none', border: '1px solid #2A9D8F', color: '#2A9D8F', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                Use template
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes... or click 'Use template' for SOAP-format help."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <SessionNoteTemplateModal
            open={tmplOpen}
            onClose={() => setTmplOpen(false)}
            onUseNote={(text) => setNotes(text)}
            ctx={{ counselorName, sessionDate }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
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
              disabled={saving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                background: TEAL, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Weekly Bar Chart (past 4 weeks) ─── */
function WeeklyBarChart({ sessions }) {
  const weeks = [];
  const now = new Date();
  for (let i = 3; i >= 0; i--) {
    const ref = new Date(now);
    ref.setDate(ref.getDate() - i * 7);
    const ws = startOfWeek(ref, { weekStartsOn: 1 });
    const we = endOfWeek(ref, { weekStartsOn: 1 });
    const count = sessions.filter((s) => {
      const d = new Date(s.session_date);
      return d >= ws && d <= we;
    }).length;
    weeks.push({ label: format(ws, 'MMM d'), count });
  }

  const maxCount = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Sessions per Week (Past 4 Weeks)</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{w.count}</span>
            <div
              style={{
                width: '100%',
                maxWidth: 60,
                height: Math.max(4, (w.count / maxCount) * 90),
                background: `linear-gradient(180deg, ${TEAL} 0%, #20847a 100%)`,
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
            <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function SessionsPage() {
  const { counselor } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [searchParams] = useSearchParams();

  // Filters (seed from URL params on mount so dashboard drill-downs land filtered)
  const [dateRange, setDateRange] = useState(() => {
    const r = searchParams.get('range');
    return ['this_week', 'this_month', 'custom'].includes(r) ? r : 'this_month';
  });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [searchText, setSearchText] = useState('');

  const computeDateBounds = useCallback(() => {
    const now = new Date();
    if (dateRange === 'this_week') {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    if (dateRange === 'this_month') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (dateRange === 'custom') {
      return {
        start: customStart ? new Date(customStart) : new Date('2000-01-01'),
        end: customEnd ? new Date(customEnd + 'T23:59:59') : new Date('2099-12-31'),
      };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [dateRange, customStart, customEnd]);

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);

    const [sessRes, stuRes, grpRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        order: { column: 'session_date', ascending: false },
      }),
      db.select('students', {
        eq: { counselor_id: counselor.id },
      }),
      db.select('groups', {
        eq: { counselor_id: counselor.id },
      }),
    ]);

    setSessions(sessRes.data || []);
    setStudents(stuRes.data || []);
    setGroups(grpRes.data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build lookup maps
  const studentMap = {};
  for (const s of students) studentMap[s.id] = s;
  const groupMap = {};
  for (const g of groups) groupMap[g.id] = g;

  // Filter sessions
  const { start: dateStart, end: dateEnd } = computeDateBounds();
  const filtered = sessions.filter((s) => {
    const d = new Date(s.session_date);
    if (d < dateStart || d > dateEnd) return false;
    if (typeFilter !== 'all' && s.session_type !== typeFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchText) {
      const term = searchText.toLowerCase();
      const stuName = (studentMap[s.student_id]?.name || '').toLowerCase();
      const grpName = (groupMap[s.group_id]?.name || '').toLowerCase();
      const noteText = (s.notes || '').toLowerCase();
      if (!stuName.includes(term) && !grpName.includes(term) && !noteText.includes(term)) return false;
    }
    return true;
  });

  // Summary calculations (filtered by current date range)
  const monthSessions = sessions.filter((s) => {
    const now = new Date();
    const ms = startOfMonth(now);
    const me = endOfMonth(now);
    const d = new Date(s.session_date);
    return d >= ms && d <= me;
  });
  const totalMonth = monthSessions.length;
  const completedMonth = monthSessions.filter((s) => s.status === 'Completed').length;
  const scheduledMonth = monthSessions.filter((s) => s.status === 'Scheduled').length;
  const cancelledMonth = monthSessions.filter((s) => s.status === 'Cancelled').length;
  const totalHours = monthSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;

  const getSessionLabel = (s) => {
    if (s.session_type === 'group' && s.group_id) {
      return groupMap[s.group_id]?.name || 'Unknown Group';
    }
    if (s.student_id) {
      return sName(studentMap[s.student_id]);
    }
    return 'Unknown';
  };

  // Export exactly what the current filters show — front-office friendly
  const handleExportCsv = () => {
    downloadCsv(
      `beacon-sessions-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Type', 'Student / Group', 'Start', 'Duration (min)', 'Status', 'Notes'],
      filtered.map((s) => [
        s.session_date,
        s.session_type === 'group' ? 'Group' : 'Individual',
        getSessionLabel(s),
        s.start_time || '',
        s.duration_minutes ?? '',
        s.status || '',
        s.notes || '',
      ])
    );
  };

  return (
    <div style={{ padding: 0 }} className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1a2332' }}>Sessions</h1>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            {filtered.length} session{filtered.length !== 1 ? 's' : ''} shown
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="btn btn-outline"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          style={{ fontSize: 13 }}
        >
          Export CSV
        </button>
        <button
          onClick={() => setShowLogModal(true)}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: TEAL, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          + Log Session
        </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total This Month', value: totalMonth, color: TEAL },
          { label: 'Completed', value: completedMonth, color: '#22c55e' },
          { label: 'Scheduled', value: scheduledMonth, color: '#3b82f6' },
          { label: 'Cancelled', value: cancelledMonth, color: '#ef4444' },
          { label: 'Total Hours', value: totalHours.toFixed(1), color: '#8b5cf6' },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: '#fff', borderRadius: 10, padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly Bar Chart */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <WeeklyBarChart sessions={sessions} />
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
      }}>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={filterSelect}
        >
          {Object.entries(DATE_RANGES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ ...filterSelect, width: 140 }}
            />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ ...filterSelect, width: 140 }}
            />
          </>
        )}

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={filterSelect}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={filterSelect}
        >
          <option value="all">All Statuses</option>
          {SESSION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search name or notes..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...filterSelect, flex: 1, minWidth: 160 }}
        />
      </div>

      {/* Sessions List */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading sessions...</p>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: 15, color: '#9ca3af', margin: 0 }}>
            No sessions found for the selected filters.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 100px 80px 120px 1fr',
            gap: 12,
            padding: '8px 18px',
            fontSize: 11,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <span>Date</span>
            <span>Student / Group</span>
            <span>Type</span>
            <span>Duration</span>
            <span>Status</span>
            <span>Notes</span>
          </div>

          {filtered.map((s) => {
            const isExpanded = expandedId === s.id;
            const sColor = STATUS_COLORS[s.status] || STATUS_COLORS.Scheduled;
            const typeBadge = s.session_type === 'group'
              ? { bg: PURPLE_LIGHT, fg: PURPLE, label: 'Group' }
              : { bg: TEAL_LIGHT, fg: TEAL, label: 'Individual' };

            return (
              <div key={s.id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 100px 80px 120px 1fr',
                    gap: 12,
                    padding: '14px 18px',
                    background: '#fff',
                    borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    alignItems: 'center',
                    transition: 'box-shadow 0.15s',
                    fontSize: 14,
                    color: '#374151',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {format(new Date(s.session_date), 'MMM d, yyyy')}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1a2332' }}>
                    {getSessionLabel(s)}
                  </span>
                  <span>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                      fontSize: 11, fontWeight: 600, background: typeBadge.bg, color: typeBadge.fg,
                    }}>
                      {typeBadge.label}
                    </span>
                  </span>
                  <span style={{ fontSize: 13 }}>{s.duration_minutes || 0}m</span>
                  <span>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                      fontSize: 11, fontWeight: 600, background: sColor.bg, color: sColor.fg,
                    }}>
                      {s.status}
                    </span>
                  </span>
                  <span style={{
                    fontSize: 13, color: '#9ca3af', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.notes || '--'}
                  </span>
                </div>

                {/* Expanded Notes Row */}
                {isExpanded && (
                  <div style={{
                    padding: '14px 18px', background: '#f9fafb',
                    borderRadius: '0 0 10px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    borderTop: '1px solid #f3f4f6',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Type</span>
                        <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>
                          {s.session_type === 'group' ? 'Group Session' : 'Individual Session'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Domain</span>
                        <div style={{ fontSize: 14, color: '#374151', marginTop: 2, textTransform: 'capitalize' }}>
                          {s.domain || '--'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Duration</span>
                        <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>
                          {s.duration_minutes || 0} minutes
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Full Notes</span>
                      <div style={{
                        fontSize: 14, color: '#374151', marginTop: 4,
                        whiteSpace: 'pre-wrap', lineHeight: 1.5,
                      }}>
                        {s.notes || 'No notes recorded.'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingSession(s); }}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid ' + TEAL,
                        background: '#fff', color: TEAL, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Edit Session
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Log Modal (also used for edit) */}
      <QuickLogModal
        open={showLogModal || !!editingSession}
        onClose={() => { setShowLogModal(false); setEditingSession(null); }}
        counselorId={counselor?.id}
        counselorName={counselor?.name}
        students={students}
        groups={groups}
        editingSession={editingSession}
        onDelete={editingSession ? async () => {
          if (!confirm('Delete this session? This cannot be undone.')) return;
          await removeAutoLoggedTime(editingSession.id);
          await db.del('sessions', editingSession.id);
          setEditingSession(null);
          loadData();
        } : null}
        onSaved={() => { setShowLogModal(false); setEditingSession(null); loadData(); }}
      />
    </div>
  );
}

/* ─── Shared Styles ─── */

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modal = {
  background: '#fff', borderRadius: 12, padding: 28, width: 520,
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};

const lbl = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em',
};

const inputStyle = {
  display: 'block', width: '100%', padding: '9px 12px', borderRadius: 6,
  border: '1px solid #e5e7eb', fontSize: 14, color: '#374151',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const filterSelect = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
  fontSize: 13, color: '#374151', background: '#fff', outline: 'none',
};
