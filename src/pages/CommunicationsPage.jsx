import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { CONTACT_TYPES } from '../lib/constants';
import { downloadCsv } from '../lib/csvExport';
import {
  CONTACT_OUTCOMES, OUTCOME_LABELS,
  escalationLevel, maybeCreateFollowUp, generateDueProcessPdf,
} from '../lib/parentContacts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTimeStr = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

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
  const [contactDate, setContactDate] = useState(todayStr);
  const [contactTime, setContactTime] = useState(nowTimeStr);
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState('en');
  const [outcome, setOutcome] = useState('answered');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Template
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Edit existing contact
  const [editingContact, setEditingContact] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [sortField, setSortField] = useState('contact_date');

  // Student name helper — prefer first_name/last_name, fall back to name
  const sName = (s) => s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || '');

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const [commsRes, studRes, templRes] = await Promise.all([
      db.select('communications', {
        eq: { counselor_id: counselor.id },
        order: { column: 'contact_date', ascending: false },
        limit: 100,
      }),
      db.select('students', {
        eq: { counselor_id: counselor.id, status: 'active' },
        order: { column: 'name', ascending: true },
      }),
      db.select('communication_templates', {
        eq: { counselor_id: counselor.id },
        order: { column: 'name', ascending: true },
      }).catch(() => ({ data: [] })),
    ]);

    // Manually join student data onto communications
    const allStudents = studRes.data || [];
    const studentMap = {};
    allStudents.forEach((s) => { studentMap[s.id] = s; });

    const commsWithStudents = (commsRes.data || []).map((c) => ({
      ...c,
      students: studentMap[c.student_id] || null,
    }));

    setComms(commsWithStudents);
    setStudents(allStudents);
    setTemplates(templRes.data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogContact = async (e) => {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    const { data: inserted } = await db.insert('communications', {
      counselor_id: counselor.id,
      student_id: studentId,
      contact_type: contactType,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
      language,
      outcome,
      tracking_number: trackingNumber || null,
      contact_date: contactDate || todayStr(),
      contact_time: contactTime || null,
    });
    // Auto-create follow-up if outcome is unanswered
    if (inserted) {
      const stu = students.find((s) => s.id === studentId);
      await maybeCreateFollowUp({
        counselorId: counselor.id,
        studentId,
        contact: inserted,
        studentName: stu ? sName(stu) : null,
      });
    }
    setSaving(false);
    setNotes('');
    setStudentId('');
    setStudentSearch('');
    setTrackingNumber('');
    setOutcome('answered');
    setContactDate(todayStr());
    setContactTime(nowTimeStr());
    loadData();
  };

  const handleSaveEdit = async (id, updates) => {
    await db.update('communications', id, updates);
    setEditingContact(null);
    loadData();
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Delete this contact log entry? This cannot be undone.')) return;
    await db.del('communications', id);
    setEditingContact(null);
    loadData();
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !notes.trim()) return;
    await db.insert('communication_templates', {
      counselor_id: counselor.id,
      name: templateName,
      body: notes,
    });
    setShowTemplateModal(false);
    setTemplateName('');
    loadData();
  };

  const loadTemplate = (tmpl) => {
    let body = tmpl.body || '';
    const selectedStudent = students.find((s) => s.id === studentId);
    if (selectedStudent) {
      const today = new Date();
      const dateStr = String(today.getMonth() + 1).padStart(2, '0') + '/' + String(today.getDate()).padStart(2, '0') + '/' + today.getFullYear();
      body = body.replace(/\{\{student_name\}\}/g, sName(selectedStudent));
      body = body.replace(/\{\{date\}\}/g, dateStr);
      body = body.replace(/\{\{counselor_name\}\}/g, counselor?.full_name || counselor?.name || '');
      body = body.replace(/\{\{group_name\}\}/g, 'their counseling group');
      body = body.replace(/\{\{school_name\}\}/g, counselor?.campus || counselor?.school_name || 'our school');
      body = body.replace(/\{\{grade\}\}/g, selectedStudent.grade || '');
    }
    setNotes(body);
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    await db.del('communication_templates', id);
    loadData();
  };

  // Open the drafted note in the counselor's own mail client. Nothing is sent
  // from Beacon (local-first stays intact) — the counselor picks the recipient
  // and presses send in Outlook/Gmail. Subject stays PII-free by default.
  const openInEmail = () => {
    const school = counselor?.campus || counselor?.school_name || 'your school';
    const subject = encodeURIComponent(`A note from the ${school} counselor`);
    const body = encodeURIComponent(notes);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Contact log → CSV for Excel-speaking front offices
  const handleExportCsv = () => {
    downloadCsv(
      `beacon-contact-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Time', 'Student', 'Type', 'Outcome', 'Duration (min)', 'Language', 'Tracking #', 'Notes'],
      filteredComms.map((c) => [
        c.contact_date || '',
        c.contact_time || '',
        c.students ? sName(c.students) : '',
        c.contact_type || '',
        OUTCOME_LABELS[c.outcome] || c.outcome || '',
        c.duration_minutes ?? '',
        c.language === 'es' ? 'Spanish' : 'English',
        c.tracking_number || '',
        c.notes || '',
      ])
    );
  };

  // Student search dropdown
  const filteredStudents = studentSearch
    ? students.filter((s) => sName(s).toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  const filteredComms = comms.filter((c) => {
    if (filterType && c.contact_type !== filterType) return false;
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Communications</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
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
                      <div key={s.id} onClick={() => { setStudentId(s.id); setStudentSearch(sName(s)); }}
                        style={dropdownItem}>
                        {sName(s)} <span style={{ color: '#9ca3af', fontSize: 12 }}>Grade {s.grade}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Time</label>
                  <input className="form-input" type="time" value={contactTime} onChange={(e) => setContactTime(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
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

              <label className="form-label">Outcome *</label>
              <select className="form-input" value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ marginBottom: 12 }}>
                {CONTACT_OUTCOMES.map((o) => (
                  <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
                ))}
              </select>

              {(contactType === 'Certified mail' || outcome === 'certified-mail-sent') && (
                <>
                  <label className="form-label">USPS tracking number</label>
                  <input
                    className="form-input"
                    placeholder="e.g., 9407 1118 9956 9999 9999 99"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                </>
              )}

              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 6 }} />
              {notes.trim() && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={openInEmail}
                    title="Opens your email app with this note as the message body — you choose the recipient and press send"
                  >
                    ✉ Open in Email
                  </button>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                    Opens your mail app — nothing is sent from Beacon.
                  </span>
                </div>
              )}

              {/* Escalation banner — visible when this student already has 2+ unanswered attempts */}
              {(() => {
                if (!studentId) return null;
                const studentHistory = comms.filter((c) => c.student_id === studentId);
                const level = escalationLevel(studentHistory);
                if (!level) return null;
                const isUrgent = level === 'urgent';
                return (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 12,
                    background: isUrgent ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isUrgent ? '#fecaca' : '#fde68a'}`,
                    color: isUrgent ? '#991b1b' : '#92400e',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}>
                    <strong>{isUrgent ? 'Urgent:' : 'Recommended:'}</strong>{' '}
                    {isUrgent
                      ? 'You\'ve had 3+ unanswered attempts in the last 14 days. Send certified mail next; document the tracking number above.'
                      : 'You\'ve had 2 unanswered attempts in the last 14 days. Consider certified mail to create due-process documentation.'}
                  </div>
                );
              })()}

              <button type="submit" className="btn btn-primary" disabled={saving || !studentId} style={{ width: '100%' }}>
                {saving ? 'Saving...' : 'Log Contact'}
              </button>
            </form>
          </div>

          {/* Templates */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Templates</h2>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowTemplateModal(true)}>
                Save Current as Template
              </button>
            </div>
            {(() => {
              const filtered = templates.filter((t) => !t.language || t.language === language);
              return filtered.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {language === 'es' ? 'No hay plantillas en español.' : 'No saved templates.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {filtered.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1a2332' }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => loadTemplate(t)} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Use</button>
                      <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )
              })()}
          </div>
        </div>

        {/* Right: Contact History */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Contact History</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                  onClick={handleExportCsv}
                  disabled={filteredComms.length === 0}
                >
                  Export CSV
                </button>
                {studentId && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      const stu = students.find((s) => s.id === studentId);
                      if (!stu) return;
                      const studentName = sName(stu);
                      const studentContacts = comms
                        .filter((c) => c.student_id === studentId)
                        .sort((a, b) => (a.contact_date || '').localeCompare(b.contact_date || ''));
                      try {
                        await generateDueProcessPdf({
                          student: { ...stu, name: studentName },
                          counselor,
                          contacts: studentContacts,
                        });
                      } catch (err) {
                        alert(`Could not generate Due-Process PDF: ${err?.message || err}`);
                      }
                    }}
                  >
                    Due-Process PDF
                  </button>
                )}
                <select className="form-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 160 }}>
                  <option value="">All Types</option>
                  {CONTACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : filteredComms.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No communications logged.</p>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {filteredComms.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setEditingContact(c)}
                    style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    title="Click to edit"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#1a2332', fontSize: 14 }}>
                        {c.students ? sName(c.students) : 'Unknown'}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        {c.contact_date || c.created_at?.slice(0, 10)}
                        {c.contact_time ? ` · ${c.contact_time.slice(0, 5)}` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {c.contact_type}
                      {c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}
                      {c.outcome && (
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151', fontSize: 11 }}>
                          {OUTCOME_LABELS[c.outcome] || c.outcome}
                        </span>
                      )}
                      {c.tracking_number && (
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', fontSize: 11 }} title="USPS tracking">
                          #{c.tracking_number.slice(-6)}
                        </span>
                      )}
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

      {/* Edit Contact Modal */}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          studentName={editingContact.students ? sName(editingContact.students) : 'Unknown'}
          onClose={() => setEditingContact(null)}
          onSave={(updates) => handleSaveEdit(editingContact.id, updates)}
          onDelete={() => handleDeleteContact(editingContact.id)}
        />
      )}

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

function EditContactModal({ contact, studentName, onClose, onSave, onDelete }) {
  const [contactType, setContactType] = useState(contact.contact_type || 'Phone call');
  const [contactDate, setContactDate] = useState(contact.contact_date || todayStr());
  const [contactTime, setContactTime] = useState((contact.contact_time || '').slice(0, 5));
  const [duration, setDuration] = useState(contact.duration_minutes ?? 15);
  const [language, setLanguage] = useState(contact.language || 'en');
  const [outcome, setOutcome] = useState(contact.outcome || 'answered');
  const [trackingNumber, setTrackingNumber] = useState(contact.tracking_number || '');
  const [notes, setNotes] = useState(contact.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      contact_type: contactType,
      contact_date: contactDate || todayStr(),
      contact_time: contactTime || null,
      duration_minutes: duration === '' ? null : parseInt(duration, 10),
      language,
      outcome,
      tracking_number: trackingNumber || null,
      notes: notes || null,
    });
    setSaving(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, width: 460, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Edit Contact</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>{studentName}</p>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Time</label>
              <input className="form-input" type="time" value={contactTime} onChange={(e) => setContactTime(e.target.value)} />
            </div>
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

          <label className="form-label">Outcome</label>
          <select className="form-input" value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ marginBottom: 12 }}>
            {CONTACT_OUTCOMES.map((o) => (
              <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
            ))}
          </select>

          {(contactType === 'Certified mail' || outcome === 'certified-mail-sent') && (
            <>
              <label className="form-label">USPS tracking number</label>
              <input
                className="form-input"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                style={{ marginBottom: 12 }}
              />
            </>
          )}

          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 16 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button
              type="button"
              onClick={onDelete}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #fecaca',
                background: '#fff', color: '#b91c1c', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const dropdown = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' };
const dropdownItem = { padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
