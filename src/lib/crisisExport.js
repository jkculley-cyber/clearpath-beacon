/**
 * Crisis Event Documentation PDF — defensible, timestamped record of the
 * structured workflow the counselor completed. Designed for: (a) the
 * student's confidential file, (b) attachment to a CPS report, (c) evidence
 * in a TEA / due-process / OCR review.
 *
 * Per CC10 lesson: ASCII-only at every text-call site.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WORKFLOWS, TRIGGER_TYPES } from './crisisWorkflow';
import { format } from 'date-fns';
import { hashPayload, stampIntegrityFooter } from './pdfIntegrity';
import { attestPdfHash } from './pdfAttestation';
import { getLicenseKey } from './license';
import { renderAdditionalInfo } from './pdfShared';

const TEAL = [42, 157, 143];
const RED = [220, 38, 38];
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

function answerToText(step, value) {
  if (value == null || value === '') return '(no answer)';
  if (step.type === 'yn_detail' && typeof value === 'object') {
    const yn = value.answer === true ? 'Yes' : value.answer === false ? 'No' : '(not answered)';
    const detail = value.detail ? ` — ${value.detail}` : '';
    return yn + detail;
  }
  if (step.type === 'datetime') {
    try {
      return format(new Date(value), 'PPp');
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export async function generateCrisisPdf({ event, counselor, student }) {
  const wf = WORKFLOWS[event.trigger_type];
  const trigger = TRIGGER_TYPES.find((t) => t.key === event.trigger_type);
  const title = wf?.title || 'Crisis Event';
  const doc = new jsPDF();

  // Content hash binds this PDF to the underlying record. Re-generating the
  // PDF after an edit produces a different hash; matching hash = identical
  // record. Lawyer-friendly verification path: "regenerate it now."
  const integrityHash = await hashPayload({
    id: event.id,
    counselor_id: event.counselor_id,
    student_id: event.student_id,
    trigger_type: event.trigger_type,
    occurred_at: event.occurred_at,
    created_at: event.created_at,
    retroactive_minutes: event.retroactive_minutes || 0,
    answers: event.answers,
    follow_up_schedule: event.follow_up_schedule,
    // Only include these keys when present, so events without them hash exactly
    // as they did before the fields existed (backward-compatible). Later-added
    // addenda change the hash on purpose: each is a new, separately attested
    // version of the document; the original answers above are never altered.
    ...(event.counselor_addendum ? { counselor_addendum: event.counselor_addendum } : {}),
    ...(Array.isArray(event.addenda) && event.addenda.length ? { addenda: event.addenda } : {}),
  });

  // Header bar — red for immediate-attention triggers, teal otherwise
  const isUrgent = event.trigger_type === 'suicide' || event.trigger_type === 'threat';
  doc.setFillColor(...(isUrgent ? RED : TEAL));
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('BEACON', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Crisis Event Documentation', 50, 15);

  // Title
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(toAscii(title), 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  const occurredLabel = event.occurred_at ? format(new Date(event.occurred_at), 'PPp') : '(not provided)';
  const loggedLabel = format(new Date(event.created_at || Date.now()), 'PPp');
  const meta = [
    `Student: ${student?.name || '(unset)'}`,
    student?.grade ? `Grade ${student.grade}` : null,
    `Event occurred: ${occurredLabel}`,
    `Logged: ${loggedLabel}`,
  ].filter(Boolean).join('  |  ');
  doc.text(toAscii(meta), 14, 46);
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 50, 196, 50);

  // Retroactive-entry banner — flagged any time the counselor recorded the
  // event more than 30 minutes after it occurred. Forces the document to be
  // honest about its own contemporaneousness.
  const retroMinutes = Number(event.retroactive_minutes || 0);
  if (retroMinutes > 30) {
    const human = retroMinutes < 60
      ? `${retroMinutes} minutes`
      : retroMinutes < 1440
        ? `${Math.round(retroMinutes / 60)} hour${retroMinutes >= 120 ? 's' : ''}`
        : `${Math.round(retroMinutes / 1440)} day${retroMinutes >= 2880 ? 's' : ''}`;
    doc.setFillColor(254, 243, 199); // amber-100
    doc.rect(14, 51, 182, 11, 'F');
    doc.setTextColor(146, 64, 14); // amber-800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(toAscii(`RETROACTIVE ENTRY — recorded approximately ${human} after the reported event time.`), 18, 58);
    doc.setFont('helvetica', 'normal');
  }

  // Counselor + administrative block — push down if a retroactive banner was drawn
  let y = retroMinutes > 30 ? 70 : 58;
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.text('Counselor of record:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.name || '(unset)'), 60, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('School:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.school_name || counselor?.school || '(unset)'), 60, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Event ID:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(event.id || '(unset)'), 60, y);
  y += 10;

  // Answer table
  const rows = (wf?.steps || []).map((step) => [
    toAscii(step.label),
    toAscii(answerToText(step, event.answers?.[step.key])),
  ]);
  autoTable(doc, {
    startY: y,
    head: [['Question', 'Counselor response']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: isUrgent ? RED : TEAL, fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 92 } },
    margin: { left: 14, right: 14 },
  });

  // Follow-ups
  let fy = (doc.lastAutoTable?.finalY || y) + 12;
  if (fy > 240) { doc.addPage(); fy = 30; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text('Scheduled follow-ups', 14, fy);
  fy += 4;
  const fuRows = (event.follow_up_schedule || []).map((f) => [
    toAscii(f.label || ''),
    toAscii(f.due_at ? format(new Date(f.due_at), 'PPp') : ''),
  ]);
  if (fuRows.length === 0) {
    fy += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text('None scheduled.', 14, fy);
  } else {
    autoTable(doc, {
      startY: fy,
      head: [['Follow-up', 'Due']],
      body: fuRows,
      theme: 'grid',
      headStyles: { fillColor: TEAL, fontSize: 10 },
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });
    fy = doc.lastAutoTable.finalY;
  }

  // Counselor-added information (optional) — part of the timestamped record and
  // covered by the integrity hash above. The creation-time note renders first;
  // each later addendum renders under its own dated heading (append-only — the
  // original answers are never edited).
  if ((event.counselor_addendum || '').trim()) {
    fy = renderAdditionalInfo(doc, fy + 12, event.counselor_addendum, { color: SLATE, sanitize: toAscii, bottom: 250 });
  }
  const addenda = Array.isArray(event.addenda) ? event.addenda.filter((a) => (a?.text || '').trim()) : [];
  for (const ad of addenda) {
    let stamp = '';
    try { if (ad.added_at) stamp = format(new Date(ad.added_at), 'PPp'); } catch { stamp = ''; }
    const heading = stamp ? `Addendum - added ${stamp}` : 'Addendum';
    fy = renderAdditionalInfo(doc, fy + 10, ad.text, { color: SLATE, sanitize: toAscii, bottom: 250, heading });
  }

  // Signature block — flows after the addendum; new page if it would collide
  // with the footers.
  let sy = fy + 16;
  if (sy > doc.internal.pageSize.getHeight() - 35) { doc.addPage(); sy = 40; }
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

  // Confidentiality footer (one line above the integrity footer)
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      'Confidential. Generated by Beacon (Clear Path Education Group). Stored on counselor\'s device only.',
      14,
      ph - 22,
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, ph - 22, { align: 'right' });
  }

  // Attestation log — fire-and-forget POST to ops Supabase. Returns null if
  // offline. The PDF generation never blocks on this.
  const attest = await attestPdfHash({
    counselorId: counselor?.id,
    documentKind: 'crisis',
    contentHash: integrityHash,
    licenseKey: getLicenseKey(),
  });

  // Integrity footer — content hash + generated-at + attestation receipt
  stampIntegrityFooter(doc, { hash: integrityHash, docKind: 'Crisis Event Documentation', attest });

  const safeName = toAscii(student?.name || 'student').replace(/[^a-zA-Z0-9]+/g, '_');
  const triggerSlug = trigger?.key || 'event';
  doc.save(`Crisis_${triggerSlug}_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { hash: integrityHash, attestation: attest };
}
