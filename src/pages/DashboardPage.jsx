import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TIME_DOMAINS } from '../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfWeek, subWeeks, format } from 'date-fns';

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
    await supabase.from('time_entries').insert({
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
  const [makeupQueue, setMakeupQueue] = useState([]);
  const [trendData, setTrendData] = useState([]);

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const [sessionsRes, referralsRes, studentsRes, groupsRes, timeRes, missedRes] = await Promise.all([
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('counselor_id', counselor.id).eq('session_date', today),
      supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('students').select('id, tier').eq('counselor_id', counselor.id).eq('status', 'active'),
      supabase.from('groups').select('id', { count: 'exact', head: true }).eq('counselor_id', counselor.id).eq('status', 'active'),
      supabase.from('time_entries').select('domain, duration_minutes').eq('counselor_id', counselor.id).gte('entry_date', yearStart),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('counselor_id', counselor.id).eq('session_date', today).eq('status', 'Cancelled'),
    ]);

    const students = studentsRes.data || [];
    const tier1 = students.filter((s) => s.tier === 1).length;
    const tier2 = students.filter((s) => s.tier === 2).length;
    const tier3 = students.filter((s) => s.tier === 3).length;

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

    setStats({
      sessionsToday: sessionsRes.count || 0,
      pendingReferrals: referralsRes.count || 0,
      missedAlerts: missedRes.count || 0,
      totalStudents: students.length,
      tier1,
      tier2,
      tier3,
      activeGroups: groupsRes.count || 0,
      compliancePct,
      domainHours,
    });
  }, [counselor]);

  /* ─── Feature #6: Make-up Session Tracker ─── */
  const loadMakeupQueue = useCallback(async () => {
    if (!counselor?.id) return;

    const { data } = await supabase
      .from('attendance')
      .select(`
        id,
        status,
        student_id,
        session_id,
        students ( id, name, first_name, last_name ),
        sessions ( id, session_date, group_id, groups ( id, name ) )
      `)
      .in('status', ['absent', 'makeup_needed'])
      .is('makeup_session_id', null);

    if (!data) {
      setMakeupQueue([]);
      return;
    }

    // Filter to only this counselor's students/sessions and build display list
    const queue = data
      .filter((row) => row.students && row.sessions)
      .map((row) => ({
        id: row.id,
        studentName: sName(row.students),
        sessionDate: row.sessions.session_date,
        groupName: row.sessions.groups?.name || 'Individual',
        groupId: row.sessions.group_id,
      }))
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

    setMakeupQueue(queue);
  }, [counselor]);

  /* ─── Feature #8: 8-Week Trend ─── */
  const loadTrend = useCallback(async () => {
    if (!counselor?.id) return;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const eightWeeksAgo = subWeeks(weekStart, 7); // 8 weeks total including current

    const { data } = await supabase
      .from('time_entries')
      .select('entry_date, domain, duration_minutes')
      .eq('counselor_id', counselor.id)
      .gte('entry_date', format(eightWeeksAgo, 'yyyy-MM-dd'));

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

  useEffect(() => {
    loadData();
    loadMakeupQueue();
    loadTrend();
  }, [loadData, loadMakeupQueue, loadTrend]);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Dashboard</h1>

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
    </div>
  );
}

/* ─── Styles ─── */
const styles = {
  page: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 700, color: '#1a2332', margin: '0 0 24px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
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
