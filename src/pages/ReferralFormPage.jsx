import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { db, isLocalMode } from '../lib/db';
import { CONCERN_TYPES, URGENCY_LEVELS } from '../lib/constants';

const GRADES = ['K', '1', '2', '3', '4', '5'];

export default function ReferralFormPage() {
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [concernType, setConcernType] = useState('');
  const [urgency, setUrgency] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // In local mode, write to IndexedDB so the counselor can see it.
    // In cloud mode, write to Supabase so it reaches the counselor's cloud DB.
    const referralData = {
      student_name: studentName,
      grade,
      teacher_name: teacherName,
      concern_type: concernType,
      urgency,
      notes: notes || null,
      status: 'open',
    };
    const { error: err } = isLocalMode()
      ? await db.insert('referrals', referralData)
      : await supabase.from('referrals').insert(referralData);

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.brandRow}>
            <div style={styles.logoCircle}>
              <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="16" stroke="#fff" strokeWidth="2" />
                <path d="M18 6 L18 30 M10 14 L18 6 L26 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={styles.brand}>Beacon</h1>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' }}>Referral Submitted</h2>
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
              Thank you. The school counselor will review this referral and follow up as needed.
            </p>
            <button onClick={() => { setSubmitted(false); setStudentName(''); setGrade(''); setTeacherName(''); setConcernType(''); setUrgency(''); setNotes(''); }}
              className="btn btn-primary" style={{ marginTop: 24 }}>
              Submit Another Referral
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.logoCircle}>
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="16" stroke="#fff" strokeWidth="2" />
              <path d="M18 6 L18 30 M10 14 L18 6 L26 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={styles.brand}>Beacon</h1>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', textAlign: 'center', margin: '0 0 4px' }}>
          Student Referral Form
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: '0 0 24px' }}>
          Use this form to refer a student to the school counselor.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="form-label">Student Name *</label>
          <input className="form-input" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="First and last name" style={{ marginBottom: 12 }} />

          <label className="form-label">Grade *</label>
          <select className="form-input" required value={grade} onChange={(e) => setGrade(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Select grade...</option>
            {GRADES.map((g) => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`}</option>)}
          </select>

          <label className="form-label">Your Name (Teacher)</label>
          <input className="form-input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Your name" style={{ marginBottom: 12 }} />

          <label className="form-label">Concern Category *</label>
          <select className="form-input" required value={concernType} onChange={(e) => setConcernType(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Select concern...</option>
            {CONCERN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="form-label">Urgency *</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {URGENCY_LEVELS.map((u) => {
              const colors = { Routine: '#6b7280', Soon: '#f59e0b', Urgent: '#ef4444' };
              const active = urgency === u;
              return (
                <button key={u} type="button" onClick={() => setUrgency(u)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${active ? colors[u] : '#d1d5db'}`,
                  background: active ? colors[u] + '15' : '#fff',
                  color: active ? colors[u] : '#6b7280',
                }}>
                  {u}
                </button>
              );
            })}
          </div>

          <label className="form-label">Additional Notes</label>
          <textarea className="form-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the concern, what you have observed, and any steps already taken..." style={{ marginBottom: 24 }} />

          <button type="submit" className="btn btn-primary" disabled={submitting || !urgency} style={{ width: '100%' }}>
            {submitting ? 'Submitting...' : 'Submit Referral'}
          </button>
        </form>
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
        Beacon by Clear Path Education Group
      </p>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f5 100%)', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 500, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 16, padding: '36px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  brandRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16,
  },
  logoCircle: {
    width: 40, height: 40, borderRadius: '50%', background: '#2A9D8F',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brand: {
    fontSize: 22, fontWeight: 700, color: '#2A9D8F', margin: 0,
  },
};
