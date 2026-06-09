import { useState } from 'react';

/**
 * Collects an optional "Additional Information" narrative before a report PDF is
 * generated, then hands it to the caller's generator. Used by the student,
 * group, and CREST exports so a counselor can add context the structured data
 * doesn't capture.
 *
 * Props:
 *   title       — modal heading (e.g. "Export Progress PDF")
 *   onConfirm   — async (additionalInfo: string) => void; runs the export
 *   onClose     — () => void; dismiss without exporting
 *   placeholder — optional textarea placeholder
 */
export default function ExportNotesModal({ title = 'Export PDF', onConfirm, onClose, placeholder }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (err) {
      console.warn('PDF export failed:', err);
      setBusy(false);
    }
  };

  return (
    <div style={overlay} onClick={busy ? undefined : onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={heading}>{title}</h2>
        <p style={sub}>
          Anything you add here is included in the PDF under an
          {' '}<strong>“Additional Information”</strong> section. Leave it blank to skip.
        </p>
        <label style={lbl} htmlFor="export-notes">Additional information (optional)</label>
        <textarea
          id="export-notes"
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || 'Add any context, narrative, or follow-up the report should include…'}
          style={ta}
        />
        <div style={row}>
          <button type="button" onClick={onClose} disabled={busy} style={btnGhost}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={busy} style={btnPrimary}>
            {busy ? 'Generating…' : '📄 Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 };
const card = { background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const heading = { fontSize: 19, fontWeight: 700, color: '#1a2332', margin: '0 0 6px' };
const sub = { fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 };
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const ta = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' };
const row = { display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' };
const btnGhost = { padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' };
const btnPrimary = { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#2A9D8F', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
