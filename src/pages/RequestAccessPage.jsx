import { useState } from 'react';

const FORMSPREE_URL = 'https://formspree.io/f/xpqjngpp';

export default function RequestAccessPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [school, setSchool] = useState('');
  const [district, setDistrict] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          school_name: school.trim(),
          district: district.trim(),
          source: 'beacon_request',
          product: 'Beacon — Elementary Counselor Platform',
        }),
      });
      if (!res.ok) throw new Error('Submit failed');
      setSuccess(true);
    } catch {
      setError('Something went wrong. Please email support@clearpathedgroup.com instead.');
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2A9D8F', marginBottom: 8 }}>You're in!</div>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              We'll send your access details to <strong style={{ color: '#111' }}>{email}</strong> — usually within one business day.
            </p>

            <div style={{
              background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10,
              padding: 16, textAlign: 'left', fontSize: 13, color: '#0f766e', lineHeight: 1.6, marginBottom: 24,
            }}>
              <strong>What happens next:</strong><br />
              1. We'll email your trial access details<br />
              2. Open Beacon on your phone or laptop<br />
              3. Start tracking your caseload immediately
            </div>

            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
              Want to explore right now? You can start with local mode — no account needed.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a
                href="/setup"
                style={{
                  padding: '11px 24px', borderRadius: 10, background: '#2A9D8F', color: '#fff',
                  fontWeight: 700, fontSize: 14, textDecoration: 'none',
                }}
              >
                Try Local Mode →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#2A9D8F', marginBottom: 4 }}>Beacon</div>
          <div style={{ fontSize: 13, color: '#6b7280', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Elementary Counselor Platform
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 6 }}>Request Access</div>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
            14-day free trial — no credit card, no district approval needed.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Your Name *</label>
          <input
            style={inputStyle}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ms. Sarah Johnson"
            autoFocus
          />

          <label style={labelStyle}>School Email *</label>
          <input
            style={inputStyle}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sjohnson@school.edu"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>School Name</label>
              <input
                style={inputStyle}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="Lincoln Elementary"
              />
            </div>
            <div>
              <label style={labelStyle}>District</label>
              <input
                style={inputStyle}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Austin ISD"
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c', marginTop: 12 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              background: '#2A9D8F', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer', marginTop: 16,
              opacity: submitting || !name.trim() || !email.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Request Access →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            Already have a license key?{' '}
            <a href="/setup" style={{ color: '#2A9D8F', fontWeight: 600, textDecoration: 'none' }}>
              Go to setup →
            </a>
          </div>
          <div style={{ fontSize: 11, color: '#d1d5db' }}>
            Questions? <a href="mailto:support@clearpathedgroup.com" style={{ color: '#9ca3af' }}>support@clearpathedgroup.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrapStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)', padding: 24,
};

const cardStyle = {
  background: '#fff', borderRadius: 16, padding: 40, width: 440,
  boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
};

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
