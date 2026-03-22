import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { TIME_DOMAINS } from '../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfWeek, subWeeks, format, subDays } from 'date-fns';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Scorecard from '../components/Scorecard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── Helper: student display name ─── */
const sName = (s) => s?.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s?.name || 'Unknown');

/* ─── 80/20 Ring ─── */
function ComplianceRing({ percentage, size = 160, strokeWidth = 14 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = percentage >= 82 ? '#22c55e' : percentage >= 78 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

/* ─── Trend Sparkline (SVG polyline, 8 weeks) ─── */
function TrendSparkline({ data }) {
  // data = [{ label: 'MM/DD', pct: 0-100 }, ...]
  if (!data || data.length < 2) return null;

  const width = 260;
  const height = 48;
  const padX = 4;
  const padY = 6;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const maxPct = 100;
  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * plotW;
    const y = padY + plotH - (d.pct / maxPct) * plotH;
    return `${x},${y}`;
  }).join(' ');

  // 80% threshold line
  const thresholdY = padY + plotH - (80 / maxPct) * plotH;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>8-Week Trend</div>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        {/* 80% threshold dashed line */}
        <line
          x1={padX} y1={thresholdY} x2={width - padX} y2={thresholdY}
          stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" opacity="0.6"
        />
        {/* Trend polyline */}
        <polyline
          points={points}
          fill="none"
          stroke="#2A9D8F"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Data points */}
        {data.map((d, i) => {
          const x = padX + (i / (data.length - 1)) * plotW;
          const y = padY + plotH - (d.pct / maxPct) * plotH;
          return <circle key={i} cx={x} cy={y} r="3" fill={d.pct >= 80 ? '#22c55e' : '#ef4444'} />;
        })}
      </svg>
      {/* Week labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${padX}px`, marginTop: 2 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: 9, color: '#9ca3af', width: 0, textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap' }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Quick Log Modal ─── */
function QuickLogModal({ open, onClose, counselorId }) {
  const [domain, setDomain] = useState('guidance');
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await db.insert('time_entries', {
      counselor_id: counselorId,
      entry_date: new Date().toISOString().slice(0, 10),
      domain,
      activity_description: activity,
      duration_minutes: parseInt(duration, 10),
    });
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={modalStyles.overlay} onClick={() => onClose(false)}>
      <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalStyles.title}>Quick Time Log</h3>
        <form onSubmit={handleSave}>
          <label style={modalStyles.label}>Domain</label>
          <select style={modalStyles.input} value={domain} onChange={(e) => setDomain(e.target.value)}>
            {Object.entries(TIME_DOMAINS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label style={modalStyles.label}>Activity</label>
          <input style={modalStyles.input} value={activity} onChange={(e) => setActivity(e.target.value)} required placeholder="Brief description" />
          <label style={modalStyles.label}>Duration (minutes)</label>
          <input style={modalStyles.input} type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => onClose(false)} style={modalStyles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={modalStyles.saveBtn}>{saving ? 'Saving...' : 'Log Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Quick Session Modal ─── */
function QuickSessionModal({ open, onClose, counselorId }) {
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!open || !counselorId) return;
    db.select('students', { eq: { counselor_id: counselorId, status: 'active' }, order: { column: 'name' } })
      .then(({ data }) => setStudents(data || []));
  }, [open, counselorId]);

  if (!open) return null;

  const filtered = search
    ? students.filter((s) => {
        const name = s.first_name ? `${s.first_name} ${s.last_name || ''}` : (s.name || '');
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : students;

  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedLabel = selectedStudent
    ? (selectedStudent.first_name ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}`.trim() : selectedStudent.name)
    : '';

  const handleSave = async (e) => {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const mins = parseInt(duration, 10) || 30;

    // Insert session
    await db.insert('sessions', {
      counselor_id: counselorId,
      student_id: studentId,
      session_date: today,
      duration_minutes: mins,
      notes: notes || null,
      status: 'Completed',
      session_type: 'individual',
    });

    // Auto-log time entry for responsive domain
    await db.insert('time_entries', {
      counselor_id: counselorId,
      entry_date: today,
      domain: 'responsive',
      activity_description: `Individual session \u2014 ${selectedLabel}`,
      duration_minutes: mins,
    });

    setSaving(false);
    setStudentId('');
    setSearch('');
    setDuration('30');
    setNotes('');
    onClose(true);
  };

  return (
    <div style={modalStyles.overlay} onClick={() => onClose(false)}>
      <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalStyles.title}>Log Session</h3>
        <form onSubmit={handleSave}>
          <label style={modalStyles.label}>Student</label>
          <div style={{ position: 'relative' }}>
            <input
              style={modalStyles.input}
              placeholder="Search students..."
              value={studentId ? selectedLabel : search}
              onChange={(e) => { setSearch(e.target.value); setStudentId(''); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              required
            />
            {dropdownOpen && filtered.length > 0 && !studentId && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 180, overflowY: 'auto',
                zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {filtered.map((s) => {
                  const label = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.name;
                  return (
                    <div
                      key={s.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}
                      onMouseDown={(e) => { e.preventDefault(); setStudentId(s.id); setSearch(''); setDropdownOpen(false); }}
                    >
                      {label} <span style={{ color: '#9ca3af', fontSize: 12 }}>Grade {s.grade}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <label style={modalStyles.label}>Duration (minutes)</label>
          <input style={modalStyles.input} type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          <label style={modalStyles.label}>Notes (optional)</label>
          <textarea
            style={{ ...modalStyles.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief session notes..."
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => onClose(false)} style={modalStyles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving || !studentId} style={{ ...modalStyles.saveBtn, opacity: (!studentId || saving) ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
export default function DashboardPage() {
  const { counselor } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    sessionsToday: 0,
    pendingReferrals: 0,
    missedAlerts: 0,
    totalStudents: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    activeGroups: 0,
    compliancePct: 0,
    domainHours: [],
  });
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showQuickSession, setShowQuickSession] = useState(false);
  const [makeupQueue, setMakeupQueue] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [overdueStudents, setOverdueStudents] = useState([]);
  const [weekDigest, setWeekDigest] = useState(null);
  const [myDay, setMyDay] = useState(null);

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    // Use school year start from counselor settings, fallback to Aug 1 of current school year
    const yearStart = counselor.school_year_start
      || (new Date().getMonth() >= 7 ? `${new Date().getFullYear()}-08-01` : `${new Date().getFullYear() - 1}-08-01`);

    const [sessionsRes, referralsRes, studentsRes, groupsRes, timeRes, missedRes] = await Promise.all([
      db.count('sessions', { counselor_id: counselor.id, session_date: today }),
      db.count('referrals', { counselor_id: counselor.id, status: 'open' }),
      db.select('students', { eq: { counselor_id: counselor.id, status: 'active' }, select: 'id, tier' }),
      db.count('groups', { counselor_id: counselor.id, status: 'active' }),
      db.select('time_entries', { eq: { counselor_id: counselor.id }, gte: { entry_date: yearStart }, select: 'domain, duration_minutes' }),
      db.count('sessions', { counselor_id: counselor.id, session_date: today, status: 'Cancelled' }),
    ]);

    const students = studentsRes.data || [];
    const tier1 = students.filter((s) => s.tier === 1).length;
    const tier2 = students.filter((s) => s.tier === 2).length;
    const tier3 = students.filter((s) => s.tier === 3).length;

    // Compute overdue students (Tier 2/3 with no session in 14+ days)
    const higherTierStudents = students.filter((s) => s.tier === 2 || s.tier === 3);
    if (higherTierStudents.length > 0) {
      const { data: allSessions } = await db.select('sessions', { eq: { counselor_id: counselor.id } });
      const sessionsByStudent = {};
      (allSessions || []).forEach((sess) => {
        if (!sess.student_id) return;
        if (!sessionsByStudent[sess.student_id] || sess.session_date > sessionsByStudent[sess.student_id]) {
          sessionsByStudent[sess.student_id] = sess.session_date;
        }
      });
      const now = new Date();
      const overdue = higherTierStudents
        .map((s) => {
          const lastDate = sessionsByStudent[s.id];
          if (!lastDate) {
            // Never had a session — treat as overdue from creation
            const createdDate = s.created_at ? new Date(s.created_at) : now;
            const daysSince = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            return daysSince >= 14 ? { ...s, daysSince, lastSessionDate: null } : null;
          }
          const daysSince = Math.floor((now - new Date(lastDate + 'T00:00:00')) / (1000 * 60 * 60 * 24));
          return daysSince >= 14 ? { ...s, daysSince, lastSessionDate: lastDate } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.daysSince - a.daysSince);
      setOverdueStudents(overdue);
    } else {
      setOverdueStudents([]);
    }

    // Aggregate time by domain
    const domainMap = {};
    (timeRes.data || []).forEach((e) => {
      domainMap[e.domain] = (domainMap[e.domain] || 0) + e.duration_minutes;
    });
    const totalMinutes = Object.values(domainMap).reduce((a, b) => a + b, 0) || 1;
    const counselingMinutes = (domainMap.guidance || 0) + (domainMap.planning || 0) + (domainMap.responsive || 0);
    const compliancePct = Math.round((counselingMinutes / totalMinutes) * 100);

    const domainHours = Object.entries(TIME_DOMAINS).map(([key, label]) => ({
      domain: label.replace('Individual ', 'Ind. ').replace(' Duties', ''),
      hours: Math.round(((domainMap[key] || 0) / 60) * 10) / 10,
      fill: key === 'non_counseling' ? '#94a3b8' : '#2A9D8F',
    }));

    // ─── This Week digest ───
    const weekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekMondayStr = format(weekMonday, 'yyyy-MM-dd');
    const todayDate = new Date();

    const [weekSessionsRes, weekTimeRes, weekReferralsRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: weekMondayStr },
        select: 'id, session_date, student_id, status',
      }),
      db.select('time_entries', {
        eq: { counselor_id: counselor.id },
        gte: { entry_date: weekMondayStr },
        select: 'id, entry_date',
      }),
      db.select('referrals', {
        eq: { counselor_id: counselor.id, status: 'closed' },
        gte: { updated_at: weekMondayStr },
        select: 'id',
      }),
    ]);

    const weekSessions = (weekSessionsRes.data || []).filter(s => s.status !== 'Cancelled');
    const weekTimeEntries = weekTimeRes.data || [];
    const weekReferralsClosed = (weekReferralsRes.data || []).length;

    // Build day-by-day activity map (Mon=0 through Fri=4)
    const dayActivity = [false, false, false, false, false];
    const activityDates = new Set();
    weekSessions.forEach(s => activityDates.add(s.session_date));
    weekTimeEntries.forEach(e => activityDates.add(e.entry_date));

    for (const dateStr of activityDates) {
      const d = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
      const idx = dayOfWeek - 1; // Mon=0, Tue=1, ..., Fri=4
      if (idx >= 0 && idx <= 4) dayActivity[idx] = true;
    }

    // Count unique students seen this week
    const uniqueStudents = new Set();
    weekSessions.forEach(s => { if (s.student_id) uniqueStudents.add(s.student_id); });

    // Find last activity date for nudge
    let lastActivityDate = null;
    for (const dateStr of activityDates) {
      if (!lastActivityDate || dateStr > lastActivityDate) lastActivityDate = dateStr;
    }
    let daysSinceActivity = null;
    if (lastActivityDate) {
      daysSinceActivity = Math.floor((todayDate - new Date(lastActivityDate + 'T00:00:00')) / 86400000);
    } else {
      daysSinceActivity = 999; // never logged
    }

    // Current day index (0=Mon, 4=Fri, -1/5+ = weekend)
    const currentDayIdx = todayDate.getDay() - 1;

    setWeekDigest({
      dayActivity,
      sessionCount: weekSessions.length,
      studentCount: uniqueStudents.size,
      referralCount: weekReferralsClosed,
      daysSinceActivity,
      lastActivityDay: lastActivityDate ? format(new Date(lastActivityDate + 'T00:00:00'), 'EEEE') : null,
      currentDayIdx,
      weekMonday,
    });

    setStats({
      sessionsToday: sessionsRes.count ?? 0,
      pendingReferrals: referralsRes.count ?? 0,
      missedAlerts: missedRes.count ?? 0,
      totalStudents: students.length,
      tier1,
      tier2,
      tier3,
      activeGroups: groupsRes.count ?? 0,
      compliancePct,
      domainHours,
    });
  }, [counselor]);

  /* ─── Feature #6: Make-up Session Tracker ─── */
  const loadMakeupQueue = useCallback(async () => {
    if (!counselor?.id) return;

    // Fetch attendance rows, then manually join students/sessions/groups
    const { data: allAttendance } = await db.select('attendance');
    const attendanceRows = (allAttendance || []).filter(
      (a) => ['absent', 'makeup_needed'].includes(a.status) && !a.makeup_session_id
    );

    if (!attendanceRows.length) {
      setMakeupQueue([]);
      return;
    }

    // Fetch related students, sessions, and groups for manual join
    const [{ data: allStudents }, { data: allSessions }, { data: allGroups }] = await Promise.all([
      db.select('students'),
      db.select('sessions'),
      db.select('groups'),
    ]);

    const studentMap = Object.fromEntries((allStudents || []).map((s) => [s.id, s]));
    const sessionMap = Object.fromEntries((allSessions || []).map((s) => [s.id, s]));
    const groupMap = Object.fromEntries((allGroups || []).map((g) => [g.id, g]));

    const queue = attendanceRows
      .map((row) => {
        const student = studentMap[row.student_id];
        const session = sessionMap[row.session_id];
        if (!student || !session) return null;
        const group = session.group_id ? groupMap[session.group_id] : null;
        return {
          id: row.id,
          studentName: sName(student),
          sessionDate: session.session_date,
          groupName: group?.name || 'Individual',
          groupId: session.group_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

    setMakeupQueue(queue);
  }, [counselor]);

  /* ─── Feature #8: 8-Week Trend ─── */
  const loadTrend = useCallback(async () => {
    if (!counselor?.id) return;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const eightWeeksAgo = subWeeks(weekStart, 7); // 8 weeks total including current

    const { data } = await db.select('time_entries', {
      eq: { counselor_id: counselor.id },
      gte: { entry_date: format(eightWeeksAgo, 'yyyy-MM-dd') },
      select: 'entry_date, domain, duration_minutes',
    });

    if (!data || data.length === 0) {
      setTrendData([]);
      return;
    }

    // Build 8 week buckets
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const ws = subWeeks(weekStart, i);
      weeks.push({
        start: ws,
        label: format(ws, 'M/d'),
        counseling: 0,
        total: 0,
      });
    }

    const counselingDomains = new Set(['guidance', 'planning', 'responsive']);

    data.forEach((entry) => {
      const entryDate = new Date(entry.entry_date + 'T00:00:00');
      // Find which week bucket this belongs to
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (entryDate >= weeks[i].start) {
          weeks[i].total += entry.duration_minutes;
          if (counselingDomains.has(entry.domain)) {
            weeks[i].counseling += entry.duration_minutes;
          }
          break;
        }
      }
    });

    // Only include weeks that have data
    const trend = weeks
      .map((w) => ({
        label: w.label,
        pct: w.total > 0 ? Math.round((w.counseling / w.total) * 100) : 0,
        hasData: w.total > 0,
      }));

    setTrendData(trend);
  }, [counselor]);

  /* ─── My Day: priority view data ─── */
  const loadMyDay = useCallback(async () => {
    if (!counselor?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = counselor.school_year_start
      || (new Date().getMonth() >= 7 ? `${new Date().getFullYear()}-08-01` : `${new Date().getFullYear() - 1}-08-01`);

    // 1. Overdue Tier 2/3 students with last session notes
    const [studentsRes, allSessionsRes, referralsRes, scheduledRes, timeEntriesRes] = await Promise.all([
      db.select('students', { eq: { counselor_id: counselor.id, status: 'active' }, select: 'id, first_name, last_name, name, tier, created_at' }),
      db.select('sessions', { eq: { counselor_id: counselor.id }, order: { column: 'session_date', ascending: false } }),
      db.select('referrals', { eq: { counselor_id: counselor.id, status: 'open' }, order: { column: 'created_at', ascending: true } }),
      db.select('sessions', { eq: { counselor_id: counselor.id, session_date: today, status: 'Scheduled' } }),
      db.select('time_entries', { eq: { counselor_id: counselor.id }, gte: { entry_date: yearStart }, select: 'domain, duration_minutes, entry_date' }),
    ]);

    const students = studentsRes.data || [];
    const allSessions = allSessionsRes.data || [];
    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

    // Build last session per student (with notes)
    const lastSessionByStudent = {};
    for (const sess of allSessions) {
      if (!sess.student_id) continue;
      if (!lastSessionByStudent[sess.student_id]) {
        lastSessionByStudent[sess.student_id] = sess;
      }
    }

    // Overdue: Tier 2/3 not seen in 14+ days
    const now = new Date();
    const higherTier = students.filter(s => s.tier === 2 || s.tier === 3);
    const overdueList = higherTier
      .map(s => {
        const lastSess = lastSessionByStudent[s.id];
        const lastDate = lastSess?.session_date;
        let daysSince;
        if (!lastDate) {
          const created = s.created_at ? new Date(s.created_at) : now;
          daysSince = Math.floor((now - created) / 86400000);
        } else {
          daysSince = Math.floor((now - new Date(lastDate + 'T00:00:00')) / 86400000);
        }
        if (daysSince < 14) return null;
        const notes = lastSess?.notes || null;
        return { ...s, daysSince, lastNotes: notes };
      })
      .filter(Boolean)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5);

    // 2. Today's scheduled sessions — resolve student/group names
    const scheduled = scheduledRes.data || [];
    let scheduledItems = [];
    if (scheduled.length > 0) {
      const [{ data: allGroups }] = await Promise.all([db.select('groups', { eq: { counselor_id: counselor.id } })]);
      const groupMap = Object.fromEntries((allGroups || []).map(g => [g.id, g]));

      // Also load group_members for group sessions
      const { data: allGroupStudents } = await db.select('group_members');
      const groupStudentNames = {};
      for (const gs of (allGroupStudents || [])) {
        const st = studentMap[gs.student_id];
        if (st) {
          if (!groupStudentNames[gs.group_id]) groupStudentNames[gs.group_id] = [];
          groupStudentNames[gs.group_id].push(sName(st));
        }
      }

      scheduledItems = scheduled
        .map(sess => {
          const time = sess.start_time ? sess.start_time.slice(0, 5) : null;
          let label;
          if (sess.group_id) {
            const group = groupMap[sess.group_id];
            const memberNames = groupStudentNames[sess.group_id] || [];
            const namesStr = memberNames.length > 0 ? ` (${memberNames.slice(0, 3).join(', ')}${memberNames.length > 3 ? '...' : ''})` : '';
            label = `${group?.name || 'Group'}${namesStr}`;
          } else if (sess.student_id) {
            const st = studentMap[sess.student_id];
            label = `Check-in: ${sName(st)}`;
          } else {
            label = sess.notes || 'Scheduled session';
          }
          return { id: sess.id, time, label, studentId: sess.student_id, groupId: sess.group_id };
        })
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }

    // 3. Open referrals with urgency + age
    const openReferrals = (referralsRes.data || []).map(r => {
      const createdDate = r.created_at ? new Date(r.created_at) : now;
      const daysOpen = Math.floor((now - createdDate) / 86400000);
      // Resolve student name
      const st = studentMap[r.student_id];
      return { ...r, daysOpen, studentName: st ? sName(st) : 'Unknown' };
    }).sort((a, b) => {
      const urgOrder = { Urgent: 0, Soon: 1, Routine: 2 };
      return (urgOrder[a.urgency] ?? 2) - (urgOrder[b.urgency] ?? 2);
    }).slice(0, 5);

    // 4. Students needing progress review (last progress_rating > 30 days ago or never)
    const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
    const { data: progressRows } = await db.select('progress_ratings', { eq: { counselor_id: counselor.id } });
    const lastProgressByStudent = {};
    for (const p of (progressRows || [])) {
      if (!p.student_id) continue;
      if (!lastProgressByStudent[p.student_id] || (p.created_at > lastProgressByStudent[p.student_id].created_at)) {
        lastProgressByStudent[p.student_id] = p;
      }
    }
    const needsReview = students
      .filter(s => {
        const last = lastProgressByStudent[s.id];
        if (!last) return true; // Never rated
        const lastDate = last.created_at ? last.created_at.slice(0, 10) : '1970-01-01';
        return lastDate < thirtyDaysAgo;
      })
      .slice(0, 5);

    // 5. Quick stats for footer line
    const timeEntries = timeEntriesRes.data || [];
    const totalMin = timeEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 1;
    const counselingMin = timeEntries.filter(e => ['guidance', 'planning', 'responsive'].includes(e.domain)).reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const compPct = Math.round((counselingMin / totalMin) * 100);

    const weekMon = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const weekSessions = allSessions.filter(s => s.session_date >= weekMon && s.status === 'Completed').length;
    const monthSessions = allSessions.filter(s => s.session_date >= monthStart && s.status === 'Completed').length;

    setMyDay({
      overdue: overdueList,
      scheduled: scheduledItems,
      referrals: openReferrals,
      needsReview,
      compPct,
      weekSessions,
      monthSessions,
    });
  }, [counselor]);

  useEffect(() => {
    loadData();
    loadMakeupQueue();
    loadTrend();
    loadMyDay();
  }, [loadData, loadMakeupQueue, loadTrend, loadMyDay]);

  /* ─── "My Year" Impact Summary PDF ─── */
  const generateImpactPDF = async () => {
    if (!counselor?.id) return;
    try {

    const yearStart = counselor.school_year_start
      || (new Date().getMonth() >= 7 ? `${new Date().getFullYear()}-08-01` : `${new Date().getFullYear() - 1}-08-01`);

    // Gather additional counts for the PDF
    const [sessionsRes, groupsRes, commsRes, timeRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: yearStart },
        select: 'id, status',
      }),
      db.select('groups', { eq: { counselor_id: counselor.id, status: 'active' }, select: 'id' }),
      db.select('communications', { eq: { counselor_id: counselor.id }, gte: { created_at: yearStart }, select: 'id' }),
      db.select('time_entries', { eq: { counselor_id: counselor.id }, gte: { entry_date: yearStart }, select: 'domain, duration_minutes' }),
    ]);

    const allSessions = (sessionsRes.data || []).filter((s) => s.status !== 'Cancelled');
    const totalSessionsYTD = allSessions.length;
    const totalGroups = (groupsRes.data || []).length;
    const totalComms = (commsRes.data || []).length;

    // Recalculate compliance from time entries
    const domainMap = {};
    (timeRes.data || []).forEach((e) => {
      domainMap[e.domain] = (domainMap[e.domain] || 0) + e.duration_minutes;
    });
    const totalMin = Object.values(domainMap).reduce((a, b) => a + b, 0) || 1;
    const counselingMin = (domainMap.guidance || 0) + (domainMap.planning || 0) + (domainMap.responsive || 0);
    const compPct = Math.round((counselingMin / totalMin) * 100);

    // Build PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const teal = [42, 157, 143];
    let y = 40;

    // Header
    doc.setFillColor(...teal);
    doc.rect(0, 0, pageW, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Beacon \u2014 Annual Impact Summary', pageW / 2, 32, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const counselorName = counselor.name || 'Counselor';
    const schoolName = counselor.school_name || '';
    const dateLine = `${counselorName}${schoolName ? ' | ' + schoolName : ''} | ${format(new Date(), 'MMMM d, yyyy')}`;
    doc.text(dateLine, pageW / 2, 52, { align: 'center' });

    y = 95;

    // Key Metrics Row
    doc.setTextColor(42, 157, 143);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Metrics (Year-to-Date)', 40, y);
    y += 20;

    const metrics = [
      { label: 'Students Served', value: String(stats.totalStudents) },
      { label: 'Sessions Logged', value: String(totalSessionsYTD) },
      { label: 'Groups Run', value: String(totalGroups) },
      { label: '80/20 Compliance', value: `${compPct}%` },
    ];

    const boxW = (pageW - 80 - 30) / 4;
    metrics.forEach((m, i) => {
      const x = 40 + i * (boxW + 10);
      doc.setFillColor(240, 253, 250);
      doc.roundedRect(x, y, boxW, 55, 4, 4, 'F');
      doc.setTextColor(42, 157, 143);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(m.value, x + boxW / 2, y + 25, { align: 'center' });
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, x + boxW / 2, y + 42, { align: 'center' });
    });

    y += 75;

    // Time by Domain Table
    doc.setTextColor(42, 157, 143);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Time by Domain', 40, y);
    y += 10;

    const domainRows = Object.entries(TIME_DOMAINS).map(([key, label]) => {
      const mins = domainMap[key] || 0;
      const hrs = Math.round((mins / 60) * 10) / 10;
      const pct = totalMin > 0 ? Math.round((mins / totalMin) * 100) : 0;
      return [label, `${hrs} hrs`, `${pct}%`];
    });

    autoTable(doc, {
      startY: y,
      head: [['Domain', 'Hours', '% of Total']],
      body: domainRows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
    });

    y = doc.lastAutoTable.finalY + 25;

    // Caseload Summary Table
    doc.setTextColor(42, 157, 143);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Caseload Summary', 40, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Count']],
      body: [
        ['Active Students', String(stats.totalStudents)],
        ['Tier 1 (Universal)', String(stats.tier1)],
        ['Tier 2 (Targeted)', String(stats.tier2)],
        ['Tier 3 (Intensive)', String(stats.tier3)],
        ['Active Groups', String(stats.activeGroups)],
        ['Parent/Family Communications', String(totalComms)],
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
    });

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 30;
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Generated by Beacon \u2014 Counselor Command Center | Clear Path Education Group',
      pageW / 2,
      footerY,
      { align: 'center' }
    );

    doc.save(`Beacon_Impact_Summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (e) {
      console.error('Impact PDF error:', e);
      alert('PDF generation failed: ' + (e.message || 'Unknown error'));
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ ...styles.heading, margin: 0 }}>Dashboard</h1>
        <button onClick={generateImpactPDF} style={styles.impactBtn}>
          {'\uD83D\uDCCA'} My Year
        </button>
      </div>

      {/* ─── My Day: Priority View ─── */}
      {myDay && (
        <div style={{ marginBottom: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* Greeting */}
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', marginBottom: 16 }}>
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {(counselor?.name || '').split(' ')[0] || 'Counselor'}.
          </div>

          {/* Priority: Overdue students */}
          {myDay.overdue.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Priority</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {myDay.overdue.map(s => {
                  const isTier3 = s.tier === 3;
                  return (
                    <div key={s.id} style={{
                      padding: '10px 14px', borderRadius: 8, borderLeft: `4px solid ${isTier3 ? '#ef4444' : '#f59e0b'}`,
                      background: isTier3 ? '#fef2f2' : '#fffbeb',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a2332' }}>
                            {isTier3 ? '\uD83D\uDD34' : '\uD83D\uDFE1'} See {sName(s)} today
                          </span>
                          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
                            (Tier {s.tier}, {s.daysSince} days overdue)
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                          style={{ fontSize: 12, fontWeight: 600, color: '#2A9D8F', background: 'none', border: '1px solid #2A9D8F', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Log Session &rarr;
                        </button>
                      </div>
                      {s.lastNotes && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
                          Last: &ldquo;{s.lastNotes.length > 60 ? s.lastNotes.slice(0, 60) + '...' : s.lastNotes}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scheduled sessions */}
          {myDay.scheduled.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Scheduled</div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 14px' }}>
                {myDay.scheduled.map((item, i) => (
                  <div key={item.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    borderBottom: i < myDay.scheduled.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#2A9D8F', minWidth: 42 }}>
                      {item.time || '--:--'}
                    </span>
                    <span style={{ fontSize: 14, color: '#374151' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open referrals */}
          {myDay.referrals.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referrals Waiting</div>
                <button
                  onClick={() => navigate('/referrals')}
                  style={{ fontSize: 12, fontWeight: 600, color: '#2A9D8F', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Review Referrals &rarr;
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {myDay.referrals.map(r => {
                  const urgColor = r.urgency === 'Urgent' ? '#ef4444' : r.urgency === 'Soon' ? '#f97316' : '#9ca3af';
                  const urgIcon = r.urgency === 'Urgent' ? '\uD83D\uDD34' : r.urgency === 'Soon' ? '\uD83D\uDFE0' : '\u26AA';
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: '#f9fafb', borderRadius: 8, fontSize: 13,
                    }}>
                      <span>{urgIcon}</span>
                      <span style={{ fontWeight: 600, color: '#1a2332' }}>{r.studentName}</span>
                      <span style={{ color: '#6b7280' }}>&mdash; {r.concern_type || 'general'} ({r.urgency || 'Routine'})</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{r.daysOpen}d ago</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {myDay.overdue.length === 0 && myDay.scheduled.length === 0 && myDay.referrals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#6b7280', fontSize: 14 }}>
              No urgent items today. You&rsquo;re all caught up!
            </div>
          )}

          {/* Footer stats */}
          <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', paddingTop: 10, borderTop: '1px solid #f3f4f6', marginTop: 4 }}>
            {myDay.compPct}% compliant &middot; {myDay.weekSessions} session{myDay.weekSessions !== 1 ? 's' : ''} this week &middot; {myDay.monthSessions} this month
          </div>
        </div>
      )}

      {/* Onboarding checklist — disappears once all steps complete */}
      <div style={{ marginBottom: 20 }}>
        <OnboardingChecklist counselorId={counselor?.id} />
      </div>

      {/* Weekly scorecard — "How am I doing?" */}
      <div style={{ marginBottom: 20 }}>
        <Scorecard counselorId={counselor?.id} counselor={counselor} />
      </div>

      {/* Quick Session Log action card */}
      <div
        onClick={() => setShowQuickSession(true)}
        style={styles.sessionCard}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span style={{ fontSize: 22 }}>{'\uD83D\uDCDD'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#134e4a' }}>Just finished a session?</div>
            <div style={{ fontSize: 13, color: '#5eead4', marginTop: 2 }}>Log it now &mdash; takes 10 seconds.</div>
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <div style={styles.grid}>
        {/* ─── Top Left: Today at a Glance ─── */}
        <div style={{ ...styles.card, cursor: 'pointer' }} onClick={() => navigate('/schedule')}>
          <h2 style={styles.cardTitle}>Today at a Glance</h2>
          <div style={styles.statRow}>
            <div style={styles.statBlock}>
              <span style={styles.statNum}>{stats.sessionsToday}</span>
              <span style={styles.statLabel}>Sessions Scheduled</span>
            </div>
            <div style={styles.statBlock}>
              <span style={{ ...styles.statNum, color: stats.pendingReferrals > 0 ? '#f59e0b' : undefined }}>{stats.pendingReferrals}</span>
              <span style={styles.statLabel}>Pending Referrals</span>
            </div>
            <div style={styles.statBlock}>
              <span style={{ ...styles.statNum, color: stats.missedAlerts > 0 ? '#ef4444' : undefined }}>{stats.missedAlerts}</span>
              <span style={styles.statLabel}>Cancelled Today</span>
            </div>
          </div>
        </div>

        {/* ─── Top Right: 80/20 Compliance ─── */}
        <div style={{ ...styles.card, textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/time-tracker')}>
          <h2 style={styles.cardTitle}>80/20 Compliance</h2>
          <div style={{ position: 'relative', display: 'inline-block', margin: '12px 0' }}>
            <ComplianceRing percentage={stats.compliancePct} />
            <div style={styles.ringText}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#1a2332' }}>{stats.compliancePct}%</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>YTD Counseling</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {stats.compliancePct >= 82 ? 'On track' : stats.compliancePct >= 78 ? 'Getting close to threshold' : 'Below compliance threshold'}
          </p>
          {/* Feature #8: 8-Week Trend Sparkline */}
          <TrendSparkline data={trendData} />
        </div>

        {/* ─── Bottom Left: Caseload Snapshot ─── */}
        <div style={{ ...styles.card, cursor: 'pointer' }} onClick={() => navigate('/students')}>
          <h2 style={styles.cardTitle}>Caseload Snapshot</h2>
          <div style={styles.statRow}>
            <div style={styles.statBlock}>
              <span style={styles.statNum}>{stats.totalStudents}</span>
              <span style={styles.statLabel}>Active Students</span>
            </div>
            <div style={styles.statBlock}>
              <span style={styles.statNum}>{stats.activeGroups}</span>
              <span style={styles.statLabel}>Active Groups</span>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {[
              { label: 'Tier 1', count: stats.tier1, color: '#22c55e' },
              { label: 'Tier 2', count: stats.tier2, color: '#f59e0b' },
              { label: 'Tier 3', count: stats.tier3, color: '#ef4444' },
            ].map((t) => (
              <div key={t.label} style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, margin: '0 auto 6px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2332' }}>{t.count}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Bottom Right: Time by Domain ─── */}
        <div style={{ ...styles.card, cursor: 'pointer' }} onClick={() => navigate('/time-tracker')}>
          <h2 style={styles.cardTitle}>Time by Domain (YTD)</h2>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={stats.domainHours} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v) => `${v} hrs`} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={18}>
                  {stats.domainHours.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── This Week Digest ─── */}
      {weekDigest && (
        <div style={{ ...styles.card, marginTop: 20 }}>
          <h2 style={{ ...styles.cardTitle, margin: '0 0 14px' }}>This Week</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 16 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
              const isCurrent = i === weekDigest.currentDayIdx;
              const isPast = i < weekDigest.currentDayIdx || (weekDigest.currentDayIdx < 0 && true);
              const hasActivity = weekDigest.dayActivity[i];
              return (
                <div key={day} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: isCurrent ? '#f0fdfa' : 'transparent',
                  border: isCurrent ? '1.5px solid #2A9D8F' : '1.5px solid transparent',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? '#2A9D8F' : '#6b7280', marginBottom: 6 }}>{day}</span>
                  {hasActivity ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="11" fill="#22c55e" />
                      <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="11" fill="none" stroke={isPast && !isCurrent ? '#d1d5db' : '#e5e7eb'} strokeWidth="2" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, color: '#374151', fontWeight: 500 }}>
            {weekDigest.sessionCount} session{weekDigest.sessionCount !== 1 ? 's' : ''} &middot; {weekDigest.studentCount} student{weekDigest.studentCount !== 1 ? 's' : ''} seen &middot; {weekDigest.referralCount} referral{weekDigest.referralCount !== 1 ? 's' : ''} addressed
          </div>
          {weekDigest.daysSinceActivity >= 3 && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: '#fffbeb', border: '1px solid #fde68a',
              fontSize: 13, color: '#92400e', lineHeight: 1.5,
            }}>
              {weekDigest.lastActivityDay
                ? `You haven't logged any activity since ${weekDigest.lastActivityDay}. Your 80/20 tracking needs daily entries to be accurate.`
                : 'You haven\'t logged any activity this week. Your 80/20 tracking needs daily entries to be accurate.'}
            </div>
          )}
        </div>
      )}

      {/* ─── Overdue Students Widget ─── */}
      {overdueStudents.length > 0 && (
        <div style={{ ...styles.card, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ ...styles.cardTitle, margin: 0 }}>Students Need Follow-Up</h2>
            <span style={{ ...styles.badge, background: '#ef4444' }}>{overdueStudents.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {overdueStudents.slice(0, 6).map((s) => {
              const isRed = s.daysSince >= 21;
              const bgColor = isRed ? '#fef2f2' : '#fffbeb';
              const borderColor = isRed ? '#fecaca' : '#fef3c7';
              const textColor = isRed ? '#991b1b' : '#92400e';
              const initial = (s.first_name || s.name || '?')[0].toUpperCase();
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: bgColor, border: `1px solid ${borderColor}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isRed ? '#fca5a5' : '#fcd34d',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: '#1a2332', fontSize: 14 }}>{sName(s)}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    background: s.tier === 3 ? '#fecaca' : '#fef3c7',
                    color: s.tier === 3 ? '#991b1b' : '#92400e',
                  }}>
                    Tier {s.tier}
                  </span>
                  <span style={{ fontSize: 13, color: textColor, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {s.daysSince} days since last session
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              );
            })}
          </div>
          {overdueStudents.length > 6 && (
            <div
              onClick={() => navigate('/students')}
              style={{ textAlign: 'center', marginTop: 12, fontSize: 13, fontWeight: 600, color: '#2A9D8F', cursor: 'pointer' }}
            >
              View all &rarr;
            </div>
          )}
        </div>
      )}

      {/* ─── Feature #6: Make-up Session Tracker ─── */}
      {makeupQueue.length > 0 && (
        <div style={{ ...styles.card, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ ...styles.cardTitle, margin: 0 }}>Make-up Sessions Needed</h2>
            <span style={styles.badge}>{makeupQueue.length}</span>
          </div>
          <div style={styles.makeupList}>
            {makeupQueue.map((item) => (
              <div
                key={item.id}
                style={styles.makeupRow}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.groupId) navigate(`/groups/${item.groupId}`);
                }}
              >
                <div style={styles.makeupStudent}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontWeight: 600, color: '#1a2332' }}>{item.studentName}</span>
                </div>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{item.sessionDate}</span>
                <span style={styles.makeupGroup}>{item.groupName}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Log FAB */}
      <button style={styles.fab} onClick={() => setShowQuickLog(true)} title="Quick time log">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      <QuickLogModal
        open={showQuickLog}
        onClose={(saved) => { setShowQuickLog(false); if (saved) loadData(); }}
        counselorId={counselor?.id}
      />

      <QuickSessionModal
        open={showQuickSession}
        onClose={(saved) => { setShowQuickSession(false); if (saved) { loadData(); loadMakeupQueue(); } }}
        counselorId={counselor?.id}
      />
    </div>
  );
}

/* ─── Styles ─── */
const styles = {
  page: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 700, color: '#1a2332', margin: '0 0 24px' },
  sessionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    marginBottom: 20,
    background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#6b7280', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statRow: { display: 'flex', gap: 20 },
  statBlock: { display: 'flex', flexDirection: 'column' },
  statNum: { fontSize: 32, fontWeight: 700, color: '#1a2332', lineHeight: 1.1 },
  statLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  ringText: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  fab: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#2A9D8F',
    border: 'none',
    boxShadow: '0 4px 14px rgba(42,157,143,0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    background: '#f59e0b',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '0 6px',
  },
  makeupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  makeupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s',
    background: '#fffbeb',
    border: '1px solid #fef3c7',
  },
  makeupStudent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  makeupGroup: {
    fontSize: 13,
    color: '#92400e',
    background: '#fef3c7',
    padding: '2px 8px',
    borderRadius: 4,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  impactBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#2A9D8F',
    background: '#fff',
    border: '1.5px solid #2A9D8F',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
};

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  content: {
    background: '#fff', borderRadius: 12, padding: 28, width: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: {
    width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
  },
  cancelBtn: {
    flex: 1, padding: '10px 0', background: '#f3f4f6', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
  saveBtn: {
    flex: 1, padding: '10px 0', background: '#2A9D8F', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
