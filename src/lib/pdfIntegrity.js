/**
 * PDF integrity helpers.
 *
 * Beacon's defensive-documentation PDFs (Crisis, Due-Process, SB-179) are
 * generated on the counselor's device. They are NOT cryptographically signed
 * — that would require a server, a CA, and a real chain of trust. What they
 * SHOULD do, at minimum, is bind a hash of the underlying record into the
 * footer of every page so that:
 *
 *   1. Two PDFs generated from the SAME record produce the SAME hash, even
 *      if they're regenerated months apart.
 *   2. Any post-hoc edit to the record produces a DIFFERENT hash.
 *   3. A reviewer (lawyer, OCR, district admin) can challenge a print-out by
 *      asking "regenerate the PDF and confirm the hash matches" — if it
 *      doesn't, the record was edited after the fact.
 *
 * The hash covers the canonical-JSON-serialized record payload (sorted keys,
 * stringified values), NOT the PDF binary itself. That avoids the recursion
 * of "hash printed in PDF → PDF bytes → different hash."
 */

/**
 * Canonical JSON: sorted keys, stable encoding. Two equal objects produce the
 * same string regardless of property insertion order.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

/**
 * SHA-256 of canonicalized payload, returned as lowercase hex.
 * Falls back to 'unsupported' on browsers without SubtleCrypto (very rare).
 */
export async function hashPayload(payload) {
  if (!globalThis.crypto?.subtle) return 'unsupported';
  const text = canonicalize(payload);
  const buf = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Truncate a hash for display. The full 64-char hex is in the footer; this
 * shorter form ("ab12cd34") is for quick eyeballing.
 */
export function shortHash(hash) {
  if (!hash || hash === 'unsupported') return '—';
  return hash.slice(0, 8) + '…' + hash.slice(-8);
}

/**
 * Stamp a content-hash + generated-at footer onto every page of a jsPDF doc.
 * Call this AFTER all content is drawn but BEFORE doc.save().
 *
 * @param {jsPDF} doc
 * @param {Object} opts
 * @param {string} opts.hash      — full SHA-256 hex (or 'unsupported')
 * @param {string} opts.docKind   — 'Crisis' | 'Parent Contact' | 'SB 179' etc.
 */
export function stampIntegrityFooter(doc, { hash, docKind = 'Beacon document' }) {
  const generated = new Date().toISOString();
  const pageCount = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    // First line: kind + generated timestamp + version
    doc.text(`${docKind} | Generated ${generated} | Beacon`, 14, ph - 4);
    // Second line above default footer: content hash
    if (hash && hash !== 'unsupported') {
      doc.text(`SHA-256: ${hash}`, 14, ph - 16);
    } else {
      doc.text('SHA-256: unavailable in this browser', 14, ph - 16);
    }
    doc.text(`Page ${i}/${pageCount}`, pageW - 14, ph - 4, { align: 'right' });
  }
}
