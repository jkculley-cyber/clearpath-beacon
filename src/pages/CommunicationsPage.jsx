import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CONTACT_TYPES } from '../lib/constants';

export default function CommunicationsPage() {
  const { counselor } = useAuth();
  const [comms, setComms] = useState([]);
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // New contact form
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [contactType, setContactType] = useState('Phone call');
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  // AI generate
  const [aiDraft, setAiDraft] = useState('');
  const [generating, setGenerating] = useState(false);

  // Template
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('');
  const [sortField, setSortField] = useState('contact_date');

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const [commsRes, studRes, templRes] = await Promise.all([
      supabase.from('communications').select('*, students(first_name, last_name)').eq('counselor_id', counselor.id).order('contact_date', { ascending: false }).limit(100),
      supabase.from('students').select('id, first_name, last_name, grade').eq('counselor_id', counselor.id).eq('status', 'active').order('last_name'),
      supabase.from('communication_templates').select('*').eq('counselor_id', counselor.id).order('name'),
    ]);
    setComms(commsRes.data || []);
    setStudents(studRes.data || []);
    setTemplates(templRes.data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogContact = async (e) => {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    await supabase.from('communications').insert({
      counselor_id: counselor.id,
      student_id: studentId,
      contact_type: contactType,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
      language,
      contact_date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    setNotes('');
    setStudentId('');
    setStudentSearch('');
    loadData();
  };

  const handleGenerate = async () => {
    if (!studentId) return;
    setGenerating(true);
    setAiDraft('');
    try {
      const student = students.find((s) => s.id === studentId);
      const { data } = await supabase.functions.invoke('generate-parent-update', {
        body: {
          student_id: studentId,
          student_name: `${student?.first_name} ${student?.last_name}`,
          language,
          counselor_id: counselor.id,
        },
      });
      setAiDraft(data?.draft || 'Unable to generate update. Please try again.');
    } catch {
      setAiDraft('Error calling AI service. You can write the update manually.');
    }
    setGenerating(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !notes.trim()) return;
    await supabase.from('communication_templates').insert({
      counselor_id: counselor.id,
      name: templateName,
      body: notes,
    });
    setShowTemplateModal(false);
    setTemplateName('');
    loadData();
  };

  const loadTemplate = (tmpl) => {
    setNotes(tmpl.body);
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    await supabase.from('communication_templates').delete().eq('id', id);
    loadData();
  };

  // Student search dropdown
  const filteredStudents = studentSearch
    ? students.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  const filteredComms = comms.filter((c) => {
    if (filterType && c.contact_type !== filterType) return false;
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Communications</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Log Contact */}
        <div>
          <div className="card">
            <h2 style={sectionTitle}>Log New Contact</h2>
            <form onSubmit={handleLogContact}>
              <label className="form-label">Student *</label>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  className="form-input"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => { setStudentSearch(e.target.value); setStudentId(''); }}
                />
                {studentSearch && !studentId && (
                  <div style={dropdown}>
                    {filteredStudents.slice(0, 8).map((s) => (
                      <div key={s.id} onClick={() => { setStudentId(s.id); setStudentSearch(`${s.first_name} ${s.last_name}`); }}
                        style={dropdownItem}>
                        {s.first_name} {s.last_name} <span style={{ color: '#9ca3af', fontSize: 12 }}>Grade {s.grade}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="form-label">Contact Type</label>
                  <select className="form-input" value={contactType} onChange={(e) => setContactType(e.target.value)}>
                    {CONTACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Duration (min)</label>
                  <input className="form-input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>

              <label className="form-label">Language</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[['en', 'English'], ['es', 'Spanish']].map(([code, label]) => (
                  <button key={code} type="button" onClick={() => setLanguage(code)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${language === code ? '#2A9D8F' : '#d1d5db'}`,
                    background: language === code ? '#e6f7f5' : '#fff',
                    color: language === code ? '#2A9D8F' : '#6b7280',
                  }}>{label}</button>
                ))}
              </div>

              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 12 }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving || !studentId} style={{ flex: 1 }}>
                  {saving ? 'Saving...' : 'Log Contact'}
                </button>
                <button type="button" className="btn btn-outline" onClick={handleGenerate} disabled={generating || !studentId} style={{ flex: 1 }}>
                  {generating ? 'Generating...' : 'Generate AI Update'}
                </button>
              </div>
            </form>

            {/* AI Draft */}
            {aiDraft && (
              <div style={{ marginTop: 16 }}>
                <label className="form-label">AI-Generated Draft</label>
                <textarea className="form-input" rows={5} value={aiDraft} onChange={(e) => setAiDraft(e.target.value)} style={{ marginBottom: 8 }} />
                <button className="btn btn-outline" onClick={() => setNotes(aiDraft)} style={{ fontSize: 13 }}>Use as Notes</button>
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Templates</h2>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowTemplateModal(true)}>
                Save Current as Template
              </button>
            </div>
            {templates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No saved templates.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {templates.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1a2332' }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => loadTemplate(t)} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Use</button>
                      <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Contact History */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Contact History</h2>
              <select className="form-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 160 }}>
                <option value="">All Types</option>
                {CONTACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : filteredComms.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No communications logged.</p>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {filteredComms.map((c) => (
                  <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#1a2332', fontSize: 14 }}>
                        {c.students?.first_name} {c.students?.last_name}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{c.contact_date}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {c.contact_type} &middot; {c.duration_minutes} min
                      {c.language === 'es' && <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#d97706', fontSize: 11 }}>ES</span>}
                    </div>
                    {c.notes && <p style={{ fontSize: 13, color: '#4b5563', margin: '4px 0 0' }}>{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div style={overlayStyle} onClick={() => setShowTemplateModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>Save Template</h3>
            <label className="form-label">Template Name</label>
            <input className="form-input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Weekly Check-in" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>This will save the current Notes text as a reusable template.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowTemplateModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateName.trim()} style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const dropdown = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' };
const dropdownItem = { padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
