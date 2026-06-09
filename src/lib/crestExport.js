/**
 * CREST Portfolio PDF Export — assembles the saved + auto-derived artifacts
 * into a TSCA-submission-ready PDF.
 *
 * Per CC10 lesson: jsPDF + WinAnsi encoding is flaky for any non-ASCII char.
 * Every string passed to doc.text() / autoTable here is sanitized via toAscii().
 *
 * Layout:
 *   - Cover page: counselor identity, school year, deadline countdown, overall %
 *   - Per category (5 page-breaks): header, suggested-types coverage table,
 *     all saved artifacts with title / date / description / evidence
 *   - Closing page: source-of-truth note + Beacon attribution
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CREST_CATEGORIES, categoryProgress, overallProgress, getNextCrestDeadline } from './crestData';
import { renderAdditionalInfo } from './pdfShared';

const TEAL = [42, 157, 143];
const PURPLE = [139, 92, 246];
const SLATE = [26, 35, 50];
const GRAY = [107, 114, 128];

/** Replace all non-ASCII with safe equivalents. Mirrors CC10 District-Preview fix. */
function toAscii(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[—–]/g, '-')   // em / en dash
    .replace(/[‘’]/g, "'")    // smart single quotes
    .replace(/[“”]/g, '"')    // smart double quotes
    .replace(/…/g, '...')           // ellipsis
    .replace(/[·•]/g, '-')    // middle dot, bullet
    .replace(/→/g, '->')            // right arrow
    .replace(/←/g, '<-')            // left arrow
    .replace(/✓/g, '[x]')           // check mark
    .replace(/✗/g, '[ ]')           // ballot x
    .replace(/⚠/g, '!')             // warning
    .replace(/[§]/g, 'Sec.')       // section sign
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '');       // strip everything else outside ASCII (newlines + tabs preserved)
}

function header(doc, title, subtitle) {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('BEACON', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('CREST Portfolio', 50, 14);

  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(toAscii(title), 14, 35);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text(toAscii(subtitle), 14, 43);
  }
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 47, 196, 47);
}

function footer(doc, pageNum, total) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Beacon | TSCA CREST Portfolio | Clear Path Education Group, LLC', 14, h - 10);
  doc.text(`Page ${pageNum} of ${total}`, 196, h - 10, { align: 'right' });
}

function buildCoverPage(doc, counselor, schoolYear, artifacts, autoCount) {
  const deadline = getNextCrestDeadline();
  const overall = overallProgress(artifacts);

  header(doc, 'CREST Portfolio Application', `${schoolYear} School Year`);

  let y = 60;
  doc.setFontSize(11);
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.text('Counselor', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.name || '(unset)'), 60, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('School', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.school_name || counselor?.school || '(unset)'), 60, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('District', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toAscii(counselor?.district || '(unset)'), 60, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Submission Deadline', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    toAscii(`${deadline.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${deadline.daysUntil} days from today)`),
    60,
    y
  );
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...SLATE);
  doc.text('Portfolio Summary', 14, y);
  y += 4;

  const rows = CREST_CATEGORIES.map((c) => {
    const p = categoryProgress(c, artifacts);
    const count = artifacts.filter((a) => a.category === c.key).length;
    return [
      `Cat. ${c.number}`,
      toAscii(c.short),
      `${p.filled} of ${p.required}`,
      `${p.pct}%`,
      String(count),
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [['#', 'Category', 'Suggested types covered', 'Coverage', 'Artifacts on file']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: TEAL },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
  });

  let ny = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE);
  doc.text(`Overall coverage: ${overall.pct}% (${overall.filled} of ${overall.required} suggested types)`, 14, ny);
  ny += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(toAscii(`${artifacts.length} total artifacts on file. ${autoCount} sourced live from Beacon at promotion.`), 14, ny);
  ny += 12;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  const note =
    'About this portfolio: artifacts marked "Auto-derived from Beacon" were snapshotted from Beacon\'s Time Tracker, ' +
    'Lessons, Sessions, and Communications modules at the moment the counselor promoted them. The numbers in those ' +
    'sections reflect the school-year-to-date totals on that date, not the date this PDF was generated. Free-form ' +
    'artifacts were entered manually by the counselor.';
  const wrapped = doc.splitTextToSize(toAscii(note), 182);
  doc.text(wrapped, 14, ny);
}

function buildCategoryPage(doc, cat, catArtifacts) {
  doc.addPage();
  header(doc, `Category ${cat.number}: ${cat.short}`, cat.title);

  let y = 56;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const desc = doc.splitTextToSize(toAscii(cat.description), 182);
  doc.text(desc, 14, y);
  y += desc.length * 4 + 6;

  // Suggested-types coverage table for this category
  const filledTypes = new Set(catArtifacts.map((a) => a.type));
  const coverageRows = cat.suggestedArtifacts.map((sa) => [
    toAscii(sa.label),
    filledTypes.has(sa.type) ? 'On file' : 'Not yet',
  ]);
  autoTable(doc, {
    startY: y,
    head: [['Suggested artifact type', 'Status']],
    body: coverageRows,
    theme: 'grid',
    headStyles: { fillColor: TEAL, fontSize: 10 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const v = data.cell.raw;
        if (v === 'On file') data.cell.styles.textColor = [21, 128, 61];
        else data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  if (catArtifacts.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text('No artifacts saved for this category yet.', 14, y);
    return;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text(`Saved Artifacts (${catArtifacts.length})`, 14, y);
  y += 8;

  for (const a of catArtifacts) {
    // Page-break if running out of room
    if (y > 250) {
      doc.addPage();
      header(doc, `Category ${cat.number}: ${cat.short} (continued)`, cat.title);
      y = 60;
    }

    // Artifact card
    doc.setDrawColor(...(a.auto_derived ? PURPLE : GRAY));
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...SLATE);
    const titleWrap = doc.splitTextToSize(toAscii(a.title || '(untitled)'), 140);
    doc.text(titleWrap, 14, y);
    y += titleWrap.length * 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const meta = [
      a.date_collected || (a.created_at?.slice(0, 10) ?? ''),
      a.auto_derived ? `Auto-derived from ${a.source_label || 'Beacon'}` : 'Counselor-entered',
    ].filter(Boolean).join('  |  ');
    doc.text(toAscii(meta), 14, y);
    y += 6;

    if (a.description) {
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      const dWrap = doc.splitTextToSize(toAscii(a.description), 182);
      doc.text(dWrap, 14, y);
      y += dWrap.length * 5;
    }

    if (a.attachment?.name) {
      doc.setFontSize(9);
      doc.setTextColor(...PURPLE);
      const sizeText = a.attachment.size ? ` (${(a.attachment.size / 1024).toFixed(0)} KB)` : '';
      doc.text(toAscii(`Attached file: ${a.attachment.name}${sizeText} - available in Beacon`), 14, y);
      y += 6;
    }

    if (a.evidence) {
      doc.setFontSize(9);
      doc.setTextColor(60, 70, 90);
      const eWrap = doc.splitTextToSize(toAscii(a.evidence), 182);
      // Soft cap on evidence height per artifact — page break if exceeds room
      const capped = eWrap.slice(0, 60);
      if (eWrap.length > 60) {
        capped.push('... [truncated in PDF — see Beacon CREST page for full text]');
      }
      // Page-break-aware render
      for (const line of capped) {
        if (y > 270) {
          doc.addPage();
          header(doc, `Category ${cat.number}: ${cat.short} (continued)`, cat.title);
          y = 60;
          doc.setFontSize(9);
          doc.setTextColor(60, 70, 90);
        }
        doc.text(line, 14, y);
        y += 4;
      }
    }
    y += 8;
  }
}

export function exportCrestPortfolio({ counselor, schoolYear, artifacts, additionalInfo = '' }) {
  const doc = new jsPDF();
  const autoCount = artifacts.filter((a) => a.auto_derived).length;

  buildCoverPage(doc, counselor, schoolYear, artifacts, autoCount);

  for (const cat of CREST_CATEGORIES) {
    const catArtifacts = artifacts
      .filter((a) => a.category === cat.key)
      .sort((a, b) => (a.date_collected || '').localeCompare(b.date_collected || ''));
    buildCategoryPage(doc, cat, catArtifacts);
  }

  // Counselor-added narrative (optional) — its own page, numbered with the rest.
  if ((additionalInfo || '').trim()) {
    doc.addPage();
    renderAdditionalInfo(doc, 30, additionalInfo, { color: PURPLE, sanitize: toAscii });
  }

  // Number every page
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    footer(doc, i, total);
  }

  const safeName = toAscii(counselor?.name || 'counselor').replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`CREST_Portfolio_${safeName}_${schoolYear}.pdf`);
}
