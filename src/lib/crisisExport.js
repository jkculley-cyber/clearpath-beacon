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

export function generateCrisisPdf({ event, counselor, student }) {
  const wf = WORKFLOWS[event.trigger_type];
  const trigger = TRIGGER_TYPES.find((t) => t.key === event.trigger_type);
  const title = wf?.title || 'Crisis Event';
  const doc = new jsPDF();

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
  const meta = [
    `Student: ${student?.name || '(unset)'}`,
    student?.grade ? `Grade ${student.grade}` : null,
    `Logged ${format(new Date(event.created_at || Date.now()), 'PPp')}`,
  ].filter(Boolean).join('  |  ');
  doc.text(toAscii(meta), 14, 46);
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 50, 196, 50);

  // Counselor + administrative block
  let y = 58;
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

  // Signature block
  let sy = Math.min(fy + 16, 252);
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

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      'Confidential. Generated by Beacon (Clear Path Education Group). Stored on counselor\'s device only.',
      14,
      ph - 10,
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, ph - 10, { align: 'right' });
  }

  const safeName = toAscii(student?.name || 'student').replace(/[^a-zA-Z0-9]+/g, '_');
  const triggerSlug = trigger?.key || 'event';
  doc.save(`Crisis_${triggerSlug}_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
