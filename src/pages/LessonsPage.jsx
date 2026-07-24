import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { ASCA_DOMAINS, getGrades } from '../lib/constants';

const SOURCE_PLATFORMS = ['Original', 'Second Step', 'Character Strong', 'Zones of Regulation', 'MindUp', 'Other'];
const ENTRY_TYPES = ['file', 'link', 'text'];

function LessonModal({ open, onClose, counselorId, editLesson }) {
  const { counselor } = useAuth();
  const GRADES = getGrades(counselor);
  const isEdit = !!editLesson;
  const [title, setTitle] = useState('');
  const [entryType, setEntryType] = useState('link');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [gradeTags, setGradeTags] = useState([]);
  const [domainTag, setDomainTag] = useState('');
  const [topicTags, setTopicTags] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('Original');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editLesson) {
      setTitle(editLesson.title || '');
      setEntryType(editLesson.entry_type || 'link');
      setUrl(editLesson.link_url || '');
      setTextContent(editLesson.content_text || '');
      setGradeTags(editLesson.grade_tags || []);
      setDomainTag(editLesson.domain_tag || '');
      setTopicTags((editLesson.topic_tags || []).join(', '));
      setSourcePlatform(editLesson.source_platform || 'Original');
    } else {
      setTitle(''); setEntryType('link'); setUrl(''); setTextContent('');
      setGradeTags([]); setDomainTag(''); setTopicTags(''); setSourcePlatform('Original');
    }
    setError('');
  }, [editLesson, open]);

  if (!open) return null;

  const toggleGrade = (g) => {
    setGradeTags((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      title,
      entry_type: entryType,
      link_url: entryType === 'link' ? url : null,
      content_text: entryType === 'text' ? textContent : null,
      grade_tags: gradeTags,
      domain_tag: domainTag || null,
      topic_tags: topicTags ? topicTags.split(',').map((t) => t.trim()) : [],
      source_platform: sourcePlatform,
    };
    let err;
    if (isEdit) {
      ({ error: err } = await db.update('lesson_library', editLesson.id, payload));
    } else {
      payload.counselor_id = counselorId;
      ({ error: err } = await db.insert('lesson_library', payload));
    }
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={{ ...modal, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{isEdit ? 'Edit Lesson' : 'Add Lesson'}</h3>
        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="form-label">Title *</label>
          <input className="form-input" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 10 }} placeholder="Lesson title" />

          <label className="form-label">Type</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {ENTRY_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setEntryType(t)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `2px solid ${entryType === t ? '#2A9D8F' : '#d1d5db'}`,
                background: entryType === t ? '#e6f7f5' : '#fff',
                color: entryType === t ? '#2A9D8F' : '#6b7280', textTransform: 'capitalize',
              }}>
                {t === 'file' ? 'File Upload' : t === 'link' ? 'URL Link' : 'Text'}
              </button>
            ))}
          </div>

          {entryType === 'link' && (
            <>
              <label className="form-label">URL</label>
              <input className="form-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ marginBottom: 10 }} />
            </>
          )}
          {entryType === 'text' && (
            <>
              <label className="form-label">Lesson Content</label>
              <textarea className="form-input" rows={4} value={textContent} onChange={(e) => setTextContent(e.target.value)} style={{ marginBottom: 10 }} />
            </>
          )}
          {entryType === 'file' && (
            <div style={{ border: '2px dashed #d1d5db', borderRadius: 8, padding: 20, textAlign: 'center', marginBottom: 10, color: '#9ca3af', fontSize: 13 }}>
              File upload coming soon. Use URL link for now.
            </div>
          )}

          <label className="form-label">Grade Levels</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {GRADES.map((g) => (
              <button key={g} type="button" onClick={() => toggleGrade(g)} style={{
                width: 40, height: 36, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                border: `2px solid ${gradeTags.includes(g) ? '#2A9D8F' : '#d1d5db'}`,
                background: gradeTags.includes(g) ? '#e6f7f5' : '#fff',
                color: gradeTags.includes(g) ? '#2A9D8F' : '#6b7280',
              }}>
                {g}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">ASCA Domain</label>
              <select className="form-input" value={domainTag} onChange={(e) => setDomainTag(e.target.value)}>
                <option value="">Select...</option>
                {ASCA_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Source Platform</label>
              <select className="form-input" value={sourcePlatform} onChange={(e) => setSourcePlatform(e.target.value)}>
                {SOURCE_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <label className="form-label">Topics (comma-separated)</label>
          <input className="form-input" value={topicTags} onChange={(e) => setTopicTags(e.target.value)} placeholder="e.g. friendship, empathy, self-regulation" style={{ marginBottom: 16 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Lesson'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LessonsPage() {
  const { counselor } = useAuth();
  const GRADES = getGrades(counselor);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showAdd, setShowAdd] = useState(false);
  const [editLesson, setEditLesson] = useState(null);
  const [previewLesson, setPreviewLesson] = useState(null);

  const loadLessons = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const { data } = await db.select('lesson_library', {
      eq: { counselor_id: counselor.id },
      order: { column: 'created_at', ascending: false },
    });
    setLessons(data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const toggleFavorite = async (lesson) => {
    await db.update('lesson_library', lesson.id, { is_favorite: !lesson.is_favorite });
    loadLessons();
  };

  const handleDelete = async (lesson) => {
    if (!confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    await db.del('lesson_library', lesson.id);
    loadLessons();
  };

  const handleEdit = (lesson) => {
    setEditLesson(lesson);
    setShowAdd(true);
  };

  const filtered = lessons.filter((l) => {
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterGrade && !(l.grade_tags || []).includes(filterGrade)) return false;
    if (filterDomain && l.domain_tag !== filterDomain) return false;
    if (filterSource && l.source_platform !== filterSource) return false;
    return true;
  });

  const typeIcon = (type) => {
    if (type === 'file') return '(PDF)';
    if (type === 'link') return '(Link)';
    return '(Text)';
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Lessons</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setViewMode('grid')} style={{ ...viewBtn, ...(viewMode === 'grid' ? viewBtnActive : {}) }}>Grid</button>
          <button onClick={() => setViewMode('list')} style={{ ...viewBtn, ...(viewMode === 'list' ? viewBtnActive : {}) }}>List</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Lesson</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="form-input" value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={{ width: 120 }}>
          <option value="">All Grades</option>
          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select className="form-input" value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} style={{ width: 160 }}>
          <option value="">All Domains</option>
          {ASCA_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-input" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ width: 160 }}>
          <option value="">All Sources</option>
          {SOURCE_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-muted)' }}>{lessons.length === 0 ? 'No lessons yet. Add your first lesson.' : 'No lessons match your filters.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((l) => (
            <div key={l.id} className="card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setPreviewLesson(l)}>
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(l); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                  color: l.is_favorite ? '#f59e0b' : '#d1d5db',
                }}>
                  {l.is_favorite ? '\u2605' : '\u2606'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleEdit(l); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#2A9D8F', fontWeight: 600,
                }}>Edit</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(l); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444',
                }}>Del</button>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                <span style={{ marginRight: 8 }}>{typeIcon(l.entry_type)}</span>
                {l.source_platform && (
                  <span style={{ padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', fontSize: 11, fontWeight: 600 }}>{l.source_platform}</span>
                )}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', margin: '0 0 8px', paddingRight: 30 }}>{l.title}</h3>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {(l.grade_tags || []).map((g) => (
                  <span key={g} style={{ padding: '1px 6px', borderRadius: 4, background: '#e6f7f5', color: '#2A9D8F', fontSize: 11, fontWeight: 600 }}>{g}</span>
                ))}
              </div>
              {l.domain_tag && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{l.domain_tag}</span>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                Lesson resource
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Grades</th>
                <th style={thStyle}>Domain</th>
                <th style={thStyle}>Used</th>
                <th style={{ ...thStyle, width: 40 }}></th>
                <th style={{ ...thStyle, width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setPreviewLesson(l)}>
                  <td style={tdStyle}><span style={{ fontWeight: 600, color: '#1a2332' }}>{l.title}</span></td>
                  <td style={tdStyle}>{l.entry_type}</td>
                  <td style={tdStyle}>{l.source_platform || '--'}</td>
                  <td style={tdStyle}>{(l.grade_tags || []).join(', ') || '--'}</td>
                  <td style={tdStyle}>{l.domain_tag || '--'}</td>
                  <td style={tdStyle}>{l.session_lessons?.length || 0}</td>
                  <td style={tdStyle}>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(l); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: l.is_favorite ? '#f59e0b' : '#d1d5db' }}>
                      {l.is_favorite ? '\u2605' : '\u2606'}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(l); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#2A9D8F', fontWeight: 600 }}>Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(l); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewLesson && (
        <div style={overlay} onClick={() => setPreviewLesson(null)}>
          <div style={{ ...modal, width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalTitle}>{previewLesson.title}</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {previewLesson.entry_type} &middot; {previewLesson.source_platform}
              {previewLesson.domain_tag && ` \u00b7 ${previewLesson.domain_tag}`}
            </div>
            {previewLesson.entry_type === 'link' && previewLesson.link_url && (
              <a href={previewLesson.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2A9D8F', fontWeight: 600, fontSize: 14 }}>
                Open Link &rarr;
              </a>
            )}
            {previewLesson.entry_type === 'text' && (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, fontSize: 14, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {previewLesson.content_text || 'No content.'}
              </div>
            )}
            {previewLesson.entry_type === 'file' && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>File preview not available.</p>
            )}
            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Lesson resource
              </span>
            </div>
            <button className="btn btn-outline" onClick={() => setPreviewLesson(null)} style={{ width: '100%', marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}

      <LessonModal open={showAdd} onClose={(saved) => { setShowAdd(false); setEditLesson(null); if (saved) loadLessons(); }} counselorId={counselor?.id} editLesson={editLesson} />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px' };
const viewBtn = { padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' };
const viewBtnActive = { border: '1px solid #2A9D8F', background: '#e6f7f5', color: '#2A9D8F', fontWeight: 600 };
