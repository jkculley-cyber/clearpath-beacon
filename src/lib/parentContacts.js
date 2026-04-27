/**
 * Parent Communication Hub helpers — enriches the existing communications
 * store with due-process documentation features. No new schema; new rows
 * carry `outcome` + `tracking_number` fields, old rows continue to work.
 *
 * Three things this module gives the counselor that paper logs don't:
 *   1. A timestamped, defensible attempt history per student
 *   2. Auto-escalation cues (2 voicemails → certified-mail nudge)
 *   3. A printable Due-Process Documentation PDF that lists every attempt
 */

import { db } from './db';
import { format, addBusinessDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hashPayload, stampIntegrityFooter } from './pdfIntegrity';

export const CONTACT_OUTCOMES = [
  'answered',
  'voicemail-left',
  'no-answer',
  'parent-acknowledged',
  'meeting-scheduled',
  'no-response',
  'certified-mail-sent',
  'returned-undeliverable',
];

export const OUTCOME_LABELS = {
  answered:                 'Answered — spoke to parent',
  'voicemail-left':         'Voicemail left',
  'no-answer':              'No answer / busy',
  'parent-acknowledged':    'Parent acknowledged (e.g., email reply)',
  'meeting-scheduled':      'Meeting scheduled',
  'no-response':            'No response after multiple attempts',
  'certified-mail-sent':    'Certified mail sent',
  'returned-undeliverable': 'Mail returned undeliverable',
};

/* ─── Auto-escalation: count recent unanswered attempts ─── */

const UNANSWERED = new Set(['voicemail-left', 'no-answer', 'no-response']);

/**
 * Returns 'urgent' / 'recommended' / null based on attempts in the last 14 days.
 *   - 3+ unanswered → urgent (certified mail strongly recommended)
 *   - 2 unanswered → recommended (consider certified mail)
 */
export function escalationLevel(history) {
  const recent = history.filter((c) => {
    if (!c.contact_date) return false;
    const days = (new Date() - new Date(c.contact_date)) / (1000 * 60 * 60 * 24);
    return days <= 14;
  });
  const certifiedAlready = recent.some((c) => c.outcome === 'certified-mail-sent');
  if (certifiedAlready) return null;
  const unansweredCount = recent.filter((c) => UNANSWERED.has(c.outcome)).length;
  if (unansweredCount >= 3) return 'urgent';
  if (unansweredCount >= 2) return 'recommended';
  return null;
}

/* ─── Auto-create follow-up when outcome is voicemail/no-answer ─── */

export async function maybeCreateFollowUp({ counselorId, studentId, contact, studentName }) {
  if (!UNANSWERED.has(contact.outcome)) return null;
  if (!counselorId) return null;
  const dueAt = addBusinessDays(new Date(), 3);
  const record = {
    counselor_id: counselorId,
    student_id: studentId,
    title: `Re-attempt parent contact: ${studentName || 'student'}`,
    body: `Last attempt ${contact.contact_date} (${OUTCOME_LABELS[contact.outcome] || contact.outcome}). Re-try by phone or move to certified mail if no response.`,
    due_at: dueAt.toISOString(),
    source_type: 'parent_contact',
    source_id: contact.id || null,
    target_url: `/students/${studentId}`,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  const { data, error } = await db.insert('follow_ups', record);
  if (error) return null;
  return data;
}

/* ─── Due-Process Documentation PDF ─── */

const TEAL = [42, 157, 143];
const SLATE = [26, 35, 50];
const GRAY = [107, 114, 128];

function toAscii(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[·•]/g, '-')
    .replace(/§/g, 'Sec.')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '');
}

/**
 * Generate a Due-Process Documentation PDF listing every parent contact
 * attempt for one student. Designed to satisfy "what evidence do you have
 * that you tried to reach the parent" questions in due-process hearings or
 * SPED disputes.
 */
export async function generateDueProcessPdf({ student, counselor, contacts }) {
  const doc = new jsPDF();
  // Hash binds this PDF to the underlying contact list. Re-generating with
  // the same data produces the same hash; any post-hoc edit changes it.
  const integrityHash = await hashPayload({
    student_id: student?.id,
    counselor_id: counselor?.id,
    contacts: (contacts || []).map((c) => ({
      id: c.id,
      contact_date: c.contact_date,
      contact_type: c.contact_type,
      outcome: c.outcome,
      tracking_number: c.tracking_number,
      notes: c.notes,
    })),
  });
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('BEACON', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Parent Contact Documentation', 50, 14);

  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(toAscii(`Parent Contact Log: ${student.name || 'Student'}`), 14, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  const meta = [
    student.grade ? `Grade ${student.grade}` : null,
    counselor?.school_name ? counselor.school_name : null,
    `Generated ${format(new Date(), 'PPP')}`,
  ].filter(Boolean).join('  |  ');
  doc.text(toAscii(meta), 14, 44);
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 48, 196, 48);

  // Counselor identity block
  let y = 56;
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.text('Counselor of record:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.name || '(unset)'), 60, y);
  y += 6;
  if (counselor?.email) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contact:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(toAscii(counselor.email), 60, y);
    y += 6;
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Attempt history (${contacts.length} entr${contacts.length === 1 ? 'y' : 'ies'})`, 14, y);
  y += 4;

  if (contacts.length === 0) {
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text('No parent contact attempts logged for this student.', 14, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Outcome', 'Tracking #', 'Notes']],
      body: contacts.map((c) => [
        c.contact_date || '',
        toAscii(c.contact_type || ''),
        toAscii(OUTCOME_LABELS[c.outcome] || c.outcome || '-'),
        toAscii(c.tracking_number || '-'),
        toAscii((c.notes || '').slice(0, 90) + ((c.notes || '').length > 90 ? '...' : '')),
      ]),
      theme: 'striped',
      headStyles: { fillColor: TEAL, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 50 },
        3: { cellWidth: 26 },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Counselor signature block
  const finalY = doc.lastAutoTable?.finalY || y + 12;
  let sy = Math.min(finalY + 24, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text('Counselor signature', 14, sy);
  doc.setDrawColor(180, 180, 180);
  doc.line(14, sy + 12, 100, sy + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Date: ${format(new Date(), 'M/d/yyyy')}`, 110, sy + 12);

  // Confidentiality footer — sits one line above the integrity footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    'Generated by Beacon | Clear Path Education Group, LLC | Records held on counselor\'s device only.',
    14,
    pageHeight - 22,
  );

  // Integrity footer — content hash + generated-at on every page
  stampIntegrityFooter(doc, { hash: integrityHash, docKind: 'Parent Contact Documentation' });

  const safeName = toAscii(student.name || 'student').replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Parent_Contact_Log_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return integrityHash;
}
