import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { TIME_DOMAINS } from '../lib/constants';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  format, startOfMonth, endOfMonth, subMonths, parseISO,
  eachMonthOfInterval, subDays,
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── Constants ─── */
const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
const TIER_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };
const TEAL = '#2A9D8F';

const DOMAIN_COLORS = {
  guidance: '#2A9D8F',
  planning: '#3BB5A7',
  responsive: '#5CC8BC',
  system: '#94a3b8',
  non_counseling: '#cbd5e1',
};

const REFERRAL_COLORS = [
  '#2A9D8F', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316',
];

/* ─── Date range presets ─── */
function getPresetRange(preset) {
  const now = new Date();
  const thisMonth = now.getMonth(); // 0-indexed

  switch (preset) {
    case 'this_month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(endOfMonth(prev), 'yyyy-MM-dd') };
    }
    case 'this_semester': {
      const year = now.getFullYear();
      // Aug-Dec or Jan-May
      if (thisMonth >= 7) {
        return { from: `${year}-08-01`, to: `${year}-12-31` };
      }
      return { from: `${year}-01-01`, to: `${year}-05-31` };
    }
    case 'this_year':
      return { from: `${now.getFullYear()}-01-01`, to: format(now, 'yyyy-MM-dd') };
    default:
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
}

/* ─── ReportsPage ─── */
export default function ReportsPage() {
  const { counselor } = useAuth();

  /* Date range state */
  const [preset, setPreset] = useState('this_month');
  const [dateRange, setDateRange] = useState(() => getPresetRange('this_month'));

  /* Data state */
  const [loading, setLoading] = useState(true);
  const [activeCaseload, setActiveCaseload] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [counselingPct, setCounselingPct] = useState(0);
  const [tierData, setTierData] = useState([]);
  const [sessionsOverTime, setSessionsOverTime] = useState([]);
  const [domainData, setDomainData] = useState([]);
  const [referralPipeline, setReferralPipeline] = useState([]);
  const [groupUtilization, setGroupUtilization] = useState([]);

  /* Handle preset change */
  const handlePreset = (p) => {
    setPreset(p);
    setDateRange(getPresetRange(p));
  };

  /* Handle custom date input */
  const handleCustomDate = (field, value) => {
    setPreset('custom');
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  /* ─── Load all report data ─── */
  const loadReportData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);

    const { from, to } = dateRange;
    // Use school year start from counselor settings, fallback to Aug 1 of current school year
    const schoolYearStart = counselor.school_year_start
      || (new Date().getMonth() >= 7 ? `${new Date().getFullYear()}-08-01` : `${new Date().getFullYear() - 1}-08-01`);
    const yearStart = schoolYearStart;
    const yearEnd = format(new Date(), 'yyyy-MM-dd');

    try {
      const [
        studentsRes,
        sessionsRes,
        referralsRes,
        timeYtdRes,
        timePeriodRes,
        sessionsTrendRes,
        referralTypesRes,
        groupsRes,
        groupMembersRes,
        groupSessionsRes,
      ] = await Promise.all([
        // Active caseload (not date-filtered)
        db.select('students', {
          eq: { counselor_id: counselor.id, status: 'active' },
        }),

        // Sessions in period
        db.select('sessions', {
          eq: { counselor_id: counselor.id },
          gte: { session_date: from },
          lte: { session_date: to },
        }),

        // Pending referrals (not date-filtered) — fetch all for this counselor, filter client-side
        db.select('referrals', {
          eq: { counselor_id: counselor.id },
        }),

        // YTD time entries for compliance %
        db.select('time_entries', {
          eq: { counselor_id: counselor.id },
          gte: { entry_date: yearStart },
          lte: { entry_date: yearEnd },
        }),

        // Period time entries for domain breakdown
        db.select('time_entries', {
          eq: { counselor_id: counselor.id },
          gte: { entry_date: from },
          lte: { entry_date: to },
        }),

        // Sessions last 6 months for trend
        db.select('sessions', {
          eq: { counselor_id: counselor.id },
          gte: { session_date: format(subMonths(new Date(), 5), 'yyyy-MM-01') },
          lte: { session_date: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
        }),

        // Referral concern types for pipeline
        db.select('referrals', {
          eq: { counselor_id: counselor.id },
          gte: { created_at: from },
          lte: { created_at: to + 'T23:59:59' },
        }),

        // Groups for utilization
        db.select('groups', {
          eq: { counselor_id: counselor.id, status: 'active' },
        }),

        // All group_members (we'll filter by group ids client-side)
        db.select('group_members', {}),

        // All sessions for groups (we'll filter client-side)
        db.select('sessions', {
          eq: { counselor_id: counselor.id },
        }),
      ]);

      /* 1. Active caseload */
      const students = studentsRes.data || [];
      setActiveCaseload(students.length);

      /* Tier breakdown */
      const tiers = [1, 2, 3].map((t) => ({
        name: `Tier ${t}`,
        value: students.filter((s) => s.tier === t).length,
        fill: TIER_COLORS[t],
      }));
      setTierData(tiers);

      /* 2. Sessions this period */
      setSessionCount((sessionsRes.data || []).length);

      /* 3. Pending referrals */
      const allReferrals = referralsRes.data || [];
      const pending = allReferrals.filter((r) => r.status === 'open' || r.status === 'in_progress');
      setPendingReferrals(pending.length);

      /* 4. YTD counseling % */
      const ytdEntries = timeYtdRes.data || [];
      const totalMin = ytdEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 1;
      const counselingMin = ytdEntries
        .filter((e) => COUNSELING_DOMAINS.includes(e.domain))
        .reduce((s, e) => s + (e.duration_minutes || 0), 0);
      setCounselingPct(Math.round((counselingMin / totalMin) * 100));

      /* 5. Domain breakdown for period */
      const domainMap = {};
      (timePeriodRes.data || []).forEach((e) => {
        domainMap[e.domain] = (domainMap[e.domain] || 0) + e.duration_minutes;
      });
      const domainArr = Object.entries(TIME_DOMAINS).map(([key, label]) => ({
        name: label,
        hours: Math.round(((domainMap[key] || 0) / 60) * 10) / 10,
        fill: DOMAIN_COLORS[key] || '#94a3b8',
      }));
      setDomainData(domainArr);

      /* 6. Sessions over time (last 6 months) */
      const now = new Date();
      const months = eachMonthOfInterval({
        start: subMonths(startOfMonth(now), 5),
        end: startOfMonth(now),
      });
      const sessionsByMonth = {};
      (sessionsTrendRes.data || []).forEach((s) => {
        const key = s.session_date?.slice(0, 7); // YYYY-MM
        if (key) sessionsByMonth[key] = (sessionsByMonth[key] || 0) + 1;
      });
      const trendArr = months.map((m) => ({
        month: format(m, 'MMM yyyy'),
        sessions: sessionsByMonth[format(m, 'yyyy-MM')] || 0,
      }));
      setSessionsOverTime(trendArr);

      /* 7. Referral pipeline by concern_type */
      const refCounts = {};
      (referralTypesRes.data || []).forEach((r) => {
        const ct = r.concern_type || 'Unknown';
        refCounts[ct] = (refCounts[ct] || 0) + 1;
      });
      const refArr = Object.entries(refCounts)
        .map(([name, count], i) => ({ name, count, fill: REFERRAL_COLORS[i % REFERRAL_COLORS.length] }))
        .sort((a, b) => b.count - a.count);
      setReferralPipeline(refArr);

      /* 8. Group utilization — manually join groups, members, sessions, attendance */
      const groups = groupsRes.data || [];
      const allGroupMembers = groupMembersRes.data || [];
      const allSessions = groupSessionsRes.data || [];

      // Fetch attendance for all sessions
      const { data: allAttendance } = await db.select('attendance', {});

      const groupRows = groups.map((g) => {
        const members = allGroupMembers.filter((m) => m.group_id === g.id);
        const memberCount = members.length;
        const gSessions = allSessions.filter((s) => s.group_id === g.id);
        const periodSessions = gSessions.filter(
          (s) => s.session_date >= from && s.session_date <= to
        );
        const sessionCnt = periodSessions.length;

        let totalExpected = 0;
        let totalPresent = 0;
        periodSessions.forEach((s) => {
          const att = (allAttendance || []).filter((a) => a.session_id === s.id);
          totalExpected += memberCount;
          totalPresent += att.filter((a) => a.status === 'present').length;
        });
        const avgAttendance = totalExpected > 0
          ? Math.round((totalPresent / totalExpected) * 100)
          : 0;

        return {
          name: g.name,
          members: memberCount,
          sessions: sessionCnt,
          attendance: avgAttendance,
        };
      });
      setGroupUtilization(groupRows);
    } catch (err) {
      console.error('Reports data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [counselor, dateRange]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  /* ─── SCUTA-Formatted CSV Export ─── */
  const exportScutaCsv = async () => {
    if (!counselor?.id) return;
    const { from, to } = dateRange;

    // Fetch all data needed for SCUTA format
    const [studRes, sessRes, timeRes, refRes, grpRes, gmRes] = await Promise.all([
      db.select('students', { eq: { counselor_id: counselor.id } }),
      db.select('sessions', { eq: { counselor_id: counselor.id }, gte: { session_date: from }, lte: { session_date: to } }),
      db.select('time_entries', { eq: { counselor_id: counselor.id }, gte: { entry_date: from }, lte: { entry_date: to } }),
      db.select('referrals', { eq: { counselor_id: counselor.id } }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
      db.select('group_members', {}),
    ]);

    const students = studRes.data || [];
    const sessions = sessRes.data || [];
    const timeEntries = timeRes.data || [];
    const referrals = refRes.data || [];
    const groups = grpRes.data || [];
    const groupMembers = gmRes.data || [];
    const groupIds = new Set(groups.map(g => g.id));
    const counselorName = counselor.name || counselor.full_name || 'Counselor';
    const campusName = counselor.campus || counselor.school_name || '';
    const districtName = counselor.district || '';

    // ── Sheet 1: Student Services Log (SCUTA primary format) ──
    const serviceRows = sessions.map(s => {
      const student = students.find(st => st.id === s.student_id);
      const group = s.group_id ? groups.find(g => g.id === s.group_id) : null;
      const sessionType = s.group_id ? 'Group' : 'Individual';
      // Map domain to SCUTA service type
      const domain = s.domain || 'responsive';
      let scutaService = 'Responsive Services';
      if (domain === 'guidance') scutaService = 'Guidance Curriculum';
      else if (domain === 'planning') scutaService = 'Individual Student Planning';
      else if (domain === 'system') scutaService = 'System Support';
      else if (domain === 'non_counseling') scutaService = 'Non-Counseling Activity';

      return {
        'Date': s.session_date || '',
        'Counselor Name': counselorName,
        'Campus': campusName,
        'District': districtName,
        'Student Last Name': student?.name?.split(' ').slice(-1)[0] || '',
        'Student First Name': student?.name?.split(' ')[0] || '',
        'Grade Level': student?.grade || '',
        'Service Type': sessionType,
        'ASCA Domain': scutaService,
        'Group Name': group?.name || '',
        'Duration (Minutes)': s.duration_minutes || '',
        'Tier Level': student?.tier || 1,
        'Notes': (s.notes || '').replace(/[\n\r,]/g, ' ').slice(0, 200),
        'Status': s.status || '',
      };
    });

    // ── Sheet 2: Time Distribution Summary ──
    const domainTotals = {};
    timeEntries.forEach(e => {
      domainTotals[e.domain] = (domainTotals[e.domain] || 0) + (e.duration_minutes || 0);
    });
    const totalMinutes = Object.values(domainTotals).reduce((s, v) => s + v, 0) || 1;
    const timeSummary = Object.entries(TIME_DOMAINS).map(([key, label]) => ({
      'ASCA Domain': label,
      'Total Minutes': domainTotals[key] || 0,
      'Total Hours': ((domainTotals[key] || 0) / 60).toFixed(1),
      'Percentage': ((domainTotals[key] || 0) / totalMinutes * 100).toFixed(1) + '%',
      'Category': COUNSELING_DOMAINS.includes(key) ? 'Direct Services' : 'Indirect/Non-Counseling',
    }));

    const directMin = timeEntries
      .filter(e => COUNSELING_DOMAINS.includes(e.domain))
      .reduce((s, e) => s + (e.duration_minutes || 0), 0);
    timeSummary.push({
      'ASCA Domain': 'SB 179 COMPLIANCE',
      'Total Minutes': directMin,
      'Total Hours': (directMin / 60).toFixed(1),
      'Percentage': (directMin / totalMinutes * 100).toFixed(1) + '%',
      'Category': `${(directMin / totalMinutes * 100).toFixed(0)}% Direct (Target: 80%)`,
    });

    // ── Sheet 3: Caseload Summary ──
    const caseloadRows = students.map(s => {
      const studentSessions = sessions.filter(ss => ss.student_id === s.id);
      const studentReferrals = referrals.filter(r => r.student_id === s.id || r.student_name === s.name);
      const studentGroups = groupMembers.filter(gm => gm.student_id === s.id && groupIds.has(gm.group_id));
      return {
        'Student Last Name': s.name?.split(' ').slice(-1)[0] || '',
        'Student First Name': s.name?.split(' ')[0] || '',
        'Grade': s.grade || '',
        'Tier': s.tier || 1,
        'Status': s.status || 'active',
        'Referral Reason': s.referral_reason || '',
        'Sessions This Period': studentSessions.length,
        'Groups Enrolled': studentGroups.length,
        'Open Referrals': studentReferrals.filter(r => r.status === 'open' || r.status === 'in_progress').length,
        'Counselor': counselorName,
        'Campus': campusName,
      };
    });

    // ── Sheet 4: Referral Log ──
    const referralRows = referrals
      .filter(r => r.created_at >= from && r.created_at <= to + 'T23:59:59')
      .map(r => ({
        'Date Received': r.created_at ? r.created_at.slice(0, 10) : '',
        'Student Name': r.student_name || '',
        'Referred By': r.referred_by || '',
        'Concern Type': r.concern_type || '',
        'Urgency': r.urgency || '',
        'Status': r.status || '',
        'Notes': (r.notes || '').replace(/[\n\r,]/g, ' ').slice(0, 200),
        'Counselor': counselorName,
        'Campus': campusName,
      }));

    // Build multi-sheet CSV (separated by headers)
    const toCsvSection = (title, rows) => {
      if (!rows.length) return `\n--- ${title} ---\nNo data for selected period.\n`;
      const headers = Object.keys(rows[0]);
      const csvRows = rows.map(r => headers.map(h => {
        const val = String(r[h] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','));
      return `\n--- ${title} ---\n${headers.join(',')}\n${csvRows.join('\n')}\n`;
    };

    let csv = `SCUTA-Compatible Export — Beacon Counselor Command Center\n`;
    csv += `Counselor: ${counselorName} | Campus: ${campusName} | District: ${districtName}\n`;
    csv += `Period: ${from} to ${to} | Generated: ${new Date().toLocaleDateString()}\n`;
    csv += toCsvSection('STUDENT SERVICES LOG', serviceRows);
    csv += toCsvSection('TIME DISTRIBUTION SUMMARY', timeSummary);
    csv += toCsvSection('CASELOAD SUMMARY', caseloadRows);
    csv += toCsvSection('REFERRAL LOG', referralRows);

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beacon-scuta-export-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── PDF Export ─── */
  const exportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 50);
    doc.text('Beacon Analytics Report', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`${dateRange.from} to ${dateRange.to}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Summary
    doc.setFontSize(13);
    doc.setTextColor(55, 65, 81);
    doc.text('Summary', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Active Caseload', String(activeCaseload)],
        ['Sessions This Period', String(sessionCount)],
        ['Referrals Pending', String(pendingReferrals)],
        ['YTD Counseling Time %', `${counselingPct}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 143] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Caseload by Tier
    doc.setFontSize(13);
    doc.text('Caseload by Tier', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tier', 'Count']],
      body: tierData.map((t) => [t.name, String(t.value)]),
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 143] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Sessions Over Time
    doc.setFontSize(13);
    doc.text('Sessions Over Time (Last 6 Months)', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Month', 'Sessions']],
      body: sessionsOverTime.map((m) => [m.month, String(m.sessions)]),
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 143] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Time Domain Breakdown
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('Time Domain Breakdown', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Domain', 'Hours']],
      body: domainData.map((d) => [d.name, String(d.hours)]),
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 143] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Referral Pipeline
    if (referralPipeline.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('Referral Pipeline by Concern Type', 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['Concern Type', 'Count']],
        body: referralPipeline.map((r) => [r.name, String(r.count)]),
        theme: 'grid',
        headStyles: { fillColor: [42, 157, 143] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    // Group Utilization
    if (groupUtilization.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('Group Utilization', 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['Group', 'Members', 'Sessions', 'Avg Attendance']],
        body: groupUtilization.map((g) => [g.name, String(g.members), String(g.sessions), `${g.attendance}%`]),
        theme: 'grid',
        headStyles: { fillColor: [42, 157, 143] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`beacon-report-${dateRange.from}-to-${dateRange.to}.pdf`);
  };

  /* ─── Render ─── */
  return (
    <div style={styles.page}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={styles.heading}>Reports &amp; Analytics</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportScutaCsv} style={{ ...styles.exportBtn, background: '#0f766e' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            SCUTA Export
          </button>
          <button onClick={exportPdf} style={styles.exportBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* ─── Date Range Selector ─── */}
      <div style={styles.card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Period:</span>
          {[
            { key: 'this_month', label: 'This Month' },
            { key: 'last_month', label: 'Last Month' },
            { key: 'this_semester', label: 'This Semester' },
            { key: 'this_year', label: 'This Year' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              style={{
                ...styles.presetBtn,
                ...(preset === p.key ? styles.presetBtnActive : {}),
              }}
            >
              {p.label}
            </button>
          ))}
          <span style={{ color: '#d1d5db', margin: '0 4px' }}>|</span>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => handleCustomDate('from', e.target.value)}
            style={styles.dateInput}
          />
          <span style={{ color: '#6b7280', fontSize: 13 }}>to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => handleCustomDate('to', e.target.value)}
            style={styles.dateInput}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading report data...</div>
      ) : (
        <>
          {/* ─── Section 1: Summary Cards ─── */}
          <div style={styles.summaryGrid}>
            <SummaryCard label="Active Caseload" value={activeCaseload} color={TEAL} />
            <SummaryCard label="Sessions This Period" value={sessionCount} color="#6366f1" />
            <SummaryCard label="Referrals Pending" value={pendingReferrals} color={pendingReferrals > 0 ? '#f59e0b' : '#22c55e'} />
            <SummaryCard
              label="Counseling Time %"
              value={`${counselingPct}%`}
              color={counselingPct >= 80 ? '#22c55e' : counselingPct >= 70 ? '#f59e0b' : '#ef4444'}
              subtitle="YTD"
            />
          </div>

          {/* ─── Section 2: Charts row (Tier + Sessions Over Time) ─── */}
          <div style={styles.twoCol}>
            {/* Caseload by Tier */}
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Caseload by Tier</h3>
              {tierData.every((t) => t.value === 0) ? (
                <div style={styles.empty}>No active students</div>
              ) : (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={tierData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {tierData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sessions Over Time */}
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Sessions Over Time</h3>
              {sessionsOverTime.every((m) => m.sessions === 0) ? (
                <div style={styles.empty}>No sessions in last 6 months</div>
              ) : (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={sessionsOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="sessions"
                        stroke={TEAL}
                        strokeWidth={2}
                        dot={{ fill: TEAL, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ─── Section 3: Time Domain + Referral Pipeline ─── */}
          <div style={styles.twoCol}>
            {/* Time Domain Breakdown */}
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Time Domain Breakdown</h3>
              {domainData.every((d) => d.hours === 0) ? (
                <div style={styles.empty}>No time entries this period</div>
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={domainData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip formatter={(v) => `${v} hrs`} />
                      <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={20}>
                        {domainData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Referral Pipeline */}
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Referral Pipeline</h3>
              {referralPipeline.length === 0 ? (
                <div style={styles.empty}>No referrals this period</div>
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={referralPipeline} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                        {referralPipeline.map((r, i) => (
                          <Cell key={i} fill={r.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ─── Section 4: Group Utilization ─── */}
          <div style={{ ...styles.card, marginTop: 20 }}>
            <h3 style={styles.sectionTitle}>Group Utilization</h3>
            {groupUtilization.length === 0 ? (
              <div style={styles.empty}>No active groups</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Group Name</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Members</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Sessions</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Avg Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupUtilization.map((g, i) => (
                      <tr key={i} style={i % 2 === 0 ? {} : { background: '#f9fafb' }}>
                        <td style={styles.td}>{g.name}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{g.members}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{g.sessions}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 13,
                            fontWeight: 600,
                            background: g.attendance >= 80 ? '#dcfce7' : g.attendance >= 60 ? '#fef9c3' : '#fee2e2',
                            color: g.attendance >= 80 ? '#166534' : g.attendance >= 60 ? '#854d0e' : '#991b1b',
                          }}>
                            {g.attendance}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Summary Card Component ─── */
function SummaryCard({ label, value, color, subtitle }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

/* ─── Styles ─── */
const styles = {
  page: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 700, color: '#1a2332', margin: 0 },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 16px' },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
    marginTop: 20,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginTop: 20,
  },
  presetBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    fontSize: 13,
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  presetBtnActive: {
    background: TEAL,
    color: '#fff',
    borderColor: TEAL,
  },
  dateInput: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    color: '#374151',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(42,157,143,0.3)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    borderBottom: '2px solid #e5e7eb',
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #f3f4f6',
    color: '#1a2332',
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: '#9ca3af',
    fontSize: 14,
  },
};
