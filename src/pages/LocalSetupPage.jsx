import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LocalSetupPage() {
  const { setupLocalProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await setupLocalProfile({ name, campus, district });
    navigate('/', { replace: true });
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

          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: '#2A9D8F', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', marginTop: 16,
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Setting up...' : 'Start Free Trial \u2014 14 Days'}
          </button>
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            No credit card or license key needed. You'll have full access for 14 days.
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
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
