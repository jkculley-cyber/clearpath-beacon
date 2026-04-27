/**
 * SessionNoteTemplateModal — pick a template, fill prompted fields, get back
 * a properly-formatted SOAP note. Caller receives the text via onUseNote.
 *
 * Two-stage modal:
 *   Stage 1: pick a template (grouped by category)
 *   Stage 2: fill fields, see live preview, click "Use this note"
 */
import { useEffect, useState, useMemo } from 'react';
import { SESSION_NOTE_TEMPLATES } from '../lib/sessionNoteTemplates';

export default function SessionNoteTemplateModal({ open, onClose, onUseNote, ctx }) {
  const [stage, setStage] = useState('pick'); // 'pick' | 'fill'
  const [template, setTemplate] = useState(null);
  const [values, setValues] = useState({});

  // Reset state every time the modal opens (per CC9 modal-reset rule)
  useEffect(() => {
    if (open) {
      setStage('pick');
      setTemplate(null);
      setValues({});
    }
  }, [open]);

  const grouped = useMemo(() => {
    const map = {};
    for (const t of SESSION_NOTE_TEMPLATES) {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    return map;
  }, []);

  const preview = useMemo(() => {
    if (!template) return '';
    try {
      return template.build(values, ctx || {});
    } catch (err) {
      return `[Preview error: ${err.message}]`;
    }
  }, [template, values, ctx]);

  if (!open) return null;

  const startTemplate = (t) => {
    setTemplate(t);
    setValues(Object.fromEntries(t.fields.map((f) => [f.key, ''])));
    setStage('fill');
  };

  const useNote = () => {
    onUseNote(preview);
    onClose();
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>
            {stage === 'pick' ? 'Pick a Session Note Template' : `Fill: ${template?.title}`}
          </h3>
          <button onClick={onClose} style={closeBtn} aria-label="Close">×</button>
        </div>

        {stage === 'pick' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
              Pick the closest match — Beacon will turn your short answers into a properly-formatted SOAP note. Edit anything before you save.
            </p>
            <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    {cat}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => startTemplate(t)}
                        style={tmplBtn}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2A9D8F'; e.currentTarget.style.background = '#f0fdfa'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2332' }}>{t.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {t.fields.length} short questions → SOAP note
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {stage === 'fill' && template && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <button onClick={() => setStage('pick')} style={backBtn}>
                ← Pick a different template
              </button>
              {template.fields.map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={fieldLabel}>{f.label}</label>
                  <textarea
                    value={values[f.key] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ''}
                    rows={f.rows || 1}
                    style={fieldInput}
                  />
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Preview (live)
              </div>
              <pre style={previewBox}>{preview}</pre>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={onClose} style={cancelBtn}>Cancel</button>
                <button onClick={useNote} style={useBtn}>Use this note</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 };
const modal = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 880, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const closeBtn = { background: 'none', border: 'none', fontSize: 28, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: 0, width: 32, height: 32 };
const tmplBtn = { textAlign: 'left', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', transition: 'all 0.1s' };
const backBtn = { background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 14 };
const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const fieldInput = { width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' };
const previewBox = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 12, color: '#1a2332', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 380, overflow: 'auto', fontFamily: 'inherit', margin: 0, lineHeight: 1.5 };
const cancelBtn = { flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const useBtn = { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#2A9D8F', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
