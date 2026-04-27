import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { TIME_DOMAINS } from '../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DOMAIN_KEYS = Object.keys(TIME_DOMAINS);
const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
const TEAL = [42, 157, 143];

/* ---- PDF helpers ---- */
function pdfHeader(doc, title, counselorName, rangeLabel) {
  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(title, 14, 22);
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(counselorName, 14, 32);
  doc.setFontSize(10);
  doc.text(rangeLabel, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);
}

function pdfFooter(doc) {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Beacon \u2014 Counselor Command Center | Clear Path Education Group', 14, 285);
}

async function fetchEntriesRange(counselorId, from, to) {
  const { data } = await db.select('time_entries', {
    eq: { counselor_id: counselorId },
    gte: { entry_date: from },
    lte: { entry_date: to },
    order: { column: 'entry_date', ascending: true },
  });
  return data || [];
}

function buildSummary(entries) {
  const totalMin = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const counselingMin = entries
    .filter((e) => COUNSELING_DOMAINS.includes(e.domain))
    .reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const nonCounselingMin = totalMin - counselingMin;
  const pct = totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : 0;
  return {
    totalHrs: Math.round((totalMin / 60) * 10) / 10,
    counselingHrs: Math.round((counselingMin / 60) * 10) / 10,
    nonCounselingHrs: Math.round((nonCounselingMin / 60) * 10) / 10,
    pct,
  };
}

function generateRangePDF(entries, counselorName, rangeLabel, filename) {
  const doc = new jsPDF();
  pdfHeader(doc, 'Time Compliance Report', counselorName, rangeLabel);

  const { totalHrs, counselingHrs, nonCounselingHrs, pct } = buildSummary(entries);

  let y = 52;
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Summary', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total Hours: ${totalHrs}`, 14, y);
  doc.text(`Counseling Hours: ${counselingHrs}`, 100, y);
  y += 6;
  doc.text(`Non-Counseling Hours: ${nonCounselingHrs}`, 14, y);
  doc.text(`Compliance: ${pct}%`, 100, y);
  y += 10;

  // Entry detail table
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Domain', 'Activity', 'Duration (min)', 'Notes']],
    body: entries.map((e) => [
      e.entry_date,
      TIME_DOMAINS[e.domain] || e.domain,
      e.activity_description || '',
      e.duration_minutes,
      (e.notes || '').slice(0, 60),
    ]),
    headStyles: { fillColor: TEAL },
    margin: { left: 14 },
    columnStyles: { 4: { cellWidth: 45 } },
    styles: { fontSize: 9 },
  });

  pdfFooter(doc);
  doc.save(filename);
}

function generateAnnualPDF(entries, counselorName, yearLabel, filename) {
  const doc = new jsPDF();
  pdfHeader(doc, 'Annual Time Compliance Report', counselorName, yearLabel);

  // Build monthly breakdown
  const months = {};
  entries.forEach((e) => {
    const mKey = e.entry_date.slice(0, 7); // YYYY-MM
    if (!months[mKey]) months[mKey] = [];
    months[mKey].push(e);
  });
  const monthRows = Object.keys(months).sort().map((mKey) => {
    const mEntries = months[mKey];
    const { counselingHrs, nonCounselingHrs, pct } = buildSummary(mEntries);
    const label = new Date(mKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    return [label, counselingHrs, nonCounselingHrs, `${pct}%`];
  });

  const overall = buildSummary(entries);

  let y = 52;
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Summary', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total Hours: ${overall.totalHrs}`, 14, y);
  doc.text(`Counseling: ${overall.counselingHrs}`, 80, y);
  doc.text(`Non-Counseling: ${overall.nonCounselingHrs}`, 130, y);
  y += 6;
  doc.text(`Overall Compliance: ${overall.pct}%`, 14, y);
  y += 10;

  // Monthly breakdown table
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Monthly Breakdown', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Month', 'Counseling Hrs', 'Non-Counseling Hrs', 'Compliance %']],
    body: monthRows,
    headStyles: { fillColor: TEAL },
    margin: { left: 14 },
    styles: { fontSize: 9 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Detailed entries
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Detailed Entries', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Domain', 'Activity', 'Duration (min)', 'Notes']],
    body: entries.map((e) => [
      e.entry_date,
      TIME_DOMAINS[e.domain] || e.domain,
      e.activity_description || '',
      e.duration_minutes,
      (e.notes || '').slice(0, 60),
    ]),
    headStyles: { fillColor: TEAL },
    margin: { left: 14 },
    columnStyles: { 4: { cellWidth: 45 } },
    styles: { fontSize: 9 },
  });

  pdfFooter(doc);
  doc.save(filename);
}

/* ---- SB 179 Compliance Report ---- */
function generateSB179PDF(entries, counselor, periodLabel, from, to, filename) {
  const doc = new jsPDF();
  const counselorName = counselor?.name || counselor?.full_name || 'Counselor';
  const campus = counselor?.school_name || counselor?.campus || '';

  // Header
  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text('SB 179 Compliance Report', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text('School Counselor Service Hour Summary', 14, 29);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  let y = 42;
  const drawRow = (label, value) => {
    doc.setFont('helvetica', 'bold');
    const labelText = `${label}: `;
    doc.text(labelText, 14, y);
    const w = doc.getTextWidth(labelText);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || ''), 14 + w, y);
    y += 6;
  };
  drawRow('Counselor', counselorName);
  if (campus) drawRow('Campus', campus);
  drawRow('Reporting Period', periodLabel);
  drawRow('Dates Covered', `${from} through ${to}`);
  drawRow('Date Generated', new Date().toLocaleDateString());
  y += 2;

  // Domain totals
  const byDomain = {};
  Object.keys(TIME_DOMAINS).forEach(k => { byDomain[k] = 0; });
  entries.forEach(e => { byDomain[e.domain] = (byDomain[e.domain] || 0) + (e.duration_minutes || 0); });
  const totalMin = Object.values(byDomain).reduce((a, b) => a + b, 0);
  const directMin = COUNSELING_DOMAINS.reduce((s, d) => s + (byDomain[d] || 0), 0);
  const indirectMin = totalMin - directMin;
  const pct = totalMin > 0 ? (directMin / totalMin) * 100 : 0;
  const compliant = pct >= 80;

  // Direct services table
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('Direct Counseling Services (SB 179)', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Domain', 'Hours', 'Minutes']],
    body: [
      ...COUNSELING_DOMAINS.map(k => [TIME_DOMAINS[k], ((byDomain[k] || 0) / 60).toFixed(1), byDomain[k] || 0]),
      [{ content: 'Total Direct', styles: { fontStyle: 'bold' } }, { content: (directMin / 60).toFixed(1), styles: { fontStyle: 'bold' } }, { content: directMin, styles: { fontStyle: 'bold' } }],
    ],
    headStyles: { fillColor: TEAL, fontSize: 10 },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 30 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Indirect services table
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('Indirect / Non-Counseling', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Domain', 'Hours', 'Minutes']],
    body: [
      ...['system', 'non_counseling'].map(k => [TIME_DOMAINS[k], ((byDomain[k] || 0) / 60).toFixed(1), byDomain[k] || 0]),
      [{ content: 'Total Indirect', styles: { fontStyle: 'bold' } }, { content: (indirectMin / 60).toFixed(1), styles: { fontStyle: 'bold' } }, { content: indirectMin, styles: { fontStyle: 'bold' } }],
    ],
    headStyles: { fillColor: [107, 114, 128], fontSize: 10 },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 30 } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Compliance summary box
  if (y > 230) { doc.addPage(); y = 20; }
  const boxColor = compliant ? [22, 163, 74] : [239, 68, 68];
  doc.setFillColor(...(compliant ? [240, 253, 244] : [254, 242, 242]));
  doc.setDrawColor(...boxColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 182, 32, 3, 3, 'FD');
  doc.setTextColor(...boxColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('80/20 Compliance Status', 20, y + 8);
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Hours Logged: ${(totalMin / 60).toFixed(1)} hrs`, 20, y + 16);
  doc.text(`Direct Service Percentage: ${pct.toFixed(1)}%`, 20, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...boxColor);
  doc.text(compliant ? 'IN COMPLIANCE (80%+ direct)' : 'BELOW THRESHOLD', 20, y + 28);
  y += 40;

  // TEC cite
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  const note = doc.splitTextToSize(
    'Per SB 179 (TEC §33.006), school counselors shall spend at least 80% of work time on direct counseling services. Hours shown are auto-computed from time entries logged in Beacon during the reporting period.',
    182
  );
  doc.text(note, 14, y);
  y += note.length * 4 + 6;

  // Signature block
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(14, y + 10, 90, y + 10);
  doc.line(110, y + 10, 186, y + 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Counselor Signature / Date', 14, y + 15);
  doc.text('Principal Review Signature / Date', 110, y + 15);
  y += 22;

  // Detailed entries
  if (entries.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(...TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Entries', 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Domain', 'Activity', 'Min']],
      body: entries.map(e => [
        e.entry_date,
        TIME_DOMAINS[e.domain] || e.domain,
        (e.activity_description || '').slice(0, 70),
        e.duration_minutes,
      ]),
      headStyles: { fillColor: TEAL, fontSize: 9 },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 25 }, 3: { cellWidth: 18, halign: 'right' } },
    });
  }

  pdfFooter(doc);
  doc.save(filename);
}

/* ---- SB 179 Report Modal ---- */
function SB179Modal({ open, onClose, onGenerate, counselor }) {
  const [preset, setPreset] = useState('ytd');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  if (!open) return null;

  const now = new Date();
  const syStart = counselor?.school_year_start
    || (now.getMonth() >= 7 ? `${now.getFullYear()}-08-01` : `${now.getFullYear() - 1}-08-01`);
  const syEnd = counselor?.school_year_end
    || (now.getMonth() >= 7 ? `${now.getFullYear() + 1}-07-31` : `${now.getFullYear()}-07-31`);

  const resolvePeriod = () => {
    const today = format(now, 'yyyy-MM-dd');
    if (preset === 'month') {
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
        label: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      };
    }
    if (preset === 'semester') {
      // Fall: syStart → Dec 31; Spring: Jan 1 → syEnd
      const inFall = now.getMonth() >= 7 || now.getMonth() === 11;
      if (now.getMonth() >= 7) {
        return { from: syStart, to: `${now.getFullYear()}-12-31`, label: `Fall Semester ${now.getFullYear()}` };
      }
      return { from: `${now.getFullYear()}-01-01`, to: syEnd, label: `Spring Semester ${now.getFullYear()}` };
    }
    if (preset === 'ytd') {
      return { from: syStart, to: today, label: `School Year ${syStart.slice(0, 4)}–${syEnd.slice(0, 4)} (YTD)` };
    }
    if (preset === 'custom') {
      return { from: customFrom, to: customTo, label: `${customFrom} through ${customTo}` };
    }
    return null;
  };

  const period = resolvePeriod();
  const canGenerate = preset !== 'custom' || (customFrom && customTo && customFrom <= customTo);

  const presetBtn = (id, label) => ({
    padding: '10px 14px',
    borderRadius: 8,
    border: `1.5px solid ${preset === id ? '#2A9D8F' : '#d1d5db'}`,
    background: preset === id ? '#ecfdf5' : '#fff',
    color: preset === id ? '#0f766e' : '#374151',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  });

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>SB 179 Compliance Report</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8, marginBottom: 16 }}>
          Auto-generated from your time entries. Choose a reporting period.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <button type="button" style={presetBtn('month', 'This Month')} onClick={() => setPreset('month')}>This Month</button>
          <button type="button" style={presetBtn('semester', 'Current Semester')} onClick={() => setPreset('semester')}>Current Semester</button>
          <button type="button" style={presetBtn('ytd', 'Year-to-Date')} onClick={() => setPreset('ytd')}>Year-to-Date</button>
          <button type="button" style={presetBtn('custom', 'Custom Range')} onClick={() => setPreset('custom')}>Custom Range</button>
        </div>
        {preset === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {period && canGenerate && (
          <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '8px 12px', borderRadius: 6, marginBottom: 14 }}>
            Will cover <strong style={{ color: '#1a2332' }}>{period.from}</strong> through <strong style={{ color: '#1a2332' }}>{period.to}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1 }}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canGenerate}
            onClick={() => { onGenerate(period); onClose(); }}
            style={{ flex: 1 }}
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Date Range Modal ---- */
function DateRangeModal({ open, onClose, onExport }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Custom Date Range Export</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={() => onClose()} style={{ flex: 1 }}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!from || !to || from > to}
            onClick={() => { onExport(from, to); onClose(); }} style={{ flex: 1 }}>Export PDF</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Compliance Ring (large) ---- */
function ComplianceRing({ percentage, size = 200, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = percentage >= 82 ? '#22c55e' : percentage >= 78 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#1a2332' }}>{percentage}%</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>YTD Counseling</div>
      </div>
    </div>
  );
}

/* ---- Entry Modal ---- */
function EntryModal({ open, onClose, counselorId, editEntry }) {
  const [date, setDate] = useState(editEntry?.entry_date || new Date().toISOString().slice(0, 10));
  const [domain, setDomain] = useState(editEntry?.domain || 'guidance');
  const [activity, setActivity] = useState(editEntry?.activity_description || '');
  const [duration, setDuration] = useState(editEntry?.duration_minutes?.toString() || '');
  const [notes, setNotes] = useState(editEntry?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editEntry) {
      setDate(editEntry.entry_date || new Date().toISOString().slice(0, 10));
      setDomain(editEntry.domain || 'guidance');
      setActivity(editEntry.activity_description || '');
      setDuration(editEntry.duration_minutes?.toString() || '');
      setNotes(editEntry.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setDomain('guidance');
      setActivity('');
      setDuration('');
      setNotes('');
    }
  }, [editEntry, open]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const row = {
      counselor_id: counselorId,
      entry_date: date,
      domain,
      activity_description: activity,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
    };
    let err;
    if (editEntry) {
      ({ error: err } = await db.update('time_entries', editEntry.id, row));
    } else {
      ({ error: err } = await db.insert('time_entries', row));
    }
    if (err) {
      setError(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{editEntry ? 'Edit Entry' : 'New Time Entry'}</h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <input className="form-input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
          </div>
          <label className="form-label">Domain</label>
          <select className="form-input" value={domain} onChange={(e) => setDomain(e.target.value)} style={{ marginBottom: 10 }}>
            {Object.entries(TIME_DOMAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="form-label">Activity</label>
          <input className="form-input" value={activity} onChange={(e) => setActivity(e.target.value)} required placeholder="Brief description" style={{ marginBottom: 10 }} />
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Main ---- */
export default function TimeTrackerPage() {
  const { counselor } = useAuth();
  const [searchParams] = useSearchParams();
  const initialDate = (() => {
    const q = searchParams.get('date');
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
  })();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [dayEntries, setDayEntries] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [ytdPct, setYtdPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [showDateRange, setShowDateRange] = useState(false);
  const [showSB179, setShowSB179] = useState(false);

  const loadAll = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    // Use school year start (Aug 1 default), not calendar year
    const syStart = counselor.school_year_start
      || (new Date().getMonth() >= 7 ? `${new Date().getFullYear()}-08-01` : `${new Date().getFullYear() - 1}-08-01`);
    const yearStart = syStart;
    const ws = format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const we = format(endOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const ms = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const me = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');

    const [dayRes, weekRes, monthRes, ytdRes] = await Promise.all([
      db.select('time_entries', {
        eq: { counselor_id: counselor.id, entry_date: selectedDate },
        order: { column: 'created_at', ascending: true },
      }),
      db.select('time_entries', {
        eq: { counselor_id: counselor.id },
        gte: { entry_date: ws },
        lte: { entry_date: we },
      }),
      db.select('time_entries', {
        eq: { counselor_id: counselor.id },
        gte: { entry_date: ms },
        lte: { entry_date: me },
      }),
      db.select('time_entries', {
        eq: { counselor_id: counselor.id },
        gte: { entry_date: yearStart },
      }),
    ]);

    setDayEntries(dayRes.data || []);

    // Aggregate weekly
    const wMap = {};
    (weekRes.data || []).forEach((e) => { wMap[e.domain] = (wMap[e.domain] || 0) + e.duration_minutes; });
    setWeeklyData(Object.entries(TIME_DOMAINS).map(([k, v]) => ({
      domain: v.replace('Individual ', 'Ind. ').replace(' Duties', ''),
      hours: Math.round(((wMap[k] || 0) / 60) * 10) / 10,
      fill: COUNSELING_DOMAINS.includes(k) ? '#2A9D8F' : '#94a3b8',
    })));

    // Aggregate monthly
    const mMap = {};
    (monthRes.data || []).forEach((e) => { mMap[e.domain] = (mMap[e.domain] || 0) + e.duration_minutes; });
    setMonthlyData(Object.entries(TIME_DOMAINS).map(([k, v]) => ({
      domain: v, minutes: mMap[k] || 0, hours: Math.round(((mMap[k] || 0) / 60) * 10) / 10,
    })));

    // YTD compliance
    const yMap = {};
    (ytdRes.data || []).forEach((e) => { yMap[e.domain] = (yMap[e.domain] || 0) + e.duration_minutes; });
    const totalMin = Object.values(yMap).reduce((a, b) => a + b, 0) || 1;
    const counselingMin = COUNSELING_DOMAINS.reduce((s, d) => s + (yMap[d] || 0), 0);
    setYtdPct(Math.round((counselingMin / totalMin) * 100));

    setLoading(false);
  }, [counselor, selectedDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const deleteEntry = async (entryId) => {
    if (!confirm('Delete this time entry?')) return;
    await db.del('time_entries', entryId);
    loadAll();
  };

  const handleExportMonthlyPDF = async () => {
    const ms = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const me = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const entries = await fetchEntriesRange(counselor.id, ms, me);
    const monthLabel = new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    generateRangePDF(entries, counselor.name || counselor.full_name || 'Counselor', monthLabel, `time-report-${ms.slice(0, 7)}.pdf`);
  };

  const handleExportAnnualPDF = async () => {
    const start = counselor.school_year_start || `${new Date().getFullYear()}-08-01`;
    const end = counselor.school_year_end || `${new Date().getFullYear() + 1}-07-31`;
    const entries = await fetchEntriesRange(counselor.id, start, end);
    const yearLabel = `School Year ${start.slice(0, 4)}\u2013${end.slice(0, 4)}`;
    generateAnnualPDF(entries, counselor.name || counselor.full_name || 'Counselor', yearLabel, `time-report-annual-${start.slice(0, 4)}.pdf`);
  };

  const handleExportCSV = async () => {
    const ms = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const me = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const entries = await fetchEntriesRange(counselor.id, ms, me);
    const header = 'Date,Domain,Activity,Duration (min),Notes';
    const rows = entries.map((e) => {
      const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      return [e.entry_date, TIME_DOMAINS[e.domain] || e.domain, escape(e.activity_description), e.duration_minutes, escape(e.notes || '')].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beacon-time-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCustomRangeExport = async (from, to) => {
    const entries = await fetchEntriesRange(counselor.id, from, to);
    const rangeLabel = `${from} to ${to}`;
    generateRangePDF(entries, counselor.name || counselor.full_name || 'Counselor', rangeLabel, `time-report-${from}-to-${to}.pdf`);
  };

  const handleSB179Generate = async (period) => {
    const entries = await fetchEntriesRange(counselor.id, period.from, period.to);
    generateSB179PDF(entries, counselor, period.label, period.from, period.to, `SB179-Compliance-${period.from}-to-${period.to}.pdf`);
  };

  const dayTotal = dayEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Time Tracker</h1>
        <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowModal(true); }}>+ New Entry</button>
      </div>

      {/* Alert banner */}
      {ytdPct < 82 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>!</span>
          <span style={{ color: '#b91c1c', fontSize: 14 }}>
            Your YTD counseling percentage is <strong>{ytdPct}%</strong>, below the 80/20 compliance threshold of 82%.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div>
          {/* Day entries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <input className="form-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 180 }} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total: {dayTotal} min ({Math.round(dayTotal / 60 * 10) / 10} hrs)</span>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : dayEntries.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--text-muted)' }}>No entries for this date.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {dayEntries.map((e) => (
                <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1a2332', marginBottom: 2 }}>{e.activity_description}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {TIME_DOMAINS[e.domain] || e.domain} &middot; {e.duration_minutes} min
                    </div>
                    {e.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{e.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditEntry(e); setShowModal(true); }} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weekly summary chart */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginTop: 28, marginBottom: 12 }}>Weekly Summary</h2>
          <div className="card">
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={weeklyData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => `${v} hrs`} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={16}>
                    {weeklyData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly rollup */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginTop: 28, marginBottom: 12 }}>Monthly Totals</h2>
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>Domain</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((d) => (
                  <tr key={d.domain} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{d.domain}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{d.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => setShowSB179(true)}>SB 179 Compliance Report</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={handleExportMonthlyPDF}>Export Monthly PDF</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={handleExportAnnualPDF}>Export Annual PDF</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={handleExportCSV}>Export CSV</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => setShowDateRange(true)}>Custom Date Range</button>
          </div>
        </div>

        {/* Right: Compliance ring */}
        <div className="card" style={{ textAlign: 'center', position: 'sticky', top: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            80/20 Compliance
          </h3>
          <ComplianceRing percentage={ytdPct} />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
            {ytdPct >= 82 ? 'You are in compliance.' : 'Below threshold. Increase counseling activities.'}
          </p>
        </div>
      </div>

      <EntryModal
        open={showModal}
        onClose={(saved) => { setShowModal(false); setEditEntry(null); if (saved) loadAll(); }}
        counselorId={counselor?.id}
        editEntry={editEntry}
      />

      <DateRangeModal
        open={showDateRange}
        onClose={() => setShowDateRange(false)}
        onExport={handleCustomRangeExport}
      />

      <SB179Modal
        open={showSB179}
        onClose={() => setShowSB179(false)}
        onGenerate={handleSB179Generate}
        counselor={counselor}
      />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px' };
