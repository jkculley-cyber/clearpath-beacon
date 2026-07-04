/**
 * Counselor Handoff Package — a successor-facing PDF snapshot of the
 * caseload, generated at (or ahead of) a school-year transition or a
 * counselor's departure.
 *
 * What the person inheriting this caseload needs on day one:
 *   - who the students are (grade, tier, teacher)
 *   - how much service each has received (sessions, last seen)
 *   - what's still open (referrals, follow-ups, active goals)
 *   - the year's headline numbers
 *
 * Deliberately NOT hashed/attested — it's an operational handoff document,
 * not a legal-defense record (same tier as the Progress/MTSS reports).
 * Pair it with an encrypted .bcnbkp backup for the full data transfer.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TEAL = [42, 157, 143];

function sName(s) {
  if (s.first_name) return `${s.first_name} ${s.last_name || ''}`.trim();
  return s.name || 'Unknown';
}

export async function generateHandoffPdf({ counselor, students, sessions, referrals, followUps, goals, summary }) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text('Counselor Handoff Package', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Prepared by ${counselor?.full_name || counselor?.name || 'Counselor'} — ${counselor?.campus || counselor?.school_name || ''}`, 14, 31);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 37);

  // Year headline numbers
  let y = 46;
  if (summary) {
    doc.setFontSize(13);
    doc.setTextColor(...TEAL);
    doc.text(`Year in Review (${summary.label})`, 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [['Students', 'Tier 1 / 2 / 3', 'Sessions', 'Hours', 'SB 179', 'Referrals', 'Parent Contacts', 'Groups']],
      body: [[
        summary.students_served,
        `${summary.tier1} / ${summary.tier2} / ${summary.tier3}`,
        summary.sessions_completed,
        summary.session_hours,
        summary.sb179_pct !== null ? `${summary.sb179_pct}%` : '—',
        summary.referrals_received,
        summary.contacts_logged,
        summary.groups_run,
      ]],
      headStyles: { fillColor: TEAL, fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Per-student caseload table
  const active = students.filter((s) => s.status === 'active');
  const sessionsByStudent = {};
  for (const s of sessions) {
    if (!s.student_id || s.status === 'Cancelled') continue;
    const entry = sessionsByStudent[s.student_id] || { count: 0, last: '' };
    entry.count += 1;
    if ((s.session_date || '') > entry.last) entry.last = s.session_date;
    sessionsByStudent[s.student_id] = entry;
  }
  const openReferralsByName = {};
  for (const r of referrals) {
    if (r.status === 'closed') continue;
    const key = (r.student_name || '').toLowerCase();
    if (key) openReferralsByName[key] = (openReferralsByName[key] || 0) + 1;
  }
  const openFollowUpsByStudent = {};
  for (const f of followUps) {
    if (f.status !== 'pending' || !f.student_id) continue;
    openFollowUpsByStudent[f.student_id] = (openFollowUpsByStudent[f.student_id] || 0) + 1;
  }
  const activeGoalsByStudent = {};
  for (const g of goals) {
    if (g.status !== 'active' || !g.student_id) continue;
    activeGoalsByStudent[g.student_id] = (activeGoalsByStudent[g.student_id] || 0) + 1;
  }

  doc.setFontSize(13);
  doc.setTextColor(...TEAL);
  doc.text(`Active Caseload (${active.length} students)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['Student', 'Grade', 'Tier', 'Teacher', 'Sessions', 'Last Seen', 'Open Ref.', 'Follow-ups', 'Goals']],
    body: active
      .sort((a, b) => (Number(b.tier) || 0) - (Number(a.tier) || 0) || sName(a).localeCompare(sName(b)))
      .map((s) => {
        const sess = sessionsByStudent[s.id] || { count: 0, last: '' };
        return [
          sName(s),
          s.grade || '—',
          s.tier || '—',
          s.teacher || '—',
          sess.count,
          sess.last || '—',
          openReferralsByName[sName(s).toLowerCase()] || '',
          openFollowUpsByStudent[s.id] || '',
          activeGoalsByStudent[s.id] || '',
        ];
      }),
    headStyles: { fillColor: TEAL, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('CONFIDENTIAL — student records. Handle per FERPA and district policy.', 14, 290);
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Handoff instructions for the successor
  if (y > 240) { doc.addPage(); y = 22; }
  doc.setFontSize(13);
  doc.setTextColor(...TEAL);
  doc.text('For the Incoming Counselor', 14, y);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(
    'This PDF is a summary only. The complete records (session notes, parent-contact log, crisis documentation, '
    + 'time tracking) travel in the encrypted Beacon backup file (.bcnbkp) that accompanies this package. '
    + 'To take over this caseload: open beacon.clearpathedgroup.com/setup?signin=1 on your device, enter the '
    + 'license key and the email shown above, and restore from the backup. Questions: support@clearpathedgroup.com.',
    180,
  );
  doc.text(lines, 14, y + 7);

  doc.save(`Beacon_Handoff_${new Date().toISOString().slice(0, 10)}.pdf`);
}
