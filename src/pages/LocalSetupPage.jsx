import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { seedSampleData } from '../lib/seedSampleData';

// Pre-fill the license field when the page is opened from clearpathedgroup.com/activate
// with the key in the URL (e.g. /setup?key=BCN-XXXXXX-XXXX). Counselor doesn't retype.
function readKeyFromUrl() {
  try {
    const k = new URLSearchParams(window.location.search).get('key');
    return k ? k.trim().toUpperCase() : '';
  } catch { return ''; }
}

export default function LocalSetupPage() {
  const { setupLocalProfile, saveLicenseKey } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const initialKey = readKeyFromUrl();
  const [licenseKey, setLicenseKey] = useState(initialKey);
  const [showLicenseField, setShowLicenseField] = useState(!!initialKey);
  const [licenseError, setLicenseError] = useState('');
  const [loadSample, setLoadSample] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLicenseError('');

    // Validate license key if provided
    if (licenseKey.trim()) {
      const result = await saveLicenseKey(licenseKey.trim());
      if (!result.valid) {
        setLicenseError(
          result.reason === 'invalid_key' ? 'Invalid license key. Please check and try again.'
          : result.reason === 'expired' ? 'This license has expired. Contact support@clearpathedgroup.com.'
          : 'Could not verify license. Check your internet connection and try again.'
        );
        setSaving(false);
        return;
      }
    }

    const profile = await setupLocalProfile({ name, campus, district });
    if (loadSample && profile?.id) {
      try { await seedSampleData(profile.id); } catch { /* non-blocking */ }
    }

    // Notify Kim — fire-and-forget, non-blocking, no student data sent
    const FLAGGED_DISTRICTS = ['spring isd', 'spring']
    const districtLower = district.trim().toLowerCase()
    const isFlagged = FLAGGED_DISTRICTS.some(d => districtLower.includes(d))
    try {
      fetch('https://formspree.io/f/xpqjngpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          source: isFlagged ? 'FLAGGED_DISTRICT_beacon_trial' : 'beacon_trial_started',
          product: 'Beacon',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          school_name: campus.trim(),
          district: district.trim(),
          has_license: !!licenseKey.trim(),
          loaded_sample: loadSample,
          timestamp: new Date().toISOString(),
          _subject: isFlagged
            ? `ACTION REQUIRED: Spring ISD user signed up for Beacon — ${name.trim()}`
            : `New Beacon trial: ${name.trim()} — ${campus.trim() || district.trim()}`,
        }),
      }).catch(() => {})
    } catch { /* non-blocking */ }

    // Also save lead to ops Supabase for Waypoint Admin visibility
    try {
      const OPS_URL = 'https://xbpuqaqpcbixxodblaes.supabase.co';
      const OPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicHVxYXFwY2JpeHhvZGJsYWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjk4MDQsImV4cCI6MjA4Nzk0NTgwNH0.9Rhmz-FLUXnEQXpRCkg3G2ppzPxs2DinaYDmdD_wvPA';
      fetch(`${OPS_URL}/rest/v1/demo_leads`, {
        method: 'POST',
        headers: { 'apikey': OPS_KEY, 'Authorization': `Bearer ${OPS_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          district_name: district.trim() || campus.trim() || 'Unknown',
          role: 'counselor',
          referrer: document.referrer || null,
          utm_source: 'beacon',
          utm_campaign: licenseKey.trim() ? 'licensed' : 'trial',
        }),
      }).catch(() => {})
    } catch { /* non-blocking */ }
    navigate('/', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#2A9D8F', marginBottom: 4 }}>Beacon</div>
          <div style={{ fontSize: 13, color: '#6b7280', letterSpacing: '.06em' }}>Counselor Command Center</div>
        </div>

        <div style={{
          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10,
          padding: 14, marginBottom: 20, fontSize: 13, color: '#0f766e', lineHeight: 1.5,
        }}>
          <strong>Privacy-First</strong> — All data stays on this device. Nothing is sent to any server.
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Your Name *</label>
          <input
            style={inputStyle}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sarah Johnson"
          />

          <label style={labelStyle}>Work Email *</label>
          <input
            style={inputStyle}
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sjohnson@district.edu"
          />

          <label style={labelStyle}>Campus</label>
          <input
            style={inputStyle}
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            placeholder="e.g. Sunshine Elementary"
          />

          <label style={labelStyle}>District</label>
          <input
            style={inputStyle}
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. Lonestar ISD"
          />

          {/* Sample data option */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
            cursor: 'pointer', fontSize: 13, color: '#374151',
          }}>
            <input
              type="checkbox"
              checked={loadSample}
              onChange={(e) => setLoadSample(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2A9D8F' }}
            />
            <span>Load sample data so I can explore Beacon</span>
          </label>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, paddingLeft: 26 }}>
            Adds 5 students, 2 groups, and 2 weeks of sessions. You can delete it anytime in Settings.
          </div>

          {/* License key — collapsible */}
          {showLicenseField ? (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>License Key</label>
              <input
                style={inputStyle}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="BCN-XXXXXX-XXXX"
              />
              {licenseError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{licenseError}</div>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                From your purchase confirmation email. Gives full access beyond the trial.
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLicenseField(true)}
              style={{ background: 'none', border: 'none', color: '#2A9D8F', cursor: 'pointer', fontWeight: 600, fontSize: 12, marginTop: 12, padding: 0 }}
            >
              Have a license key? Enter it here →
            </button>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              background: '#2A9D8F', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', marginTop: 20,
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Setting up...' : licenseKey.trim() ? 'Activate & Start Beacon' : 'Start Free Trial \u2014 14 Days'}
          </button>
          {!licenseKey.trim() && (
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              No credit card needed. Full access for 14 days.
            </div>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
          Have a district account?{' '}
          <button
            onClick={() => {
              localStorage.setItem('beacon_storage_mode', 'cloud');
              window.location.reload();
            }}
            style={{ background: 'none', border: 'none', color: '#2A9D8F', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          >
            Sign in with cloud mode
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
