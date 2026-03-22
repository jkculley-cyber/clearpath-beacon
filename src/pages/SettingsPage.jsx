import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { db, exportLocalBackup, importLocalBackup } from '../lib/db';
import { hasSampleData, clearSampleData } from '../lib/seedSampleData';
import { parseIcs } from '../lib/calendarImport';
import { TIME_DOMAINS } from '../lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const GRADE_PROMOTIONS = [
  { from: 'K', to: '1' },
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '4' },
  { from: '4', to: '5' },
  { from: '5', to: 'Graduated' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function SettingsPage() {
  const { counselor, refreshCounselor, isLocalMode, switchStorageMode, licenseState, saveLicenseKey, getLicenseKey } = useAuth();
  const [licKey, setLicKey] = useState('');
  const [licMsg, setLicMsg] = useState('');
  const [licSaving, setLicSaving] = useState(false);
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(82);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyReferral, setNotifyReferral] = useState(true);

  // Schedule blocks
  const [blocks, setBlocks] = useState([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [blockName, setBlockName] = useState('');
  const [blockDay, setBlockDay] = useState('Monday');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // School Year Transition
  const [showTransition, setShowTransition] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState(null);
  const [archiveGroups, setArchiveGroups] = useState(true);
  const [resetSessions, setResetSessions] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionResult, setTransitionResult] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Calendar Import
  const [calEvents, setCalEvents] = useState([]);
  const [calImporting, setCalImporting] = useState(false);
  const [calMsg, setCalMsg] = useState('');

  // Share Beacon
  const [compliancePct, setCompliancePct] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Share with Principal — impact summary stats
  const [impactStats, setImpactStats] = useState(null);
  const [impactCopied, setImpactCopied] = useState(false);
  const [impactGenerating, setImpactGenerating] = useState(false);

  // Billing / Receipt
  const [receiptType, setReceiptType] = useState('annual'); // 'annual' | 'monthly'
  const [receiptGenerating, setReceiptGenerating] = useState(false);

  useEffect(() => {
    if (counselor) {
      setName(counselor.name || '');
      setCampus(counselor.campus || '');
      setDistrict(counselor.district || '');
      setYearStart(counselor.school_year_start || '');
      setYearEnd(counselor.school_year_end || '');
      setAlertThreshold(counselor.alert_threshold || 82);
      setNotifyEmail(counselor.notify_email !== false);
      setNotifyReferral(counselor.notify_referral !== false);
    }
  }, [counselor]);

  const loadBlocks = useCallback(async () => {
    if (!counselor?.id) return;
    const { data } = await db.select('campus_schedule_blocks', {
      eq: { counselor_id: counselor.id },
      order: { column: 'day_of_week', ascending: true },
    });
    // Secondary sort by start_time (db.select only supports one order)
    const sorted = (data || []).sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week < b.day_of_week ? -1 : 1;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    setBlocks(sorted);
  }, [counselor]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // Load compliance % for share message
  useEffect(() => {
    if (!counselor?.id) return;
    (async () => {
      const { data: entries } = await db.select('time_entries', { eq: { counselor_id: counselor.id } });
      if (!entries || entries.length === 0) return;
      const direct = entries.filter(e => e.category === 'direct' || e.service_type === 'direct').reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const total = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      if (total > 0) setCompliancePct(Math.round((direct / total) * 100));
    })();
  }, [counselor]);

  const shareMessage = useMemo(() => {
    let msg = "I've been using Beacon to track my caseload and 80/20 compliance \u2014 it's been a game changer.";
    if (compliancePct != null) {
      msg += ` I'm at ${compliancePct}% compliance this year thanks to Beacon.`;
    }
    msg += ' Free 14-day trial, no setup needed: beacon.clearpathedgroup.com';
    return msg;
  }, [compliancePct]);

  const [editableShareMsg, setEditableShareMsg] = useState('');
  useEffect(() => { setEditableShareMsg(shareMessage); }, [shareMessage]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(editableShareMsg);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Check out Beacon');
    const body = encodeURIComponent(editableShareMsg);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // Load impact stats for "Share with Principal"
  useEffect(() => {
    if (!counselor?.id) return;
    (async () => {
      const [studentsRes, sessionsRes, groupsRes, entriesRes, referralsRes] = await Promise.all([
        db.select('students', { eq: { counselor_id: counselor.id, status: 'active' } }),
        db.select('sessions', { eq: { counselor_id: counselor.id } }),
        db.select('groups', { eq: { counselor_id: counselor.id, status: 'active' } }),
        db.select('time_entries', { eq: { counselor_id: counselor.id } }),
        db.select('referrals', { eq: { counselor_id: counselor.id } }),
      ]);
      const students = studentsRes.data || [];
      const sessions = sessionsRes.data || [];
      const groups = groupsRes.data || [];
      const entries = entriesRes.data || [];
      const referrals = referralsRes.data || [];

      const tier1 = students.filter(s => (s.tier || 1) === 1).length;
      const tier2 = students.filter(s => s.tier === 2).length;
      const tier3 = students.filter(s => s.tier === 3).length;

      const direct = entries.filter(e => e.category === 'direct' || e.service_type === 'direct').reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const total = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const sb179 = total > 0 ? Math.round((direct / total) * 100) : 0;

      setImpactStats({ studentsServed: students.length, sessionsLogged: sessions.length, groupsActive: groups.length, sb179, referrals: referrals.length, tier1, tier2, tier3 });
    })();
  }, [counselor]);

  const getSchoolYearLabel = () => {
    if (yearStart && yearEnd) {
      const sy = yearStart.slice(0, 4);
      const ey = yearEnd.slice(0, 4);
      return `${sy}-${ey}`;
    }
    const now = new Date();
    const yr = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${yr}-${yr + 1}`;
  };

  const buildImpactText = () => {
    if (!impactStats) return '';
    const cName = name || 'Counselor';
    const cCampus = campus || 'School';
    return `Counselor Impact Summary — ${cName}, ${cCampus}\nSchool Year ${getSchoolYearLabel()}\n\nStudents Served: ${impactStats.studentsServed}\nSessions Logged: ${impactStats.sessionsLogged}\nGroups: ${impactStats.groupsActive} active\nSB 179 Compliance: ${impactStats.sb179}%\nReferrals Processed: ${impactStats.referrals}\n\nCaseload: Tier 1 (${impactStats.tier1}) | Tier 2 (${impactStats.tier2}) | Tier 3 (${impactStats.tier3})\n\nGenerated by Beacon · beacon.clearpathedgroup.com`;
  };

  const handleCopyImpact = async () => {
    try {
      await navigator.clipboard.writeText(buildImpactText());
      setImpactCopied(true);
      setTimeout(() => setImpactCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleGenerateImpactPdf = () => {
    if (!impactStats) return;
    setImpactGenerating(true);
    try {
      const doc = new jsPDF();
      const TEAL = [42, 157, 143];
      const cName = name || 'Counselor';
      const cCampus = campus || 'School';

      // Header bar
      doc.setFillColor(...TEAL);
      doc.rect(0, 0, 210, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Beacon', 14, 18);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Counselor Impact Summary', 14, 28);

      // Counselor info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(cName, 14, 50);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${cCampus}${district ? ' — ' + district : ''}`, 14, 58);
      doc.text(`School Year ${getSchoolYearLabel()}`, 14, 65);

      // Metrics table
      autoTable(doc, {
        startY: 75,
        head: [['Metric', 'Value']],
        body: [
          ['Students Served', String(impactStats.studentsServed)],
          ['Sessions Logged', String(impactStats.sessionsLogged)],
          ['Active Groups', String(impactStats.groupsActive)],
          ['SB 179 Compliance', `${impactStats.sb179}%`],
          ['Referrals Processed', String(impactStats.referrals)],
        ],
        theme: 'grid',
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
        bodyStyles: { fontSize: 11 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: 14, right: 14 },
      });

      // Caseload breakdown
      const afterTable = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Caseload Breakdown', 14, afterTable);

      autoTable(doc, {
        startY: afterTable + 4,
        head: [['Tier', 'Students']],
        body: [
          ['Tier 1 (Universal)', String(impactStats.tier1)],
          ['Tier 2 (Targeted)', String(impactStats.tier2)],
          ['Tier 3 (Intensive)', String(impactStats.tier3)],
        ],
        theme: 'grid',
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
        bodyStyles: { fontSize: 11 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by Beacon — Counselor Command Center. Learn more at beacon.clearpathedgroup.com', 14, pageHeight - 14);

      doc.save(`Beacon_Impact_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setImpactGenerating(false);
    }
  };

  const handleGenerateReceipt = () => {
    setReceiptGenerating(true);
    try {
      const doc = new jsPDF();
      const TEAL = [42, 157, 143];
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const invoiceNum = `BCN-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const isAnnual = receiptType === 'annual';
      const amount = isAnnual ? '$79.00' : '$8.00';
      const lineItem = isAnnual
        ? 'Beacon Counselor Command Center — Annual License'
        : 'Beacon Counselor Command Center — Monthly License';

      // Header bar
      doc.setFillColor(...TEAL);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEIPT', 14, 22);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Clear Path Education Group, LLC', 14, 32);

      // License dates
      const purchaseDate = today;
      const endDate = new Date(today);
      if (isAnnual) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      const purchaseDateStr = purchaseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const endDateStr = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      // Invoice details
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice #:', 14, 56);
      doc.text('Purchase Date:', 14, 64);
      doc.text('License Expires:', 14, 72);
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceNum, 65, 56);
      doc.text(purchaseDateStr, 65, 64);
      doc.text(endDateStr, 65, 72);

      // Bill To
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', 14, 88);
      doc.setFont('helvetica', 'normal');
      const cName = name || 'Counselor';
      const cCampus = campus || '';
      const cDistrict = district || '';
      let billToY = 96;
      doc.text(cName, 14, billToY);
      if (cCampus) { billToY += 7; doc.text(cCampus, 14, billToY); }
      if (cDistrict) { billToY += 7; doc.text(cDistrict, 14, billToY); }

      // Line items table
      autoTable(doc, {
        startY: billToY + 16,
        head: [['Description', 'Amount']],
        body: [
          [lineItem, amount],
          ['Tax', '$0.00'],
        ],
        theme: 'grid',
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
        bodyStyles: { fontSize: 11 },
        columnStyles: { 0: { cellWidth: 140 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });

      // Total
      const afterLineItems = doc.lastAutoTable.finalY;
      doc.setFillColor(245, 245, 245);
      doc.rect(14, afterLineItems, 182, 12, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Total:', 18, afterLineItems + 9);
      doc.text(amount, 192, afterLineItems + 9, { align: 'right' });

      // Payment & Category
      let detailY = afterLineItems + 28;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Method:', 14, detailY);
      doc.setFont('helvetica', 'normal');
      doc.text('Zelle', 65, detailY);
      detailY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Category:', 14, detailY);
      doc.setFont('helvetica', 'normal');
      doc.text('Professional Development Software', 65, detailY);

      // Note
      detailY += 20;
      doc.setFillColor(240, 253, 250);
      doc.roundedRect(14, detailY - 5, 182, 22, 3, 3, 'F');
      doc.setFontSize(10);
      doc.setTextColor(15, 118, 110);
      doc.text('This receipt may be submitted for professional development reimbursement', 18, detailY + 3);
      doc.text('under campus supply or PD budgets.', 18, detailY + 11);

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.5);
      doc.line(14, pageHeight - 24, 196, pageHeight - 24);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('Clear Path Education Group, LLC · clearpathedgroup.com', 105, pageHeight - 16, { align: 'center' });

      doc.save(`Beacon_Receipt_${today.toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Receipt PDF error:', e);
      alert('Receipt generation failed: ' + (e.message || 'Unknown error'));
    } finally {
      setReceiptGenerating(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    const { error } = await db.update('counselors', counselor.id, {
      name,
      campus,
      district,
      school_year_start: yearStart || null,
      school_year_end: yearEnd || null,
      alert_threshold: alertThreshold,
      notify_email: notifyEmail,
      notify_referral: notifyReferral,
    });

    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Settings saved.');
      if (refreshCounselor) refreshCounselor();
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleSaveBlock = async () => {
    if (!blockName || !blockStart || !blockEnd) return;
    const row = {
      counselor_id: counselor.id,
      block_name: blockName,
      day_of_week: blockDay,
      start_time: blockStart,
      end_time: blockEnd,
    };
    if (editBlock) {
      await db.update('campus_schedule_blocks', editBlock.id, row);
    } else {
      await db.insert('campus_schedule_blocks', row);
    }
    setShowBlockForm(false);
    setEditBlock(null);
    setBlockName('');
    setBlockStart('');
    setBlockEnd('');
    loadBlocks();
  };

  const handleEditBlock = (b) => {
    setEditBlock(b);
    setBlockName(b.block_name);
    setBlockDay(b.day_of_week);
    setBlockStart(b.start_time);
    setBlockEnd(b.end_time);
    setShowBlockForm(true);
  };

  const handleDeleteBlock = async (id) => {
    if (!confirm('Delete this schedule block?')) return;
    await db.del('campus_schedule_blocks', id);
    loadBlocks();
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }

    // Verify current password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: counselor.email || '',
      password: currentPw,
    });
    if (signInErr) { setPwError('Current password is incorrect.'); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); return; }

    setPwSuccess('Password updated successfully.');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  const handleStartTransition = async () => {
    if (!counselor?.id) return;
    const { data: allStudents } = await db.select('students', {
      eq: { counselor_id: counselor.id, status: 'active' },
    });
    const students = allStudents || [];
    const promoteCounts = {};
    let graduateCount = 0;
    for (const s of students) {
      const grade = (s.grade || '').toString().trim();
      const promo = GRADE_PROMOTIONS.find((p) => p.from === grade);
      if (promo) {
        if (promo.to === 'Graduated') {
          graduateCount++;
        } else {
          promoteCounts[`${promo.from} -> ${promo.to}`] = (promoteCounts[`${promo.from} -> ${promo.to}`] || 0) + 1;
        }
      }
    }
    setTransitionPreview({
      totalStudents: students.length,
      promoteCounts,
      graduateCount,
      students,
    });
    setArchiveGroups(true);
    setResetSessions(true);
    setTransitionResult(null);
    setShowTransition(true);
  };

  const handleConfirmTransition = async () => {
    if (!transitionPreview || !counselor?.id) return;
    setTransitioning(true);
    let promoted = 0;
    let graduated = 0;
    let archived = 0;

    // Promote / graduate each student
    for (const s of transitionPreview.students) {
      const grade = (s.grade || '').toString().trim();
      const promo = GRADE_PROMOTIONS.find((p) => p.from === grade);
      if (!promo) continue;
      if (promo.to === 'Graduated') {
        await db.update('students', s.id, { status: 'graduated' });
        graduated++;
      } else {
        await db.update('students', s.id, { grade: promo.to });
        promoted++;
      }
    }

    // Archive completed groups if checked
    if (archiveGroups) {
      const { data: groups } = await db.select('groups', {
        eq: { counselor_id: counselor.id, status: 'completed' },
      });
      for (const g of (groups || [])) {
        await db.update('groups', g.id, { status: 'archived' });
        archived++;
      }
    }

    setTransitioning(false);
    setTransitionResult({ promoted, graduated, archived });
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div style={{ maxWidth: 640 }}>
        {/* Profile */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" value={counselor?.email || ''} disabled style={{ background: '#f3f4f6' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <label className="form-label">Campus</label>
              <input className="form-input" value={campus} onChange={(e) => setCampus(e.target.value)} />
            </div>
            <div>
              <label className="form-label">District</label>
              <input className="form-input" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
          </div>
        </div>

        {/* School Year */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>School Year Dates</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Used for YTD compliance calculations.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Schedule Blocks */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Schedule Blocks</h2>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => { setEditBlock(null); setBlockName(''); setBlockDay('Monday'); setBlockStart(''); setBlockEnd(''); setShowBlockForm(true); }}>
              + Add Block
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Mark times unavailable for counseling (lunch, specials, testing, etc.)
          </p>

          {blocks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No blocks configured.</p>
          ) : (
            <div>
              {blocks.map((b) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1a2332', fontSize: 14 }}>{b.block_name}</span>
                    <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280' }}>
                      {b.day_of_week} {b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleEditBlock(b)} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDeleteBlock(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showBlockForm && (
            <div style={{ marginTop: 12, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a2332', margin: '0 0 10px' }}>
                {editBlock ? 'Edit Block' : 'New Block'}
              </h4>
              <label className="form-label">Block Name</label>
              <input className="form-input" value={blockName} onChange={(e) => setBlockName(e.target.value)} placeholder="e.g. Lunch" style={{ marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
                <div>
                  <label className="form-label">Day</label>
                  <select className="form-input" value={blockDay} onChange={(e) => setBlockDay(e.target.value)}>
                    {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Start</label>
                  <input className="form-input" type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">End</label>
                  <input className="form-input" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => { setShowBlockForm(false); setEditBlock(null); }} style={{ fontSize: 13 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveBlock} style={{ fontSize: 13 }}>
                  {editBlock ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 80/20 Threshold */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Compliance Alert Threshold</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Show a warning when YTD counseling percentage drops below this value.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input className="form-input" type="number" min="50" max="100" value={alertThreshold} onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))} style={{ width: 100 }} />
            <span style={{ fontSize: 14, color: '#6b7280' }}>% (default: 82%)</span>
          </div>
        </div>

        {/* Notifications */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Notifications</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Email notifications for compliance alerts
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyReferral} onChange={(e) => setNotifyReferral(e.target.checked)} />
            Email notifications for new referrals
          </label>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ padding: '10px 32px' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saveMsg && <span style={{ fontSize: 14, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>}
        </div>

        {/* Calendar Import */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Calendar Import</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Export your Google Calendar as ICS (Calendar Settings &rarr; Export) and upload here. Events are automatically categorized for 80/20 tracking.
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, background: '#f9fafb', padding: '10px 14px', borderRadius: 8, lineHeight: 1.5 }}>
            <strong>Tip:</strong> Name your calendar events clearly &mdash; &ldquo;Marcus individual session&rdquo; auto-categorizes as counseling. &ldquo;Lunch duty&rdquo; auto-categorizes as non-counseling.
          </p>
          <div style={{ marginBottom: 14 }}>
            <input
              type="file"
              accept=".ics"
              style={{ fontSize: 13 }}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setCalMsg('');
                try {
                  const text = await file.text();
                  const parsed = parseIcs(text);
                  if (parsed.length === 0) {
                    setCalMsg('No importable events found (weekend/all-day events are skipped).');
                    setCalEvents([]);
                    return;
                  }
                  setCalEvents(parsed.map((ev, i) => ({ ...ev, _idx: i, _include: true })));
                } catch (err) {
                  setCalMsg('Error parsing ICS file: ' + err.message);
                  setCalEvents([]);
                }
              }}
            />
          </div>

          {calMsg && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: calMsg.includes('Error') || calMsg.includes('No ') ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${calMsg.includes('Error') || calMsg.includes('No ') ? '#fecaca' : '#bbf7d0'}`,
              color: calMsg.includes('Error') || calMsg.includes('No ') ? '#dc2626' : '#15803d',
            }}>
              {calMsg}
            </div>
          )}

          {calEvents.length > 0 && (
            <>
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <th style={calTh}></th>
                      <th style={calTh}>Date</th>
                      <th style={calTh}>Time</th>
                      <th style={calTh}>Event</th>
                      <th style={calTh}>Category</th>
                      <th style={calTh}>Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calEvents.map((ev) => (
                      <tr key={ev._idx} style={{ borderBottom: '1px solid #f3f4f6', opacity: ev._include ? 1 : 0.5 }}>
                        <td style={calTd}>
                          <input
                            type="checkbox"
                            checked={ev._include}
                            onChange={() => {
                              setCalEvents(prev => prev.map(e => e._idx === ev._idx ? { ...e, _include: !e._include } : e));
                            }}
                          />
                        </td>
                        <td style={calTd}>{ev.entry_date}</td>
                        <td style={{ ...calTd, whiteSpace: 'nowrap' }}>{ev.start_time}-{ev.end_time}</td>
                        <td style={{ ...calTd, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.activity_description}>
                          {ev.activity_description}
                        </td>
                        <td style={calTd}>
                          <select
                            value={ev.domain}
                            onChange={(e) => {
                              setCalEvents(prev => prev.map(x => x._idx === ev._idx ? { ...x, domain: e.target.value } : x));
                            }}
                            style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff' }}
                          >
                            {Object.entries(TIME_DOMAINS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ ...calTd, textAlign: 'right' }}>{ev.duration_minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '8px 20px' }}
                disabled={calImporting || calEvents.filter(e => e._include).length === 0}
                onClick={async () => {
                  if (!counselor?.id) return;
                  setCalImporting(true);
                  setCalMsg('');
                  const toImport = calEvents.filter(e => e._include);
                  let imported = 0;
                  let skipped = 0;

                  for (const ev of toImport) {
                    // Deduplicate by date + description match
                    const { data: existing } = await db.select('time_entries', {
                      eq: { counselor_id: counselor.id, entry_date: ev.entry_date, activity_description: ev.activity_description },
                    });
                    if (existing && existing.length > 0) {
                      skipped++;
                      continue;
                    }
                    await db.insert('time_entries', {
                      counselor_id: counselor.id,
                      entry_date: ev.entry_date,
                      domain: ev.domain,
                      activity_description: ev.activity_description,
                      duration_minutes: ev.duration_minutes,
                      source: 'calendar',
                    });
                    imported++;
                  }

                  setCalImporting(false);
                  setCalEvents([]);
                  setCalMsg(`Imported ${imported} time entr${imported === 1 ? 'y' : 'ies'}${skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`);
                }}
              >
                {calImporting ? 'Importing...' : `Import ${calEvents.filter(e => e._include).length} time entr${calEvents.filter(e => e._include).length === 1 ? 'y' : 'ies'}`}
              </button>
            </>
          )}
        </div>

        {/* Change Password — cloud mode only (local mode has no auth) */}
        {!isLocalMode && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Change Password</h2>
          {pwError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 10 }}>{pwSuccess}</div>}
          <label className="form-label">Current Password</label>
          <input className="form-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} style={{ marginBottom: 8, maxWidth: 320 }} />
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ marginBottom: 8, maxWidth: 320 }} />
          <label className="form-label">Confirm New Password</label>
          <input className="form-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={{ marginBottom: 14, maxWidth: 320 }} />
          <button className="btn btn-outline" onClick={handleChangePassword} disabled={!currentPw || !newPw}>
            Update Password
          </button>
        </div>
        )}

        {/* License */}
        {isLocalMode && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={sectionTitle}>License</h2>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              padding: '10px 14px', borderRadius: 8,
              background: licenseState.valid ? '#f0fdfa' : '#fef2f2',
              border: `1px solid ${licenseState.valid ? '#99f6e4' : '#fecaca'}`,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: licenseState.valid ? '#22c55e' : '#ef4444',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: licenseState.valid ? '#0f766e' : '#dc2626' }}>
                {licenseState.valid ? 'License Active' :
                  licenseState.reason === 'no_license' ? 'No License Key' :
                  licenseState.reason === 'invalid_key' ? 'Invalid License Key' :
                  licenseState.reason === 'expired' ? 'License Expired' :
                  'License Verification Failed'}
              </span>
            </div>
            {getLicenseKey() && (
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Current key: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{getLicenseKey()}</code>
              </p>
            )}
            {!licenseState.valid && !getLicenseKey() && (
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Enter a license key to unlock full access after your trial ends.
              </p>
            )}
            {!licenseState.valid && getLicenseKey() && (
              <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>
                Your license is inactive. You can view existing data but cannot create new records until you enter a valid license key.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">License Key</label>
                <input
                  className="form-input"
                  value={licKey}
                  onChange={(e) => setLicKey(e.target.value.toUpperCase())}
                  placeholder="BCN-XXXX-XXXX"
                  style={{ maxWidth: 280 }}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                disabled={licSaving || !licKey.trim()}
                onClick={async () => {
                  setLicSaving(true);
                  setLicMsg('');
                  const result = await saveLicenseKey(licKey.trim());
                  if (result.valid) {
                    setLicMsg('✓ License activated! You have full access to Beacon.');
                    setLicKey('');
                  } else {
                    setLicMsg(result.reason === 'invalid_key' ? 'Invalid license key. Please check and try again.' : result.reason === 'expired' ? 'This license has expired. Contact support@clearpathedgroup.com.' : 'Could not verify — check your internet connection and try again.');
                  }
                  setLicSaving(false);
                }}
              >
                {licSaving ? 'Verifying...' : 'Activate'}
              </button>
            </div>
            {licMsg && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: licMsg.includes('activated') ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${licMsg.includes('activated') ? '#bbf7d0' : '#fecaca'}`,
                color: licMsg.includes('activated') ? '#15803d' : '#dc2626',
              }}>
                {licMsg}
              </div>
            )}
          </div>
        )}

        {/* School Year Transition */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>School Year Transition</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Archive this year's data and promote students to the next grade. Your history is preserved.
          </p>
          <button
            className="btn btn-primary"
            style={{ background: '#2A9D8F', borderColor: '#2A9D8F', fontWeight: 600, fontSize: 14, padding: '10px 24px' }}
            onClick={handleStartTransition}
          >
            Start New School Year
          </button>
        </div>

        {/* Transition Confirmation Modal */}
        {showTransition && transitionPreview && (
          <div style={transitionOverlay} onClick={() => { if (!transitioning) { setShowTransition(false); setTransitionResult(null); } }}>
            <div style={transitionModal} onClick={(e) => e.stopPropagation()}>
              {transitionResult ? (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>Transition Complete</h3>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>{transitionResult.promoted} student{transitionResult.promoted !== 1 ? 's' : ''} promoted.</p>
                    <p style={{ color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>{transitionResult.graduated} 5th grader{transitionResult.graduated !== 1 ? 's' : ''} graduated.</p>
                    {transitionResult.archived > 0 && (
                      <p style={{ color: '#6b7280', fontSize: 13 }}>{transitionResult.archived} completed group{transitionResult.archived !== 1 ? 's' : ''} archived.</p>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={() => { setShowTransition(false); setTransitionResult(null); }} style={{ width: '100%' }}>Done</button>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Promote & Archive</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                    {transitionPreview.totalStudents - transitionPreview.graduateCount} student{transitionPreview.totalStudents - transitionPreview.graduateCount !== 1 ? 's' : ''} will be promoted, {transitionPreview.graduateCount} 5th grader{transitionPreview.graduateCount !== 1 ? 's' : ''} will be graduated.
                  </p>

                  {/* Grade promotion preview */}
                  <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Grade Promotions</p>
                    {GRADE_PROMOTIONS.map((p) => (
                      <div key={p.from} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                        <span style={{ color: '#374151' }}>{p.from === '5' ? 'Grade 5' : p.from === 'K' ? 'Kindergarten' : `Grade ${p.from}`}</span>
                        <span style={{ color: '#6b7280' }}>&rarr;</span>
                        <span style={{ fontWeight: 600, color: p.to === 'Graduated' ? '#f59e0b' : '#2A9D8F' }}>{p.to === 'Graduated' ? 'Graduated' : `Grade ${p.to}`}</span>
                      </div>
                    ))}
                  </div>

                  {/* Options */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
                    <input type="checkbox" checked={archiveGroups} onChange={(e) => setArchiveGroups(e.target.checked)} />
                    Archive completed groups
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
                    <input type="checkbox" checked={resetSessions} onChange={(e) => setResetSessions(e.target.checked)} />
                    Reset session counts (sessions have dates, so historical data is preserved)
                  </label>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" onClick={() => setShowTransition(false)} disabled={transitioning} style={{ flex: 1 }}>Cancel</button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, background: '#2A9D8F', borderColor: '#2A9D8F' }}
                      disabled={transitioning}
                      onClick={handleConfirmTransition}
                    >
                      {transitioning ? 'Promoting...' : 'Promote & Archive'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Data Storage */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Data Storage</h2>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '10px 14px', borderRadius: 8,
            background: isLocalMode ? '#f0fdfa' : '#eff6ff',
            border: `1px solid ${isLocalMode ? '#99f6e4' : '#bfdbfe'}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isLocalMode ? '#2A9D8F' : '#3b82f6',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: isLocalMode ? '#0f766e' : '#1d4ed8' }}>
              {isLocalMode ? 'Local Mode — data stays on this device' : 'Cloud Mode — synced to Supabase'}
            </span>
          </div>

          {isLocalMode && (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
                All your data is stored in this browser's IndexedDB. Export a backup regularly to avoid data loss if you clear browser data.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={async () => {
                  const data = await exportLocalBackup();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `beacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  localStorage.setItem('beacon_last_backup', new Date().toISOString());
                }}>
                  Export Backup (JSON)
                </button>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const text = await file.text();
                    if (confirm('This will replace ALL local data. Continue?')) {
                      await importLocalBackup(text);
                      window.location.reload();
                    }
                  };
                  input.click();
                }}>
                  Restore from Backup
                </button>
              </div>
              {hasSampleData() && (
                <div style={{ marginBottom: 12, padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Sample Data Loaded</div>
                  <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8, lineHeight: 1.5 }}>
                    You have demo data from setup. Clear it to start fresh with your own students and sessions.
                  </p>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, color: '#92400e', borderColor: '#f59e0b' }}
                    onClick={async () => {
                      if (!confirm('Clear all sample students, groups, sessions, time entries, and referrals? Your profile, lessons, and templates will be kept.')) return;
                      await clearSampleData(counselor.id);
                      window.location.reload();
                    }}
                  >
                    Clear Sample Data & Start Fresh
                  </button>
                </div>
              )}

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                  Have a district data agreement? Switch to cloud mode for cross-device sync and AI features.
                </p>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => {
                    if (confirm('Switch to cloud mode? You will need to sign in with a district account. Your local data will remain available if you switch back.')) {
                      switchStorageMode('cloud');
                    }
                  }}
                >
                  Switch to Cloud Mode
                </button>
              </div>
            </>
          )}

          {!isLocalMode && (
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Your data is synced to the cloud via Supabase. It is accessible from any device where you sign in.
            </p>
          )}
        </div>

        {/* Share with Your Principal */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Share with Your Principal</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Generate a one-page impact summary to share with your principal or campus admin. No student names or PII — just aggregate numbers.
          </p>
          {impactStats && (
            <div style={{ marginBottom: 14, padding: 14, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2A9D8F' }}>{impactStats.studentsServed}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Students Served</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2A9D8F' }}>{impactStats.sessionsLogged}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Sessions Logged</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2A9D8F' }}>{impactStats.sb179}%</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>SB 179 Compliance</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{impactStats.groupsActive}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Active Groups</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{impactStats.referrals}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Referrals</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>T1:{impactStats.tier1} T2:{impactStats.tier2} T3:{impactStats.tier3}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Caseload</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 13, background: '#2A9D8F', borderColor: '#2A9D8F' }}
              disabled={impactGenerating || !impactStats}
              onClick={handleGenerateImpactPdf}
            >
              {impactGenerating ? 'Generating...' : 'Generate Summary PDF'}
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: 13 }}
              disabled={!impactStats}
              onClick={handleCopyImpact}
            >
              {impactCopied ? 'Copied!' : 'Copy Summary Text'}
            </button>
          </div>
        </div>

        {/* Billing — Receipt + Campus/District Interest */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Billing</h2>

          {/* Receipt — only for verified license holders */}
          {licenseState.valid && getLicenseKey() ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                If your campus allows reimbursement for professional tools, you can generate a receipt below.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">License Type</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="receiptType" value="annual" checked={receiptType === 'annual'} onChange={() => setReceiptType('annual')} />
                    Annual — $79.00
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="receiptType" value="monthly" checked={receiptType === 'monthly'} onChange={() => setReceiptType('monthly')} />
                    Monthly — $8.00
                  </label>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, background: '#2A9D8F', borderColor: '#2A9D8F' }}
                disabled={receiptGenerating}
                onClick={handleGenerateReceipt}
              >
                {receiptGenerating ? 'Generating...' : 'Generate Receipt'}
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Receipts are available after you purchase a license. Enter your license key above to activate, or subscribe at{' '}
              <a href="https://clearpathedgroup.com/store.html#beacon" target="_blank" rel="noopener" style={{ color: '#2A9D8F', fontWeight: 600 }}>clearpathedgroup.com</a>.
            </p>
          )}

          {/* Campus/District license interest */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Ready to use Beacon across your campus or district?
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              We offer campus and district licenses with volume pricing, cloud sync, and admin dashboards. Let us know you're interested and we'll set up a conversation.
            </p>
            <a
              href={`mailto:support@clearpathedgroup.com?subject=${encodeURIComponent('Interest in Beacon Campus/District License')}&body=${encodeURIComponent(`Hi Clear Path team,\n\nI've been using Beacon as an individual counselor and I'm interested in learning about campus or district licensing options.\n\nName: ${name || ''}\nSchool: ${campus || ''}\nDistrict: ${district || ''}\n\nI'd love to discuss:\n- [ ] Campus license for our school\n- [ ] District license for multiple campuses\n\nPlease reach out at your convenience.\n\nThank you!`)}`}
              className="btn btn-outline"
              style={{ fontSize: 13, textDecoration: 'none', display: 'inline-flex' }}
            >
              Contact Us About Campus/District Licensing →
            </a>
          </div>
        </div>

        {/* Share Beacon */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Share Beacon with a colleague</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Know another counselor who could use this?
          </p>
          <textarea
            className="form-input"
            rows={4}
            value={editableShareMsg}
            onChange={(e) => setEditableShareMsg(e.target.value)}
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleCopyShare}>
              {shareCopied ? 'Copied!' : 'Copy Message'}
            </button>
            <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={handleEmailShare}>
              Email This
            </button>
          </div>
        </div>

        {/* Billing & Reimbursement */}
        <div style={{ padding: '20px 0', borderTop: '1px solid var(--border)' }}>
          <h3 style={sectionTitle}>Billing & Reimbursement</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
            Generate a professional receipt for reimbursement submission to your district.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => generateBeaconReceipt('annual')}>
              Annual Receipt ($999)
            </button>
            <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => generateBeaconReceipt('monthly')}>
              Monthly Receipt ($99)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
            Beacon by Clear Path Education Group
          </p>
          <p style={{ fontSize: 11, color: '#d1d5db', margin: '4px 0 0' }}>
            Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  );

  function generateBeaconReceipt(plan) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    let y = 0;

    const teal = [15, 118, 110];
    const amount = plan === 'annual' ? '$999.00' : '$99.00';
    const lineItem = plan === 'annual'
      ? 'Beacon Elementary Counselor Platform \u2014 Annual License'
      : 'Beacon Elementary Counselor Platform \u2014 Monthly License';
    const invoiceNum = `BCN-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Header bar
    doc.setFillColor(...teal);
    doc.rect(0, 0, pageWidth, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Beacon', margin, 38);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Clear Path Education Group, LLC', margin, 56);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('RECEIPT / INVOICE', pageWidth - margin, 42, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(200, 220, 220);
    doc.text('clearpathedgroup.com', pageWidth - margin, 58, { align: 'right' });

    y = 110;

    // Invoice details
    doc.setTextColor(60, 60, 80);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Invoice #:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(invoiceNum, margin + 60, y);
    doc.setFont(undefined, 'bold');
    doc.text('Date:', margin + 220, y);
    doc.setFont(undefined, 'normal');
    doc.text(today, margin + 260, y);
    y += 30;

    // Bill To
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 70, 6, 6, 'F');
    doc.setTextColor(...teal);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('BILL TO', margin + 14, y + 18);
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(11);
    doc.text(counselor?.name || 'Counselor', margin + 14, y + 34);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 120);
    const billLine = [counselor?.campus, counselor?.district].filter(Boolean).join(' \u2014 ');
    if (billLine) doc.text(billLine, margin + 14, y + 48);
    if (counselor?.email) doc.text(counselor.email, margin + 14, y + 60);
    y += 90;

    // Line items table header
    doc.setFillColor(...teal);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Description', margin + 14, y + 18);
    doc.text('Amount', pageWidth - margin - 14, y + 18, { align: 'right' });
    y += 28;

    // Line item row
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.rect(margin, y, pageWidth - margin * 2, 32, 'F');
    doc.setDrawColor(230, 230, 235);
    doc.line(margin, y + 32, pageWidth - margin, y + 32);
    doc.text(lineItem, margin + 14, y + 20);
    doc.setFont(undefined, 'bold');
    doc.text(amount, pageWidth - margin - 14, y + 20, { align: 'right' });
    y += 32;

    // Category line
    doc.setFillColor(255, 251, 235);
    doc.rect(margin, y, pageWidth - margin * 2, 28, 'F');
    doc.setDrawColor(230, 230, 235);
    doc.line(margin, y + 28, pageWidth - margin, y + 28);
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Category: Professional Development Software', margin + 14, y + 18);
    y += 28;

    // Tax & total
    const totalsX = pageWidth - margin - 180;
    y += 14;
    doc.setTextColor(100, 100, 120);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Subtotal:', totalsX, y);
    doc.text(amount, pageWidth - margin - 14, y, { align: 'right' });
    y += 16;
    doc.text('Tax (exempt):', totalsX, y);
    doc.text('$0.00', pageWidth - margin - 14, y, { align: 'right' });
    y += 20;
    doc.setFillColor(...teal);
    doc.roundedRect(totalsX - 10, y - 12, pageWidth - margin - totalsX + 24, 30, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Total:', totalsX + 4, y + 8);
    doc.text(amount, pageWidth - margin - 14, y + 8, { align: 'right' });
    y += 50;

    // Payment method
    doc.setTextColor(60, 60, 80);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Method:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text('Zelle', margin + 110, y);
    y += 30;

    // Reimbursement note
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 36, 6, 6, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('This receipt may be submitted for professional development reimbursement.', margin + 14, y + 22);

    // Footer
    const footerY = pageHeight - 40;
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.setFont(undefined, 'normal');
    doc.text('Clear Path Education Group, LLC', margin, footerY - 10);
    doc.text('clearpathedgroup.com \u00B7 support@clearpathedgroup.com', margin, footerY);
    doc.text(invoiceNum, pageWidth - margin, footerY, { align: 'right' });

    const dateSlug = new Date().toISOString().slice(0, 10);
    doc.save(`Beacon_Receipt_${dateSlug}.pdf`);
  }
}

const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const transitionOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const transitionModal = { background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh', overflowY: 'auto' };
const calTh = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' };
const calTd = { padding: '6px 10px', fontSize: 13, color: '#374151' };
