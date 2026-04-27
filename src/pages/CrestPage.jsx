/**
 * CrestPage — TSCA CREST Award portfolio workspace.
 *
 * Year-long evidence collection mapped to the 5 categories of the Texas Model
 * for Comprehensive School Counseling Programs. Counselors save artifacts as
 * they go (instead of scrambling in October before the November 1 deadline).
 *
 * Two views toggled by internal state:
 *   - Dashboard: deadline countdown + overall progress + 5 category cards
 *   - Category drill-down: suggested artifact types + saved artifacts + add/edit
 *
 * Storage: IndexedDB `crest_artifacts` store (FERPA-clean).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import * as local from '../lib/localDb';
import {
  CREST_CATEGORIES,
  CREST_CATEGORY_BY_KEY,
  getNextCrestDeadline,
  categoryProgress,
  overallProgress,
} from '../lib/crestData';
import { deriveAllArtifacts, buildSnapshotRecord } from '../lib/crestAutoDerive';
import { exportCrestPortfolio } from '../lib/crestExport';

const SCHOOL_YEAR = (() => {
  const now = new Date();
  // Texas school year: Aug → May. Anything Jan-Jul belongs to the year that started prior August.
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
})();

export default function CrestPage() {
  const { counselor } = useAuth();
  const [view, setView] = useState({ type: 'dashboard' });
  const [artifacts, setArtifacts] = useState([]);
  const [autoDerived, setAutoDerived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editArtifact, setEditArtifact] = useState(null); // null | { ...record } | { _new: true, category }
  const [promoting, setPromoting] = useState(null); // type key being promoted

  const loadArtifacts = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const [{ data }, derived] = await Promise.all([
      db.select('crest_artifacts', { eq: { counselor_id: counselor.id } }),
      deriveAllArtifacts(counselor.id),
    ]);
    setArtifacts((data || []).filter((a) => a.school_year === SCHOOL_YEAR));
    setAutoDerived(derived);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadArtifacts(); }, [loadArtifacts]);

  const handlePromote = async (virtual) => {
    if (!virtual?.enoughData) return;
    setPromoting(virtual.type);
    const record = buildSnapshotRecord(virtual, counselor.id, SCHOOL_YEAR, local.uuid);
    const { error } = await db.insert('crest_artifacts', record);
    setPromoting(null);
    if (error) {
      alert(`Could not promote: ${error.message || error}`);
      return;
    }
    loadArtifacts();
  };

  const deadline = getNextCrestDeadline();
  const overall = overallProgress(artifacts);

  if (view.type === 'category') {
    const cat = CREST_CATEGORY_BY_KEY[view.key];
    if (!cat) {
      setView({ type: 'dashboard' });
      return null;
    }
    const catArtifacts = artifacts.filter((a) => a.category === cat.key);
    const catAuto = autoDerived.filter((v) => v.category === cat.key);
    // Hide auto-derived cards whose type already has a saved promotion this year
    const promotedTypes = new Set(catArtifacts.filter((a) => a.auto_derived).map((a) => a.type));
    const visibleAuto = catAuto.filter((v) => !promotedTypes.has(v.type));
    const progress = categoryProgress(cat, artifacts);
    return (
      <div className="page">
        <button onClick={() => setView({ type: 'dashboard' })} className="btn btn-outline" style={{ fontSize: 13, marginBottom: 14 }}>
          ← Back to CREST Dashboard
        </button>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
            Category {cat.number} | {SCHOOL_YEAR}
          </div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>{cat.title}</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{cat.description}</p>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <ProgressBar pct={progress.pct} color={cat.color} />
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {progress.filled} of {progress.required} types covered ({progress.pct}%)
            </span>
          </div>
        </div>

        {visibleAuto.length > 0 && (
          <>
            <h2 style={sectionTitle}>
              Auto-derived from your Beacon data
            </h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '-4px 0 12px' }}>
              Live snapshots from the rest of Beacon. Promote any to lock the current numbers into your portfolio for {SCHOOL_YEAR}.
            </p>
            <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
              {visibleAuto.map((v) => (
                <div key={v.type} className="card" style={{
                  padding: 14,
                  borderLeft: `4px solid ${v.enoughData ? '#8b5cf6' : '#e5e7eb'}`,
                  background: v.enoughData ? '#faf5ff' : '#fff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <strong style={{ fontSize: 14, color: '#1a2332' }}>{v.title}</strong>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#8b5cf6', color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          Auto-derived
                        </span>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{v.sourceLabel}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#4b5563', margin: '4px 0 0', lineHeight: 1.5 }}>
                        {v.summary}
                      </p>
                    </div>
                    {v.enoughData ? (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', background: '#8b5cf6', borderColor: '#8b5cf6' }}
                        disabled={promoting === v.type}
                        onClick={() => handlePromote(v)}
                      >
                        {promoting === v.type ? 'Promoting...' : 'Promote to Portfolio'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', padding: '6px 0' }}>
                        Needs more data
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 style={sectionTitle}>Suggested artifact types</h2>
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {cat.suggestedArtifacts.map((sa) => {
            const existing = catArtifacts.filter((a) => a.type === sa.type);
            const hasOne = existing.length > 0;
            return (
              <div key={sa.type} className="card" style={{
                padding: 14,
                borderLeft: `4px solid ${hasOne ? cat.color : '#e5e7eb'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: '#1a2332' }}>{sa.label}</strong>
                      {hasOne ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cat.color, color: '#fff', fontWeight: 700 }}>
                          ✓ {existing.length} on file
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
                          Not yet
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.5 }}>{sa.hint}</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', background: cat.color, borderColor: cat.color }}
                    onClick={() => setEditArtifact({ _new: true, category: cat.key, type: sa.type, title: sa.label })}
                  >
                    + Add
                  </button>
                </div>
                {existing.length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    {existing.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setEditArtifact(a)}
                        style={{
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#1a2332', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.title || sa.label}
                          </div>
                          {a.description && (
                            <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                              {a.description}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {a.date_collected || a.created_at?.slice(0, 10)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <h2 style={sectionTitle}>Other artifacts in this category</h2>
        {(() => {
          const suggestedTypes = new Set(cat.suggestedArtifacts.map((sa) => sa.type));
          const others = catArtifacts.filter((a) => !suggestedTypes.has(a.type));
          if (others.length === 0) {
            return (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                None yet. Add a free-form artifact below if you have evidence that doesn't fit the suggested types.
              </p>
            );
          }
          return (
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {others.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setEditArtifact(a)}
                  className="card"
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2332' }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.description}</div>}
                </button>
              ))}
            </div>
          );
        })()}

        <button
          className="btn btn-outline"
          style={{ fontSize: 13 }}
          onClick={() => setEditArtifact({ _new: true, category: cat.key, type: 'custom', title: '' })}
        >
          + Add free-form artifact
        </button>

        <ArtifactModal
          artifact={editArtifact}
          onClose={() => setEditArtifact(null)}
          counselorId={counselor?.id}
          onSaved={() => { setEditArtifact(null); loadArtifacts(); }}
        />
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 className="page-title">CREST Award Tracking</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 18, lineHeight: 1.6, maxWidth: 760 }}>
            <strong>Counselors Reinforcing Excellence for Students in Texas (CREST)</strong> — sponsored by the Texas School Counselor Association. Build your portfolio across the year using the 5 categories of the Texas Model. Add evidence as you collect it; ship a polished application before the November 1 deadline.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ background: '#8b5cf6', borderColor: '#8b5cf6', whiteSpace: 'nowrap' }}
          disabled={artifacts.length === 0}
          onClick={() => exportCrestPortfolio({ counselor, schoolYear: SCHOOL_YEAR, artifacts })}
          title={artifacts.length === 0 ? 'Add artifacts first' : 'Export the portfolio as PDF'}
        >
          Export Portfolio PDF
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24,
      }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={kpiLabel}>Application Deadline</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: deadline.daysUntil <= 30 ? '#dc2626' : deadline.daysUntil <= 60 ? '#a16207' : '#1a2332', marginTop: 4 }}>
            {deadline.daysUntil} days
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {deadline.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={kpiLabel}>School Year</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2332', marginTop: 4 }}>{SCHOOL_YEAR}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={kpiLabel}>Artifacts on File</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2A9D8F', marginTop: 4 }}>{artifacts.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>this school year</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={kpiLabel}>Overall Coverage</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: overall.pct >= 80 ? '#15803d' : overall.pct >= 50 ? '#a16207' : '#1a2332', marginTop: 4 }}>{overall.pct}%</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{overall.filled} of {overall.required} suggested types</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          <h2 style={sectionTitle}>The 5 Texas Model Categories</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '-4px 0 14px' }}>
            Click any category to view suggested evidence types and add artifacts.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {CREST_CATEGORIES.map((cat) => {
              const progress = categoryProgress(cat, artifacts);
              return (
                <button
                  key={cat.key}
                  onClick={() => setView({ type: 'category', key: cat.key })}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: `5px solid ${cat.color}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Category {cat.number}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cat.color }}>{progress.pct}%</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2332', marginBottom: 4, lineHeight: 1.3 }}>
                    {cat.short}
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5, minHeight: 36 }}>
                    {cat.description}
                  </p>
                  <ProgressBar pct={progress.pct} color={cat.color} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    {progress.filled} of {progress.required} suggested types covered
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, fontSize: 13, color: '#0f766e', lineHeight: 1.6 }}>
            <strong>Tip:</strong> Beacon already collects much of what CREST wants. Your <strong>Time Tracker</strong> generates the SB 179 / Use of Time Analysis. Your <strong>Lessons</strong> module captures program curriculum. Your <strong>Sessions</strong> + <strong>Referrals</strong> are evidence for Service Delivery and Responsive Services. As you keep working in Beacon, your portfolio grows itself.
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Artifact add/edit modal ─── */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

// Whitelist of file types acceptable as CREST evidence. Keep narrow:
// portfolios get reviewed by district admins / TSCA evaluators on shared
// machines, so .exe / .hta / .lnk / scripts must never be attachable. A
// counselor who needs to attach something else can ZIP it inside a PDF.
const ALLOWED_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);
const ALLOWED_ATTACHMENT_EXTS = /\.(pdf|png|jpe?g|gif|webp|txt|csv)$/i;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ArtifactModal({ artifact, onClose, counselorId, onSaved }) {
  const isNew = artifact?._new;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [dateCollected, setDateCollected] = useState('');
  const [attachment, setAttachment] = useState(null); // { name, type, size, dataUrl } | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (artifact) {
      setTitle(artifact.title || '');
      setDescription(artifact.description || '');
      setEvidence(artifact.evidence || '');
      setDateCollected(artifact.date_collected || new Date().toISOString().slice(0, 10));
      setAttachment(artifact.attachment || null);
      setError('');
    }
  }, [artifact]);

  if (!artifact) return null;
  const cat = CREST_CATEGORY_BY_KEY[artifact.category];

  const handleFile = (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`File is ${formatBytes(file.size)}. Maximum is 5 MB. Trim or split it before attaching.`);
      e.target.value = '';
      return;
    }
    const declaredType = (file.type || '').toLowerCase();
    const extOk = ALLOWED_ATTACHMENT_EXTS.test(file.name);
    const typeOk = declaredType && ALLOWED_ATTACHMENT_MIMES.has(declaredType);
    if (!extOk || !typeOk) {
      setError('Only PDF, PNG, JPG, GIF, WEBP, TXT, or CSV files can be attached. Convert to PDF if your document is a different type.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // Sanity-check the data URL prefix matches an allowed MIME, defense-in-depth
      // against File objects with spoofed type fields.
      const result = String(reader.result || '');
      const dataUrlMime = result.match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || '';
      if (!ALLOWED_ATTACHMENT_MIMES.has(dataUrlMime)) {
        setError('That file type is not allowed.');
        return;
      }
      setAttachment({
        name: file.name,
        type: declaredType,
        size: file.size,
        dataUrl: result,
      });
    };
    reader.onerror = () => setError('Could not read the file. Try again.');
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    if (!attachment?.dataUrl) return;
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.name || 'attachment';
    a.click();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    if (!title.trim()) {
      setError('Title is required.');
      setSaving(false);
      return;
    }

    if (isNew) {
      const record = {
        id: local.uuid(),
        counselor_id: counselorId,
        category: artifact.category,
        type: artifact.type,
        title: title.trim(),
        description: description.trim() || null,
        evidence: evidence.trim() || null,
        date_collected: dateCollected,
        school_year: SCHOOL_YEAR,
        created_at: new Date().toISOString(),
        attachment: attachment || null,
      };
      const { error: err } = await db.insert('crest_artifacts', record);
      if (err) { setError(err.message || String(err)); setSaving(false); return; }
    } else {
      const { error: err } = await db.update('crest_artifacts', artifact.id, {
        title: title.trim(),
        description: description.trim() || null,
        evidence: evidence.trim() || null,
        date_collected: dateCollected,
        attachment: attachment || null,
      });
      if (err) { setError(err.message || String(err)); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (!confirm('Delete this artifact? This cannot be undone.')) return;
    setSaving(true);
    await db.del('crest_artifacts', artifact.id);
    setSaving(false);
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ marginBottom: 14 }}>
          {cat && (
            <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Category {cat.number} | {cat.short}
            </div>
          )}
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>
            {isNew ? 'Add CREST Artifact' : 'Edit CREST Artifact'}
          </h3>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <label className="form-label">Title *</label>
        <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 2025-26 Annual Counseling Plan" style={{ marginBottom: 12 }} />

        <label className="form-label">Date collected</label>
        <input className="form-input" type="date" value={dateCollected} onChange={(e) => setDateCollected(e.target.value)} style={{ marginBottom: 12 }} />

        <label className="form-label">Description</label>
        <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line description for the portfolio." style={{ marginBottom: 12 }} />

        <label className="form-label">Evidence / narrative</label>
        <textarea className="form-input" rows={5} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Paste the artifact text or write a narrative pointing to where the evidence lives (file path, URL, drawer, etc.). The application export bundles all of these together." style={{ marginBottom: 16 }} />

        <label className="form-label">Attachment (optional, max 5 MB)</label>
        {attachment ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attachment.name}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {formatBytes(attachment.size)} | {attachment.type || 'file'}
              </div>
            </div>
            <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleDownload}>
              Download
            </button>
            <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px', color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => setAttachment(null)}>
              Remove
            </button>
          </div>
        ) : (
          <input
            type="file"
            onChange={handleFile}
            style={{ marginBottom: 16, fontSize: 13 }}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
          />
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {!isNew && (
            <button className="btn btn-outline" onClick={handleDelete} disabled={saving} style={{ color: '#b91c1c', borderColor: '#fecaca' }}>
              Delete
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose} disabled={saving} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : isNew ? 'Add Artifact' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ width: '100%', height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || '#2A9D8F', transition: 'width 0.3s' }} />
    </div>
  );
}

const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const kpiLabel = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 };
