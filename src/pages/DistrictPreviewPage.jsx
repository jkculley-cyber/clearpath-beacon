/**
 * DistrictPreviewPage — "Pitch Your District" demo view.
 *
 * Read-only mock dashboard a counselor can show their director of counseling
 * to demonstrate what district-wide Beacon would look like. Pure render-from-static —
 * no real student data is touched, no IndexedDB writes happen.
 *
 * Three tabs:
 *   1. District at a Glance — KPIs, crisis response, sessions trend, time allocation, campus comparison, alerts
 *   2. Counselor Roster — 7 counselors with status, caseload, SB 179 compliance, doc completeness
 *   3. Reports & Exports — 5 sample exportable PDF/Excel reports
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DEMO_DISTRICT, DEMO_CAMPUSES, DEMO_COUNSELORS, DEMO_KPIS, DEMO_CRISIS,
  DEMO_MONTHLY_SESSIONS, DEMO_TIME_ALLOCATION, DEMO_CAMPUS_COMPARISON,
  DEMO_ALERTS, DEMO_CASELOAD_BY_TIER,
} from '../lib/districtPreviewData';

const STATUS_COLORS = {
  green: { bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
  amber: { bg: '#fef3c7', fg: '#a16207', dot: '#f59e0b' },
  red:   { bg: '#fee2e2', fg: '#b91c1c', dot: '#ef4444' },
};

const ALERT_BORDER = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };

export default function DistrictPreviewPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div style={pageStyle}>
      {/* Persistent demo banner */}
      <div style={demoBanner}>
        <strong>DEMO PREVIEW</strong> &nbsp;·&nbsp; Sample data only. Beacon never moves your real data without district authorization.
      </div>

      {/* Header */}
      <div style={headerStyle}>
        <div>
          <Link to="/" style={{ fontSize: 13, color: '#2A9D8F', textDecoration: 'none', fontWeight: 600 }}>← Back to Beacon</Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a2332', margin: '8px 0 4px' }}>
            Pitch Your District on Beacon
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            {DEMO_DISTRICT.name} &middot; {DEMO_DISTRICT.schoolYear} &middot; {DEMO_DISTRICT.asOfDate}
          </p>
        </div>
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0d9488' }}>
          <strong>$79</strong>/counselor/year &middot; same price for individuals or districts
        </div>
      </div>

      {/* Tab nav */}
      <div style={tabBar}>
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>District at a Glance</TabButton>
        <TabButton active={tab === 'roster'}   onClick={() => setTab('roster')}>Counselor Roster</TabButton>
        <TabButton active={tab === 'reports'}  onClick={() => setTab('reports')}>Reports & Exports</TabButton>
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'roster'   && <RosterTab />}
      {tab === 'reports'  && <ReportsTab />}

      <div style={footerStyle}>
        <strong>Ready to bring Beacon to your district?</strong>
        <p style={{ margin: '6px 0 14px', fontSize: 14, color: '#6b7280' }}>
          $79/counselor/year.
        </p>
        <a href="mailto:support@clearpathedgroup.com?subject=District%20adoption%20inquiry%20-%20Beacon" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Contact Clear Path Education Group →
        </a>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 18px',
      background: active ? '#fff' : 'transparent',
      border: 'none',
      borderBottom: active ? '3px solid #2A9D8F' : '3px solid transparent',
      color: active ? '#1a2332' : '#6b7280',
      fontWeight: active ? 700 : 500,
      fontSize: 14,
      cursor: 'pointer',
    }}>{children}</button>
  );
}

/* ─────── TAB 1 — Overview ─────── */
function OverviewTab() {
  return (
    <>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPICard label="Students Served YTD"        value={DEMO_KPIS.studentsServedYtd.toLocaleString()} />
        <KPICard label="Sessions YTD"               value={DEMO_KPIS.sessionsYtd.toLocaleString()} />
        <KPICard label="Open Referrals"             value={DEMO_KPIS.openReferrals} />
        <KPICard label="Hours Logged This Month"    value={DEMO_KPIS.hoursLoggedThisMonth.toLocaleString()} />
        <KPICard label="SB 179 80/20 District Avg"  value={DEMO_KPIS.sb179DistrictAverage + '%'} status={DEMO_KPIS.sb179DistrictAverage >= 80 ? 'green' : 'red'} />
        <KPICard label="FERPA Delete Requests"      value={DEMO_KPIS.ferpaDeleteRequests} sub="Honored YTD" />
      </div>

      {/* Crisis Response Card */}
      <div className="card" style={{ marginBottom: 20, padding: 20, borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2332' }}>Crisis Response Readiness</h3>
          <span style={{ fontSize: 11, padding: '2px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>SB 11 Compliance</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <CrisisStat label="Suicide Screenings YTD"       value={DEMO_CRISIS.suicideScreeningsYtd} />
          <CrisisStat label="Active Safety Plans"          value={DEMO_CRISIS.activeSafetyPlans} />
          <CrisisStat label="Threat Assessments"           value={DEMO_CRISIS.threatAssessmentsCompleted} sub="completed YTD" />
          <CrisisStat label="Avg Crisis Response"          value={DEMO_CRISIS.avgCrisisResponseHours + 'h'} sub="referral → action" />
          <CrisisStat label="Safety Plan 30-day Reviews"   value={DEMO_CRISIS.pendingSafetyPlanReviews} sub="due this week" status="amber" />
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <ChartCard title="Sessions per Month" subtitle={`${DEMO_KPIS.sessionsYtd.toLocaleString()} sessions YTD across district`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={DEMO_MONTHLY_SESSIONS}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="sessions" fill="#2A9D8F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Time Allocation" subtitle="This month — direct + indirect must be ≥ 80% per SB 179">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={DEMO_TIME_ALLOCATION} dataKey="hours" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {DEMO_TIME_ALLOCATION.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} hrs`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cross-campus comparison */}
      <ChartCard title="Cross-Campus Comparison" subtitle="Referrals + sessions + SB 179 compliance side by side">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={DEMO_CAMPUS_COMPARISON} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="campus" tick={{ fontSize: 11 }} width={150} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="sessions" fill="#2A9D8F" name="Sessions YTD" radius={[0, 4, 4, 0]} />
            <Bar dataKey="referrals" fill="#6366f1" name="Referrals YTD" radius={[0, 4, 4, 0]} />
            <Bar dataKey="sb179" fill="#f59e0b" name="SB 179 %" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Alerts */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', margin: '0 0 12px' }}>District Alerts</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {DEMO_ALERTS.map((alert, i) => (
            <div key={i} className="card" style={{ borderLeft: `4px solid ${ALERT_BORDER[alert.severity]}`, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', background: STATUS_COLORS[alert.severity].bg, color: STATUS_COLORS[alert.severity].fg, borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {alert.severity === 'red' ? 'Action Needed' : alert.severity === 'amber' ? 'Watch' : 'OK'}
                </span>
                <strong style={{ fontSize: 14, color: '#1a2332' }}>{alert.title}</strong>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 0 0', lineHeight: 1.5 }}>{alert.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────── TAB 2 — Roster ─────── */
function RosterTab() {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          {DEMO_COUNSELORS.length} counselors across {DEMO_CAMPUSES.length} campuses.
          Status combines SB 179 80/20 compliance with documentation completeness — green ≥80% on both, amber 70–79%, red &lt;70% on either.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
              <th style={th}>Status</th>
              <th style={th}>Counselor</th>
              <th style={th}>Campus</th>
              <th style={th}>Caseload</th>
              <th style={th}>Sessions / Wk</th>
              <th style={th}>Sessions YTD</th>
              <th style={th}>SB 179 %</th>
              <th style={th}>Doc Completeness</th>
              <th style={th}>Open Refs</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_COUNSELORS.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>
                  <StatusDot status={c.status} />
                </td>
                <td style={{ ...td, fontWeight: 600, color: '#1a2332' }}>{c.name}</td>
                <td style={td}>{c.campus}</td>
                <td style={td}>{c.caseload}</td>
                <td style={td}>{c.sessionsThisWeek}</td>
                <td style={td}>{c.sessionsYtd}</td>
                <td style={{ ...td, color: c.sb179 >= 80 ? '#15803d' : c.sb179 >= 75 ? '#a16207' : '#b91c1c', fontWeight: 600 }}>
                  {c.sb179}%
                </td>
                <td style={{ ...td, color: c.docCompleteness >= 90 ? '#15803d' : c.docCompleteness >= 80 ? '#a16207' : '#b91c1c', fontWeight: 600 }}>
                  {c.docCompleteness}%
                </td>
                <td style={td}>{c.openReferrals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <CampusCard campus={DEMO_CAMPUSES[0]} />
        <CampusCard campus={DEMO_CAMPUSES[1]} />
        <CampusCard campus={DEMO_CAMPUSES[2]} />
      </div>
    </>
  );
}

function CampusCard({ campus }) {
  const overRecommended = campus.ratio > 250;
  return (
    <div className="card" style={{ padding: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' }}>{campus.name}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={statSmall}>Students</div>
          <div style={statValue}>{campus.studentCount}</div>
        </div>
        <div>
          <div style={statSmall}>Counselors</div>
          <div style={statValue}>{campus.counselorCount}</div>
        </div>
        <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
          <div style={statSmall}>Student-to-counselor ratio</div>
          <div style={{ ...statValue, color: overRecommended ? '#b91c1c' : '#15803d' }}>
            {campus.ratio}:1
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginLeft: 6 }}>
              (ASCA recommends 250:1)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────── TAB 3 — Reports ─────── */
function ReportsTab() {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Five sample reports — click any to download a real PDF or Excel built from the demo data above.
          District Beacon ships with these formatted to your district letterhead and submitted-ready for board, TEA, and OCR audits.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <ReportCard
          title="Board Summary Report"
          format="PDF"
          desc="One-page district overview for school board agenda packets. Counselor counts, sessions YTD, SB 179 compliance, key wins."
          onDownload={generateBoardSummaryPdf}
        />
        <ReportCard
          title="Counselor Compliance Report"
          format="PDF"
          desc="SB 179 80/20 compliance per counselor with status flag and 30-day trend. Audit-ready signature line."
          onDownload={generateCounselorCompliancePdf}
        />
        <ReportCard
          title="Caseload by Tier Report"
          format="Excel"
          desc="Students segmented by MTSS Tier 1/2/3. Filter-ready for MTSS coordinator and SPED review."
          onDownload={generateCaseloadByTierCsv}
        />
        <ReportCard
          title="Annual ASCA Program Report"
          format="PDF"
          desc="ASCA Model–formatted annual report. Use of time analysis, program goals, closing-the-gap data. Drop into RAMP application."
          onDownload={generateAscaReportPdf}
        />
        <ReportCard
          title="Suicide Risk Screening Compliance"
          format="PDF"
          desc="SB 11 compliance summary: screenings completed, active safety plans, threat assessments, response times. Audit defense for TEA and family inquiries."
          onDownload={generateSuicideRiskComplianceReportPdf}
        />
        <ReportCard
          title="Board Presentation Slide Deck"
          format="PDF"
          desc="5-slide presentation deck formatted for school board meetings. Drop into your agenda packet or screen-share at budget season — each slide is a clean visual."
          onDownload={generateBoardSlideDeckPdf}
        />
      </div>
    </>
  );
}

function ReportCard({ title, format, desc, onDownload }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1a2332', margin: 0 }}>{title}</h4>
        <span style={{ fontSize: 10, padding: '2px 8px', background: format === 'PDF' ? '#fee2e2' : '#dcfce7', color: format === 'PDF' ? '#b91c1c' : '#15803d', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>{format}</span>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5, minHeight: 60 }}>{desc}</p>
      <button className="btn btn-outline" style={{ width: '100%', fontSize: 13 }} onClick={onDownload}>
        Download Sample
      </button>
    </div>
  );
}

/* ─────── PDF generators ─────── */

function pdfHeader(doc, title, subtitle) {
  doc.setFillColor(42, 157, 143);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BEACON', 15, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Counselor Command Center', 50, 15);

  doc.setTextColor(26, 35, 50);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, 38);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(subtitle, 15, 46);
  }
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 50, 195, 50);
}

function pdfFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.text('DEMO PREVIEW · Sample data only · Beacon by Clear Path Education Group, LLC', 15, pageHeight - 10);
}

function generateBoardSummaryPdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'District Counseling Board Summary', `${DEMO_DISTRICT.name} · ${DEMO_DISTRICT.schoolYear}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 35, 50);
  doc.text('Year-to-Date Highlights', 15, 60);

  const kpis = [
    ['Students served YTD', DEMO_KPIS.studentsServedYtd.toLocaleString()],
    ['Counseling sessions YTD', DEMO_KPIS.sessionsYtd.toLocaleString()],
    ['Active referrals (open)', String(DEMO_KPIS.openReferrals)],
    ['Hours logged this month', DEMO_KPIS.hoursLoggedThisMonth.toLocaleString()],
    ['SB 179 80/20 district average', DEMO_KPIS.sb179DistrictAverage + '%'],
    ['Suicide risk screenings YTD', String(DEMO_CRISIS.suicideScreeningsYtd)],
    ['Active safety plans', String(DEMO_CRISIS.activeSafetyPlans)],
  ];
  autoTable(doc, {
    startY: 64,
    head: [['Metric', 'Value']],
    body: kpis,
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  let nextY = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Campus Footprint', 15, nextY);
  autoTable(doc, {
    startY: nextY + 4,
    head: [['Campus', 'Students', 'Counselors', 'Ratio']],
    body: DEMO_CAMPUSES.map((c) => [c.name, c.studentCount, c.counselorCount, c.ratio + ':1']),
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  pdfFooter(doc);
  doc.save('Board_Summary_Demo.pdf');
}

function generateCounselorCompliancePdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'Counselor SB 179 Compliance Report', `${DEMO_DISTRICT.name} · ${DEMO_DISTRICT.schoolYear}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('Texas SB 179 (86th Leg., 2019, TEC §33.006) requires 80% of counselor time on direct/indirect counseling services.', 15, 60);

  autoTable(doc, {
    startY: 68,
    head: [['Counselor', 'Campus', 'SB 179 %', 'Doc Completeness', 'Status']],
    body: DEMO_COUNSELORS.map((c) => [
      c.name,
      c.campus,
      c.sb179 + '%',
      c.docCompleteness + '%',
      c.status === 'green' ? 'COMPLIANT' : c.status === 'amber' ? 'WATCH' : 'ACTION NEEDED',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      // Color-code the status column (last column, body cells only).
      if (data.section === 'body' && data.column.index === 4) {
        const v = data.cell.raw;
        if (v === 'COMPLIANT') data.cell.styles.textColor = [21, 128, 61];
        else if (v === 'WATCH') data.cell.styles.textColor = [161, 98, 7];
        else if (v === 'ACTION NEEDED') data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let y = doc.lastAutoTable.finalY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 35, 50);
  doc.text('Director of Counseling Signature', 15, y);
  doc.setDrawColor(180, 180, 180);
  doc.line(15, y + 12, 100, y + 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Date: ___________________', 110, y + 12);

  pdfFooter(doc);
  doc.save('Counselor_SB179_Compliance_Demo.pdf');
}

function generateCaseloadByTierCsv() {
  // Simple CSV — districts can open in Excel.
  const lines = ['Counselor,Campus,Caseload,Tier 1,Tier 2,Tier 3'];
  DEMO_COUNSELORS.forEach((c) => {
    // Distribute caseload roughly 88% / 9% / 3% (matches district totals)
    const t3 = Math.round(c.caseload * 0.03);
    const t2 = Math.round(c.caseload * 0.09);
    const t1 = c.caseload - t2 - t3;
    lines.push(`${c.name},${c.campus},${c.caseload},${t1},${t2},${t3}`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Caseload_By_Tier_Demo.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function generateAscaReportPdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'Annual ASCA National Model Program Report', `${DEMO_DISTRICT.name} · ${DEMO_DISTRICT.schoolYear}`);

  let y = 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 35, 50);
  doc.text('1. Use of Time Analysis', 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Activity Category', 'Hours', '% of Total']],
    body: (() => {
      const total = DEMO_TIME_ALLOCATION.reduce((s, d) => s + d.hours, 0);
      return DEMO_TIME_ALLOCATION.map((d) => [d.category, d.hours, ((d.hours / total) * 100).toFixed(0) + '%']);
    })(),
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Caseload by Tier (MTSS)', 15, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Tier', 'Student Count']],
    body: DEMO_CASELOAD_BY_TIER.map((t) => [t.tier, t.count]),
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Program Goals (sample)', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const goals = [
    'Increase Tier 2 small-group attendance from 78% to 85% by spring semester.',
    'Reduce average referral-to-first-contact time from 3.2 days to 2.0 days.',
    'Achieve 90%+ documentation completeness across all counselors by Q3.',
  ];
  goals.forEach((g, i) => {
    // Use a drawn circle for the bullet — works in any PDF viewer regardless of font encoding.
    doc.circle(20, y + 7 + i * 6, 0.8, 'F');
    doc.text(g, 24, y + 8 + i * 6);
  });

  pdfFooter(doc);
  doc.save('ASCA_Annual_Program_Report_Demo.pdf');
}

function generateBoardSlideDeckPdf() {
  // Landscape PDF, one slide per page. 5 slides total.
  const doc = new jsPDF({ orientation: 'landscape' });
  const W = 297; const H = 210;

  const slideHeader = (title) => {
    doc.setFillColor(42, 157, 143);
    doc.rect(0, 0, W, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BEACON · ' + DEMO_DISTRICT.name + ' · ' + DEMO_DISTRICT.schoolYear, 12, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(title, W - 12, 10, { align: 'right' });
  };
  const slideFooter = (n, total) => {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.text(`DEMO PREVIEW · Slide ${n} of ${total} · Sample data only`, W / 2, H - 6, { align: 'center' });
  };

  // ─── Slide 1 — Title ───
  slideHeader('Cover');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('Counseling Program Update', W / 2, 70, { align: 'center' });
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(42, 157, 143);
  doc.text(DEMO_DISTRICT.name, W / 2, 90, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(107, 114, 128);
  doc.text(DEMO_DISTRICT.schoolYear + ' · Mid-year Report', W / 2, 102, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Presented by: Director of Counseling', W / 2, 120, { align: 'center' });
  doc.text('To: Board of Trustees', W / 2, 128, { align: 'center' });
  slideFooter(1, 5);

  // ─── Slide 2 — KPIs ───
  doc.addPage();
  slideHeader('Year-to-Date Highlights');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Where We Are Today', 20, 38);
  const kpiBoxes = [
    { label: 'Students Served',     value: DEMO_KPIS.studentsServedYtd.toLocaleString(), color: [42, 157, 143] },
    { label: 'Sessions YTD',        value: DEMO_KPIS.sessionsYtd.toLocaleString(),       color: [99, 102, 241] },
    { label: 'SB 179 Compliance',   value: DEMO_KPIS.sb179DistrictAverage + '%',         color: [16, 185, 129] },
    { label: 'Hours This Month',    value: DEMO_KPIS.hoursLoggedThisMonth.toLocaleString(), color: [245, 158, 11] },
  ];
  let bx = 20;
  const bw = 60; const bh = 50;
  kpiBoxes.forEach((b, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = bx + col * (bw + 10); const y = 60 + row * (bh + 10);
    doc.setFillColor(b.color[0], b.color[1], b.color[2]);
    doc.roundedRect(x, y, bw, bh, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(b.value, x + bw / 2, y + 28, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(b.label, x + bw / 2, y + 42, { align: 'center' });
  });
  // Right side: takeaway
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Takeaway', 165, 62);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  const takeaway = doc.splitTextToSize('District counselors served 942 students through 3,175 documented sessions, with the district averaging 80% direct/indirect counseling time — at the SB 179 threshold.', 110);
  doc.text(takeaway, 165, 72);
  slideFooter(2, 5);

  // ─── Slide 3 — Compliance ───
  doc.addPage();
  slideHeader('Compliance');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Compliance Status', 20, 38);

  // SB 179 traffic light
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('SB 179 / TEC §33.006 — 80/20 Direct Services', 20, 60);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('Compliant counselors: 5 of 7 · Watch: 2 · Action needed: 1 (Robert Kim, 72%)', 20, 70);

  // SB 11 box
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  doc.text('SB 11 — Suicide Prevention & Threat Assessment', 20, 95);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const sb11lines = [
    `${DEMO_CRISIS.suicideScreeningsYtd} suicide risk screenings completed YTD`,
    `${DEMO_CRISIS.activeSafetyPlans} active safety plans on file across district`,
    `${DEMO_CRISIS.threatAssessmentsCompleted} threat assessments completed`,
    `${DEMO_CRISIS.avgCrisisResponseHours} hour average response time (referral to action)`,
    `${DEMO_CRISIS.pendingSafetyPlanReviews} safety plans pending 30-day review this week`,
  ];
  sb11lines.forEach((line, i) => {
    doc.circle(22, 105 + i * 7, 1.5, 'F');
    doc.text(line, 27, 106 + i * 7);
  });

  // FERPA
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  doc.text('FERPA — Student Records Privacy', 20, 160);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`${DEMO_KPIS.ferpaDeleteRequests} delete requests honored YTD · TX-NDPA on file with vendor`, 20, 170);
  slideFooter(3, 5);

  // ─── Slide 4 — Cross-campus ───
  doc.addPage();
  slideHeader('Campus Comparison');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Across Our Campuses', 20, 38);
  autoTable(doc, {
    startY: 50,
    head: [['Campus', 'Students', 'Counselors', 'Ratio', 'Sessions YTD', 'Referrals', 'SB 179 %']],
    body: DEMO_CAMPUSES.map((c, i) => {
      const cmp = DEMO_CAMPUS_COMPARISON[i] || {};
      return [c.name, c.studentCount, c.counselorCount, c.ratio + ':1', cmp.sessions || '-', cmp.referrals || '-', (cmp.sb179 || '-') + '%'];
    }),
    theme: 'grid',
    headStyles: { fillColor: [42, 157, 143], fontSize: 11 },
    bodyStyles: { fontSize: 10 },
    margin: { left: 20, right: 20 },
  });
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Recommendation', 20, doc.lastAutoTable.finalY + 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const rec = doc.splitTextToSize('Sample West Elementary averages 270:1 student-to-counselor ratio (above ASCA recommendation of 250:1). Consider adding a 0.5 FTE counselor at next budget cycle.', 250);
  doc.text(rec, 20, doc.lastAutoTable.finalY + 28);
  slideFooter(4, 5);

  // ─── Slide 5 — Investment ───
  doc.addPage();
  slideHeader('Investment');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('District-wide Beacon: The Math', 20, 38);

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  const totalCounselors = DEMO_COUNSELORS.length;
  const annualCost = totalCounselors * 79;
  doc.text(`${totalCounselors} counselors × $79 = $${annualCost.toLocaleString()}/year`, 20, 60);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  doc.text(`That is $${(annualCost / totalCounselors).toFixed(0)} per counselor per year — less than 0.05% of a counselor's salary.`, 20, 72);

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  doc.text('What the district gets', 20, 95);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const benefits = [
    'Audit-ready compliance documentation (SB 179, SB 11, FERPA, ASCA Model)',
    'Cross-campus visibility with this dashboard',
    'Documentation completeness tracking — defensible in TEA reviews and due-process',
    'Texas-NDPA on file with the vendor — pre-cleared by district legal',
    'Setup includes data migration assistance from existing tools (CountSel, spreadsheets, etc.)',
    'No volume discount needed — same per-counselor price for individuals and districts',
  ];
  benefits.forEach((b, i) => {
    doc.circle(22, 105 + i * 7, 1.5, 'F');
    doc.text(b, 27, 106 + i * 7);
  });

  doc.setFontSize(10); doc.setFont('helvetica', 'italic');
  doc.setTextColor(107, 114, 128);
  doc.text('Vendor: Clear Path Education Group, LLC · support@clearpathedgroup.com', 20, 175);
  slideFooter(5, 5);

  doc.save('Board_Presentation_Slide_Deck_Demo.pdf');
}

function generateSuicideRiskComplianceReportPdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'Suicide Risk Screening Compliance Report', `${DEMO_DISTRICT.name} · ${DEMO_DISTRICT.schoolYear}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('SB 11 (86th Leg., 2019) requires districts to maintain documented suicide prevention and threat assessment protocols.', 15, 60);

  autoTable(doc, {
    startY: 68,
    head: [['Metric', 'Value']],
    body: [
      ['Suicide risk screenings completed YTD', String(DEMO_CRISIS.suicideScreeningsYtd)],
      ['Active safety plans on file',           String(DEMO_CRISIS.activeSafetyPlans)],
      ['Threat assessments completed YTD',      String(DEMO_CRISIS.threatAssessmentsCompleted)],
      ['Average response time (referral to action)', DEMO_CRISIS.avgCrisisResponseHours + ' hours'],
      ['30-day safety plan reviews due this week', String(DEMO_CRISIS.pendingSafetyPlanReviews)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  let y = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 35, 50);
  doc.text('Active Safety Plan Distribution by Campus', 15, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Campus', 'Active Safety Plans', 'Counselor(s) Responsible']],
    body: [
      ['Sample Elementary',      '4', 'Nicole Hill, Sarah Chen'],
      ['Sample East Elementary', '3', 'Marcus Davis, Jennifer Lopez'],
      ['Sample West Elementary', '5', 'Lisa Anderson, Maria Rodriguez'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [42, 157, 143] },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('This report supports SB 11 audit defense and may be requested by TEA, OCR, or in due-process hearings.', 15, y);

  pdfFooter(doc);
  doc.save('Suicide_Risk_Screening_Compliance_Demo.pdf');
}

/* ─────── Reusable subcomponents ─────── */

function KPICard({ label, value, sub, status }) {
  const c = status ? STATUS_COLORS[status] : null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c ? c.fg : '#1a2332', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CrisisStat({ label, value, sub, status }) {
  const c = status ? STATUS_COLORS[status] : null;
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c ? c.fg : '#1a2332', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2332', margin: '0 0 2px' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function StatusDot({ status }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color: c.fg, fontWeight: 600, textTransform: 'uppercase' }}>{status}</span>
    </span>
  );
}

/* ─────── Styles ─────── */
const pageStyle = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 24px 48px',
  background: '#f9fafb',
  minHeight: '100vh',
};
const demoBanner = {
  background: '#fef3c7',
  borderBottom: '1px solid #fde68a',
  padding: '10px 20px',
  fontSize: 13,
  color: '#92400e',
  textAlign: 'center',
  margin: '0 -24px 24px',
};
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 16,
  flexWrap: 'wrap',
  gap: 12,
};
const tabBar = {
  display: 'flex',
  borderBottom: '1px solid #e5e7eb',
  marginBottom: 24,
  background: '#fafafa',
  padding: '0 8px',
};
const footerStyle = {
  marginTop: 32,
  padding: 24,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  textAlign: 'center',
};
const tooltipStyle = {
  fontSize: 12,
  background: '#1a2332',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
};
const th = { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '10px 14px', fontSize: 13, color: '#374151' };
const statSmall = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 };
const statValue = { fontSize: 18, fontWeight: 700, color: '#1a2332', marginTop: 2 };
