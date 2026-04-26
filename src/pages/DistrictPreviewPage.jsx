/**
 * DistrictPreviewPage - "Pitch Your District" demo view.
 *
 * Read-only mock dashboard a counselor can show their director of counseling
 * to demonstrate what district-wide Beacon would look like. Pure render-from-static -
 * no real student data is touched, no IndexedDB writes happen.
 *
 * Three tabs:
 *   1. District at a Glance - KPIs, crisis response, sessions trend, time allocation, campus comparison, alerts
 *   2. Counselor Roster - 7 counselors with status, caseload, SB 179 compliance, doc completeness
 *   3. Reports & Exports - 5 sample exportable PDF/Excel reports
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
        <strong>DEMO PREVIEW</strong> &nbsp;|&nbsp; Sample data only. Beacon never moves your real data without district authorization.
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

/* ─────── TAB 1 - Overview ─────── */
function OverviewTab() {
  const [detail, setDetail] = useState(null);
  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)',
        border: '1px solid #99f6e4',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: '#0f766e',
        fontWeight: 500,
      }}>
        <span style={{ fontSize: 18 }} aria-hidden="true">👆</span>
        <span><strong>Click any stat, alert, or counselor row</strong> for the breakdown.</span>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPICard label="Students Served YTD"        value={DEMO_KPIS.studentsServedYtd.toLocaleString()} onClick={() => setDetail('studentsServed')} />
        <KPICard label="Sessions YTD"               value={DEMO_KPIS.sessionsYtd.toLocaleString()} onClick={() => setDetail('sessionsYtd')} />
        <KPICard label="Open Referrals"             value={DEMO_KPIS.openReferrals} onClick={() => setDetail('openReferrals')} />
        <KPICard label="Hours Logged This Month"    value={DEMO_KPIS.hoursLoggedThisMonth.toLocaleString()} onClick={() => setDetail('hoursLogged')} />
        <KPICard label="SB 179 80/20 District Avg"  value={DEMO_KPIS.sb179DistrictAverage + '%'} status={DEMO_KPIS.sb179DistrictAverage >= 80 ? 'green' : 'red'} onClick={() => setDetail('sb179')} />
        <KPICard label="FERPA Delete Requests"      value={DEMO_KPIS.ferpaDeleteRequests} sub="Honored YTD" onClick={() => setDetail('ferpa')} />
      </div>

      {/* Crisis Response Card */}
      <div className="card" style={{ marginBottom: 20, padding: 20, borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2332' }}>Crisis Response Readiness</h3>
          <span style={{ fontSize: 11, padding: '2px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>SB 11 Compliance</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <CrisisStat label="Suicide Screenings YTD"       value={DEMO_CRISIS.suicideScreeningsYtd} onClick={() => setDetail('crisisScreenings')} />
          <CrisisStat label="Active Safety Plans"          value={DEMO_CRISIS.activeSafetyPlans} onClick={() => setDetail('crisisSafetyPlans')} />
          <CrisisStat label="Threat Assessments"           value={DEMO_CRISIS.threatAssessmentsCompleted} sub="completed YTD" onClick={() => setDetail('crisisThreat')} />
          <CrisisStat label="Avg Crisis Response"          value={DEMO_CRISIS.avgCrisisResponseHours + 'h'} sub="referral to action" onClick={() => setDetail('crisisResponseTime')} />
          <CrisisStat label="Safety Plan 30-day Reviews"   value={DEMO_CRISIS.pendingSafetyPlanReviews} sub="due this week" status="amber" onClick={() => setDetail('crisisReviews')} />
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

        <ChartCard title="Time Allocation" subtitle="This month - direct + indirect must be ≥ 80% per SB 179">
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
            <button
              key={i}
              onClick={() => setDetail({ alertIndex: i })}
              className="card"
              style={{
                borderLeft: `4px solid ${ALERT_BORDER[alert.severity]}`,
                padding: 14,
                background: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                border: '1px solid #e5e7eb',
                borderLeftWidth: 4,
                borderLeftColor: ALERT_BORDER[alert.severity],
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', background: STATUS_COLORS[alert.severity].bg, color: STATUS_COLORS[alert.severity].fg, borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    {alert.severity === 'red' ? 'Action Needed' : alert.severity === 'amber' ? 'Watch' : 'OK'}
                  </span>
                  <strong style={{ fontSize: 14, color: '#1a2332' }}>{alert.title}</strong>
                </div>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>View →</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 0 0', lineHeight: 1.5 }}>{alert.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <DataDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

/* ─────── TAB 2 - Roster ─────── */
function RosterTab() {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          {DEMO_COUNSELORS.length} counselors across {DEMO_CAMPUSES.length} campuses.
          Status combines SB 179 80/20 compliance with documentation completeness - green ≥80% on both, amber 70-79%, red &lt;70% on either.
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

/* ─────── TAB 3 - Reports ─────── */
function ReportsTab() {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Five sample reports - click any to download a real PDF or Excel built from the demo data above.
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
          desc="ASCA Model-formatted annual report. Use of time analysis, program goals, closing-the-gap data. Drop into RAMP application."
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
          desc="5-slide presentation deck formatted for school board meetings. Drop into your agenda packet or screen-share at budget season - each slide is a clean visual."
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
  doc.text('DEMO PREVIEW | Sample data only | Beacon by Clear Path Education Group, LLC', 15, pageHeight - 10);
}

function generateBoardSummaryPdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'District Counseling Board Summary', `${DEMO_DISTRICT.name} | ${DEMO_DISTRICT.schoolYear}`);

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
  pdfHeader(doc, 'Counselor SB 179 Compliance Report', `${DEMO_DISTRICT.name} | ${DEMO_DISTRICT.schoolYear}`);

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
  // Simple CSV - districts can open in Excel.
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
  pdfHeader(doc, 'Annual ASCA National Model Program Report', `${DEMO_DISTRICT.name} | ${DEMO_DISTRICT.schoolYear}`);

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
    // Use a drawn circle for the bullet - works in any PDF viewer regardless of font encoding.
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
    doc.text('BEACON | ' + DEMO_DISTRICT.name + ' | ' + DEMO_DISTRICT.schoolYear, 12, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(title, W - 12, 10, { align: 'right' });
  };
  const slideFooter = (n, total) => {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.text(`DEMO PREVIEW | Slide ${n} of ${total} | Sample data only`, W / 2, H - 6, { align: 'center' });
  };

  // ─── Slide 1 - Title ───
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
  doc.text(DEMO_DISTRICT.schoolYear + ' | Mid-year Report', W / 2, 102, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Presented by: Director of Counseling', W / 2, 120, { align: 'center' });
  doc.text('To: Board of Trustees', W / 2, 128, { align: 'center' });
  slideFooter(1, 5);

  // ─── Slide 2 - KPIs ───
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
  const takeaway = doc.splitTextToSize('District counselors served 942 students through 3,175 documented sessions, with the district averaging 80% direct/indirect counseling time - at the SB 179 threshold.', 110);
  doc.text(takeaway, 165, 72);
  slideFooter(2, 5);

  // ─── Slide 3 - Compliance ───
  doc.addPage();
  slideHeader('Compliance');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Compliance Status', 20, 38);

  // SB 179 traffic light
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('SB 179 / TEC §33.006 - 80/20 Direct Services', 20, 60);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('Compliant counselors: 5 of 7 | Watch: 2 | Action needed: 1 (Robert Kim, 72%)', 20, 70);

  // SB 11 box
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  doc.text('SB 11 - Suicide Prevention & Threat Assessment', 20, 95);
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
  doc.text('FERPA - Student Records Privacy', 20, 160);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`${DEMO_KPIS.ferpaDeleteRequests} delete requests honored YTD | TX-NDPA on file with vendor`, 20, 170);
  slideFooter(3, 5);

  // ─── Slide 4 - Cross-campus ───
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

  // ─── Slide 5 - Investment ───
  doc.addPage();
  slideHeader('Investment');
  doc.setTextColor(26, 35, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('District-wide Beacon: The Math', 20, 38);

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  const totalCounselors = DEMO_COUNSELORS.length;
  const annualCost = totalCounselors * 79;
  doc.text(`${totalCounselors} counselors x $79 = $${annualCost.toLocaleString()}/year`, 20, 60);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  doc.text(`That is $${(annualCost / totalCounselors).toFixed(0)} per counselor per year - less than 0.05% of a counselor's salary.`, 20, 72);

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  doc.text('What the district gets', 20, 95);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const benefits = [
    'Audit-ready compliance documentation (SB 179, SB 11, FERPA, ASCA Model)',
    'Cross-campus visibility with this dashboard',
    'Documentation completeness tracking - defensible in TEA reviews and due-process',
    'Texas-NDPA on file with the vendor - pre-cleared by district legal',
    'Setup includes data migration assistance from existing tools (CountSel, spreadsheets, etc.)',
    'No volume discount needed - same per-counselor price for individuals and districts',
  ];
  benefits.forEach((b, i) => {
    doc.circle(22, 105 + i * 7, 1.5, 'F');
    doc.text(b, 27, 106 + i * 7);
  });

  doc.setFontSize(10); doc.setFont('helvetica', 'italic');
  doc.setTextColor(107, 114, 128);
  doc.text('Vendor: Clear Path Education Group, LLC | support@clearpathedgroup.com', 20, 175);
  slideFooter(5, 5);

  doc.save('Board_Presentation_Slide_Deck_Demo.pdf');
}

function generateSuicideRiskComplianceReportPdf() {
  const doc = new jsPDF();
  pdfHeader(doc, 'Suicide Risk Screening Compliance Report', `${DEMO_DISTRICT.name} | ${DEMO_DISTRICT.schoolYear}`);

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

function KPICard({ label, value, sub, status, onClick }) {
  const c = status ? STATUS_COLORS[status] : null;
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className="card"
      style={{
        padding: 14,
        background: '#fff',
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        border: '1px solid #e5e7eb',
        width: '100%',
        transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s',
      }}
      onMouseEnter={(e) => { if (interactive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#2A9D8F'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#e5e7eb'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
        {interactive && <span style={{ fontSize: 11, color: '#2A9D8F', fontWeight: 700 }}>→</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c ? c.fg : '#1a2332', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

function CrisisStat({ label, value, sub, status, onClick }) {
  const c = status ? STATUS_COLORS[status] : null;
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 8,
        margin: -8,
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        borderRadius: 6,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (interactive) e.currentTarget.style.background = '#fef2f2'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c ? c.fg : '#1a2332', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

/* ─────── Detail drill-down modal ─────── */

function DataDetailModal({ detail, onClose }) {
  if (!detail) return null;
  const content = getDetailContent(detail);
  if (!content) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: '100%',
          maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '8px 20px', fontSize: 12, color: '#92400e', textAlign: 'center', fontWeight: 600 }}>
          DEMO PREVIEW | Sample data
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a2332' }}>{content.title}</h2>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {content.sub && <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>{content.sub}</p>}
          {content.value && (
            <div style={{ fontSize: 36, fontWeight: 800, color: content.valueColor || '#2A9D8F', marginBottom: 16 }}>
              {content.value}
            </div>
          )}
          {content.body}
          {content.interpretation && (
            <div style={{ marginTop: 16, padding: 14, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, fontSize: 13, color: '#0f766e', lineHeight: 1.6 }}>
              <strong style={{ display: 'block', marginBottom: 4, color: '#0d9488' }}>What this means</strong>
              {content.interpretation}
            </div>
          )}
          <button onClick={onClose} className="btn btn-outline" style={{ marginTop: 16, width: '100%', fontSize: 13 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getDetailContent(detail) {
  // Alert click — { alertIndex: n }
  if (typeof detail === 'object' && detail.alertIndex != null) {
    const alert = DEMO_ALERTS[detail.alertIndex];
    if (!alert) return null;
    const sevLabel = alert.severity === 'red' ? 'ACTION NEEDED' : alert.severity === 'amber' ? 'WATCH' : 'OK';
    const sevColor = STATUS_COLORS[alert.severity].fg;
    return {
      title: alert.title,
      sub: alert.detail,
      value: sevLabel,
      valueColor: sevColor,
      body: (
        <div>
          <h4 style={miniHeading}>Recommended action</h4>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
            {RECOMMENDED_ACTIONS[detail.alertIndex]?.map((step, i) => <li key={i}>{step}</li>) || <li>Review and document next steps in counselor notes.</li>}
          </ol>
        </div>
      ),
    };
  }

  switch (detail) {
    case 'studentsServed': {
      const total = DEMO_CASELOAD_BY_TIER.reduce((s, t) => s + t.count, 0);
      return {
        title: 'Students Served YTD',
        value: DEMO_KPIS.studentsServedYtd.toLocaleString(),
        sub: 'Unique students who received at least one direct counseling service this school year, broken down by MTSS tier.',
        body: <MiniBarChart data={DEMO_CASELOAD_BY_TIER.map((t) => ({ label: t.tier, value: t.count, color: t.color }))} />,
        interpretation: `${total.toLocaleString()} total students on caseload. Healthy distribution leans heavy on Tier 1 (universal/preventive), with Tier 2 small-group at 8% and Tier 3 intensive at 3% — within ASCA-recommended ranges.`,
      };
    }
    case 'sessionsYtd':
      return {
        title: 'Sessions YTD',
        value: DEMO_KPIS.sessionsYtd.toLocaleString(),
        sub: 'Documented counseling sessions across the district. Both individual and group sessions count once per session, not per student.',
        body: <MiniBarChart data={DEMO_COUNSELORS.map((c) => ({ label: c.name.split(' ')[0], value: c.sessionsYtd, color: c.status === 'green' ? '#22c55e' : c.status === 'amber' ? '#f59e0b' : '#ef4444' }))} />,
        interpretation: 'Sessions per counselor range 385 to 510. Marcus Davis leads at 510 (12 years experience, lower caseload). Robert Kim trails at 385 — first-year counselor with assigned non-counseling duties pulling time away from direct services.',
      };
    case 'openReferrals': {
      const urgentMix = [
        { label: 'Urgent', value: 5, color: '#ef4444' },
        { label: 'Soon', value: 12, color: '#f59e0b' },
        { label: 'Routine', value: 20, color: '#6b7280' },
      ];
      return {
        title: 'Open Referrals',
        value: DEMO_KPIS.openReferrals,
        sub: 'Pending referrals that have not yet been accepted into individual or group services.',
        body: <MiniBarChart data={urgentMix} />,
        interpretation: '5 urgent referrals require same-week response. 12 marked Soon should be addressed within 2 weeks. 20 routine referrals queued for next available cycle. Open referral volume is consistent with mid-year norms.',
      };
    }
    case 'hoursLogged': {
      const total = DEMO_TIME_ALLOCATION.reduce((s, c) => s + c.hours, 0);
      const direct = DEMO_TIME_ALLOCATION[0].hours + DEMO_TIME_ALLOCATION[1].hours;
      const directPct = Math.round((direct / total) * 100);
      return {
        title: 'Hours Logged This Month',
        value: total.toLocaleString() + ' hrs',
        sub: 'All counselor work time, broken down by activity category. SB 179 / TEC §33.006 requires 80% on direct + indirect counseling services.',
        body: <MiniBarChart data={DEMO_TIME_ALLOCATION.map((d) => ({ label: d.category, value: d.hours, color: d.color }))} />,
        interpretation: `${directPct}% of counselor time is on direct + indirect counseling services this month — at the SB 179 threshold. Pulling counselors off testing coordination (currently 5%) is the easiest lever to push compliance higher.`,
      };
    }
    case 'sb179':
      return {
        title: 'SB 179 80/20 Compliance — District Average',
        value: DEMO_KPIS.sb179DistrictAverage + '%',
        valueColor: DEMO_KPIS.sb179DistrictAverage >= 80 ? '#15803d' : '#b91c1c',
        sub: 'Per-counselor SB 179 compliance percentage (TEC §33.006). 80% is the statutory threshold for direct + indirect counseling services.',
        body: <MiniBarChart
          threshold={80}
          data={DEMO_COUNSELORS.map((c) => ({
            label: c.name.split(' ')[0],
            value: c.sb179,
            color: c.sb179 >= 80 ? '#22c55e' : c.sb179 >= 75 ? '#f59e0b' : '#ef4444',
          }))}
        />,
        interpretation: '5 of 7 counselors meet the 80% threshold. 2 in the 75-79% watch zone (Sarah Chen, Maria Rodriguez). 1 noncompliant: Robert Kim at 72% — first-year counselor; reassigning his non-counseling duties for one quarter typically lifts compliance into the green.',
      };
    case 'ferpa':
      return {
        title: 'FERPA Delete Requests',
        value: DEMO_KPIS.ferpaDeleteRequests,
        sub: 'Parent / guardian requests to delete a student record under FERPA (34 C.F.R. §99.20–22), honored year-to-date.',
        body: (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
            <strong>Process:</strong> Each delete request is logged with date received, reviewer, and date fulfilled. Records are removed from local IndexedDB (or Supabase, district mode) and confirmed in writing to the requestor.<br /><br />
            <strong>Average fulfillment time:</strong> Same-day response, full deletion within 3 school days.
          </div>
        ),
        interpretation: 'Districts are not required to honor every delete request — FERPA permits retention when records are needed for legal compliance or institutional accountability. Beacon flags those exceptions for review before action.',
      };
    case 'crisisScreenings': {
      const byMonth = [
        { label: 'Aug', value: 3, color: '#ef4444' },
        { label: 'Sep', value: 6, color: '#ef4444' },
        { label: 'Oct', value: 8, color: '#ef4444' },
        { label: 'Nov', value: 5, color: '#ef4444' },
        { label: 'Dec', value: 4, color: '#ef4444' },
        { label: 'Jan', value: 9, color: '#ef4444' },
        { label: 'Feb', value: 7, color: '#ef4444' },
        { label: 'Mar', value: 5, color: '#ef4444' },
      ];
      return {
        title: 'Suicide Risk Screenings YTD',
        value: DEMO_CRISIS.suicideScreeningsYtd,
        sub: 'Documented suicide risk screenings completed this school year, monthly. Required under SB 11 (86th Leg., 2019) when a student is referred for self-harm concern.',
        body: <MiniBarChart data={byMonth} />,
        interpretation: 'Screenings tend to spike in January (return from winter break) and October. Every screening is documented with date, screener, instrument used (Columbia, ASQ), outcome, and follow-up plan — audit-ready for TEA reviews.',
      };
    }
    case 'crisisSafetyPlans': {
      const byCampus = [
        { label: 'Sample ES',      value: 4, color: '#ef4444' },
        { label: 'Sample East ES', value: 3, color: '#ef4444' },
        { label: 'Sample West ES', value: 5, color: '#ef4444' },
      ];
      return {
        title: 'Active Safety Plans',
        value: DEMO_CRISIS.activeSafetyPlans,
        sub: 'Students with documented safety plans on file, broken down by campus. Each plan is reviewed every 30 days.',
        body: <MiniBarChart data={byCampus} />,
        interpretation: '12 students currently have active safety plans. Sample West has the highest concentration (5) and the largest caseload — counselor coverage there is monitored. 3 plans are due for 30-day review this week (see "Safety Plan 30-day Reviews" stat).',
      };
    }
    case 'crisisThreat':
      return {
        title: 'Threat Assessments Completed',
        value: DEMO_CRISIS.threatAssessmentsCompleted,
        sub: 'Multidisciplinary threat assessments conducted this school year per district SB 11 protocol. Each involves a counselor, administrator, and (when applicable) school resource officer.',
        body: (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
            <strong>Most recent (last 60 days):</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 22 }}>
              <li>2 low-risk findings, no further action needed</li>
              <li>1 moderate-risk finding, ongoing safety plan + parent contact</li>
              <li>1 escalated to law enforcement consult (per protocol)</li>
            </ul>
          </div>
        ),
        interpretation: 'Threat assessments are formally documented per SB 11 + 19 TAC Chapter 103. Beacon stores the assessment record, the team roster, the determination, and the follow-up actions in one place — defensible if the district faces a TEA review or due-process hearing.',
      };
    case 'crisisResponseTime':
      return {
        title: 'Average Crisis Response Time',
        value: DEMO_CRISIS.avgCrisisResponseHours + ' hours',
        sub: 'Average elapsed time from referral submission to counselor first action (initial contact, screening, or safety plan).',
        body: (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
            <strong>Distribution:</strong><br />
            Within 1 hour: 62%<br />
            1–4 hours: 28%<br />
            Same school day: 8%<br />
            Next school day: 2%
          </div>
        ),
        interpretation: 'Best practice for an urgent referral is contact within 1 school day. District is well below that, with 90% of crisis referrals reaching the counselor within 4 hours. The 2% next-day cases are typically referrals submitted after-hours.',
      };
    case 'crisisReviews':
      return {
        title: 'Safety Plan 30-Day Reviews — Due This Week',
        value: DEMO_CRISIS.pendingSafetyPlanReviews,
        valueColor: '#a16207',
        sub: 'Students with active safety plans that require a 30-day review this week. Reviews verify the plan is still appropriate and document any changes.',
        body: (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
            <strong>Pending this week:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 22 }}>
              <li>Student #A — Sample West ES — assigned: Lisa Anderson</li>
              <li>Student #B — Sample West ES — assigned: Maria Rodriguez</li>
              <li>Student #C — Sample East ES — assigned: Marcus Davis</li>
            </ul>
          </div>
        ),
        interpretation: 'Reviews block-scheduled for Wednesday. Counselors meet with the student, update the plan as needed, document the review, and — if changes warrant — re-engage parents. Beacon auto-flags the next 30-day check before it lapses.',
      };
    default:
      return null;
  }
}

const RECOMMENDED_ACTIONS = [
  // Index matches DEMO_ALERTS order
  [ // 0: SB 179 noncompliance risk (Robert Kim)
    'Review Robert Kim\'s last 4 weeks of time entries to identify the largest non-counseling time sinks.',
    'Reassign at least one block of testing coordination or substitute coverage to a non-counseling staff member.',
    'Schedule a 15-minute coaching check-in for Friday to confirm the calendar shift.',
    'Re-run the SB 179 report next Friday — target 78%+ to exit the red zone.',
  ],
  [ // 1: Caseload over ASCA
    'Pull Sample West Elementary enrollment + counselor staffing into the next budget proposal.',
    'Document specific service gaps caused by the 270:1 ratio (referral wait times, group capacity).',
    'Cite ASCA recommendation (250:1) and Texas Counselor Association guidance.',
    'Propose 0.5 FTE counselor at next cabinet meeting.',
  ],
  [ // 2: Active safety plans pending 30-day review
    'Confirm Wednesday block-scheduling on counselor calendars.',
    'Pull each student\'s current plan and any incident updates from the last 30 days.',
    'Document review meeting outcome (continue / modify / close) per district protocol.',
    'Re-engage parent if plan changes — log the contact in Beacon\'s communication record.',
  ],
  [ // 3: Documentation completeness below 80%
    'Pull Robert Kim\'s last 4 weeks of session notes and identify entries marked draft / unfinished.',
    'Schedule a 30-minute coaching session focused on session-note efficiency (templates, voice-to-text).',
    'Re-check completeness in 2 weeks — target 90%+.',
    'If pattern persists, evaluate whether caseload reassignment is warranted.',
  ],
];

function MiniBarChart({ data, threshold }) {
  const max = Math.max(...data.map((d) => d.value), threshold || 0);
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i === data.length - 1 ? 0 : 8 }}>
          <div style={{ width: 110, fontSize: 12, color: '#374151', textAlign: 'right', fontWeight: 500 }}>{d.label}</div>
          <div style={{ flex: 1, position: 'relative', height: 20, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(d.value / max) * 100}%`, background: d.color || '#2A9D8F', transition: 'width 0.3s' }} />
            {threshold != null && (
              <div style={{ position: 'absolute', left: `${(threshold / max) * 100}%`, top: -2, bottom: -2, width: 2, background: '#1a2332' }} title={`Threshold: ${threshold}`} />
            )}
          </div>
          <div style={{ width: 50, fontSize: 13, fontWeight: 700, color: '#1a2332', textAlign: 'right' }}>{d.value}</div>
        </div>
      ))}
      {threshold != null && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: '#1a2332' }} />
          <span>Threshold: {threshold}{typeof threshold === 'number' && threshold <= 100 ? '%' : ''}</span>
        </div>
      )}
    </div>
  );
}

const miniHeading = { fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' };

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
