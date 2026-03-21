import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LocalSetupPage() {
  const { setupLocalProfile, saveLicenseKey } = useAuth();
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLicenseError('');

    // Validate license key if provided
    if (licenseKeyInput.trim()) {
      const result = await saveLicenseKey(licenseKeyInput.trim());
      if (!result.valid) {
        setLicenseError(
          result.reason === 'invalid_key' ? 'Invalid license key. Please check and try again.'
          : result.reason === 'expired' ? 'This license has expired. Please contact support.'
          : 'Could not verify license. Please check your connection and try again.'
        );
        setSaving(false);
        return;
      }
    }

    await setupLocalProfile({ name, campus, district });
    setSaving(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 40, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#2A9D8F', marginBottom: 4 }}>Beacon</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Local Mode Setup</div>
        </div>

        <div style={{
          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10,
          padding: 14, marginBottom: 20, fontSize: 13, color: '#0f766e', lineHeight: 1.5,
        }}>
          <strong>Privacy-First Mode</strong><br />
          All data stays on this device. Nothing is sent to any server. Perfect for individual counselors without a district data agreement.
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

          <label style={labelStyle}>License Key</label>
          <input
            style={inputStyle}
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
            placeholder="e.g. BCN-XXXX-XXXX"
          />
          {licenseError && (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{licenseError}</div>
          )}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Enter the license key from your purchase confirmation.
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: '#2A9D8F', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', marginTop: 8,
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Setting up...' : 'Start Using Beacon'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
          Don't have a license key?{' '}
          <a href="/request-access" style={{ color: '#2A9D8F', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
            Request access →
          </a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
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
