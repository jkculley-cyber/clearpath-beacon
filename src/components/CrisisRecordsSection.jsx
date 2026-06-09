import { useState } from 'react';
import { db } from '../lib/db';
import { generateCrisisPdf } from '../lib/crisisExport';
import { WORKFLOWS, TRIGGER_TYPES } from '../lib/crisisWorkflow';

/**
 * Crisis Records — the "add later" surface for a student's crisis events.
 *
 * Crisis events are written once by CrisisModal. This section lets a counselor
 * re-open a past event, append a dated addendum, and regenerate the PDF.
 *
 * Tamper-evidence model: addenda are APPEND-ONLY. The original answers are never
 * edited; each addendum is a timestamped addition that the integrity hash then
 * covers, so a regenerated PDF is a new, separately attested VERSION of the
 * record — not a rewrite of the original.
 */
export default function CrisisRecordsSection({ student, counselor, events, onChanged }) {
  if (!events || events.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={banner}>
        These are confidential crisis-workflow records. Adding information appends a dated
        addendum — the original entry is never changed — and you can regenerate the PDF afterward.
      </div>
      {events.map((ev) => (
        <CrisisEventCard
          key={ev.id}
          event={ev}
          student={student}
          counselor={counselor}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function triggerLabel(triggerType) {
  return WORKFLOWS[triggerType]?.title
    || TRIGGER_TYPES.find((t) => t.key === triggerType)?.label
    || triggerType
    || 'Crisis event';
}

function fmt(value) {
  if (!value) return null;
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}

function CrisisEventCard({ event, student, counselor, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const addenda = Array.isArray(event.addenda) ? event.addenda : [];

  const saveAddendum = async () => {
    const clean = text.trim();
    if (!clean) return;
    setBusy(true);
    const next = [...addenda, { text: clean, added_at: new Date().toISOString() }];
    const { error } = await db.update('crisis_events', event.id, { addenda: next });
    setBusy(false);
    if (error) {
      alert(`Could not save addendum: ${error.message || error}`);
      return;
    }
    setText('');
    setAdding(false);
    onChanged?.();
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await generateCrisisPdf({ event, counselor, student });
    } catch (err) {
      alert(`Could not generate PDF: ${err?.message || err}`);
    }
    setRegenerating(false);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2332' }}>{triggerLabel(event.trigger_type)}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {fmt(event.occurred_at) ? `Occurred ${fmt(event.occurred_at)}` : null}
            {fmt(event.occurred_at) ? ' · ' : ''}Logged {fmt(event.created_at) || '--'}
            {event.status ? ` · ${event.status}` : ''}
          </div>
        </div>
        <button onClick={regenerate} disabled={regenerating} style={ghostBtn}>
          {regenerating ? 'Generating…' : '📄 Regenerate PDF'}
        </button>
      </div>

      {(event.counselor_addendum || '').trim() && (
        <div style={noteBlock}>
          <div style={noteLabel}>Additional information (at documentation)</div>
          <div style={noteText}>{event.counselor_addendum}</div>
        </div>
      )}

      {addenda.map((a, i) => (
        <div key={i} style={noteBlock}>
          <div style={noteLabel}>Addendum · added {fmt(a.added_at) || '--'}</div>
          <div style={noteText}>{a.text}</div>
        </div>
      ))}

      {adding ? (
        <div style={{ marginTop: 10 }}>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Add information to this record — it will be saved as a dated addendum."
            style={textarea}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAdding(false); setText(''); }} disabled={busy} style={ghostBtn}>Cancel</button>
            <button onClick={saveAddendum} disabled={busy || !text.trim()} style={primaryBtn}>
              {busy ? 'Saving…' : 'Save addendum'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...ghostBtn, marginTop: 10 }}>+ Add addendum</button>
      )}
    </div>
  );
}

const banner = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#991b1b', lineHeight: 1.5 };
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const noteBlock = { marginTop: 10, padding: '8px 12px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8 };
const noteLabel = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 };
const noteText = { fontSize: 13, color: '#1a2332', whiteSpace: 'pre-wrap', lineHeight: 1.5 };
const textarea = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' };
const ghostBtn = { padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' };
const primaryBtn = { padding: '7px 16px', borderRadius: 8, border: 'none', background: '#2A9D8F', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
