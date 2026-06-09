/**
 * Shared helpers for Beacon's generated report PDFs.
 *
 * `renderAdditionalInfo` renders an optional, counselor-typed "Additional
 * Information" block (collected by ExportNotesModal at export time) into a
 * report PDF, with wrapping + page breaks. No-op when the text is empty.
 *
 * SCOPE: report/summary PDFs only (progress, MTSS, group, CREST). Do NOT use
 * this on integrity-hashed documents (crisis event, SB-179 compliance,
 * parent-contact log) — those bind a content hash to the STORED record so that
 * "regenerate it now -> identical hash" proves the document is unaltered. Free
 * text typed at export time isn't in the record, so it would break that
 * guarantee. To add a counselor note to one of those, persist it to the record
 * and include it in the hash payload instead.
 */

const TEAL = [42, 157, 143];

// Normalize smart punctuation copy-pasted from Word/Docs so it renders cleanly
// in jsPDF's WinAnsi Helvetica. Latin-1 accented characters (e.g. names like
// "Jose") are preserved — only typographic punctuation is folded to ASCII.
function normalizePunct(s) {
  return String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
}

/**
 * @param {jsPDF} doc
 * @param {number} startY - current Y cursor
 * @param {string} text - counselor-entered additional information
 * @param {object} [opts]
 * @param {number[]} [opts.color] - heading color (default Beacon teal)
 * @param {number} [opts.left] - left margin (default 14)
 * @param {number} [opts.right] - right edge (default 196)
 * @param {number} [opts.bottom] - bottom limit before a page break (default 278)
 * @param {(s:string)=>string} [opts.sanitize] - extra sanitizer (e.g. toAscii for CREST)
 * @param {string} [opts.heading] - section heading (default "Additional Information")
 * @returns {number} Y position after the rendered section
 */
export function renderAdditionalInfo(doc, startY, text, opts = {}) {
  const clean = (text || '').trim();
  if (!clean) return startY;

  const {
    color = TEAL,
    left = 14,
    right = 196,
    bottom = 278,
    sanitize = (s) => s,
    heading = 'Additional Information',
  } = opts;

  const body = sanitize(normalizePunct(clean));
  let y = startY;

  // Need room for the heading + at least one line.
  if (y > bottom - 14) { doc.addPage(); y = 22; }

  doc.setFontSize(14);
  doc.setTextColor(...color);
  doc.text(sanitize(heading), left, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(body, right - left);
  for (const line of lines) {
    if (y > bottom) { doc.addPage(); y = 22; }
    doc.text(line, left, y);
    y += 6;
  }
  return y + 4;
}
