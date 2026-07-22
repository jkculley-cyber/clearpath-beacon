import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { seedSampleData } from '../lib/seedSampleData';
import { decryptBackup } from '../lib/backupCrypto';
import { importLocalBackup, isCloudModeEnabled } from '../lib/db';
import { isFsAccessSupported, pickBackupFolder, persistPickedBackupFolder, findNewestBackupInFolder } from '../lib/backupFolder';

// Pre-fill the license field when the page is opened from clearpathedgroup.com/activate
// with the key in the URL (e.g. /setup?key=BCN-XXXXXX-XXXX). Counselor doesn't retype.
function readKeyFromUrl() {
  try {
    const k = new URLSearchParams(window.location.search).get('key');
    return k ? k.trim().toUpperCase() : '';
  } catch { return ''; }
}

function readSigninFlag() {
  try { return new URLSearchParams(window.location.search).get('signin') === '1'; }
  catch { return false; }
}

export default function LocalSetupPage() {
  const { setupLocalProfile, saveLicenseKey } = useAuth();
  const navigate = useNavigate();
  const isReturningUser = readSigninFlag();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const [gradeBand, setGradeBand] = useState('elementary');
  const initialKey = readKeyFromUrl();
  const [licenseKey, setLicenseKey] = useState(initialKey);
  // Auto-expand license field for returning users — they're here BECAUSE they have a key
  const [showLicenseField, setShowLicenseField] = useState(!!initialKey || isReturningUser);
  const [licenseError, setLicenseError] = useState('');
  // Returning users almost certainly don't want demo students mixed into their roster
  const [loadSample, setLoadSample] = useState(!isReturningUser);
  const [saving, setSaving] = useState(false);
  // Restore-from-backup state
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

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

    const profile = await setupLocalProfile({ name, campus, district, grade_band: gradeBand });
    if (loadSample && profile?.id) {
      try { await seedSampleData(profile.id, gradeBand); } catch { /* non-blocking */ }
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

  /**
   * Restore-from-backup path for returning users. Reads the encrypted .bcnbkp
   * (or legacy .json) file the user picks, decrypts with the entered license
   * key + email, and imports everything — counselor profile, students,
   * sessions, time entries, the works. Far less friction than retyping
   * profile + losing all prior data.
   */
  const handleRestoreFile = async (file) => {
    setRestoreError('');
    setRestoring(true);
    try {
      // Encryption key is derived from license + email. Both must be provided
      // BEFORE the file picker fires so we can decrypt. Validate up front.
      const trimmedKey = licenseKey.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const buf = new Uint8Array(await file.arrayBuffer());
      const payload = await decryptBackup(buf, {
        licenseKey: trimmedKey,
        email: trimmedEmail,
      });
      // Persist license key into localStorage so post-restore checkLicense works
      if (trimmedKey) {
        await saveLicenseKey(trimmedKey);
      }
      // Import all stores. importLocalBackup expects JSON-string input.
      await importLocalBackup(JSON.stringify(payload));
      // The restored counselor record is now in IndexedDB. Pull its id into
      // localStorage so the auth bootstrap reads it on next mount.
      const restoredCounselor = payload?.counselor?.[0] || payload?.counselors?.[0];
      if (restoredCounselor?.id) {
        localStorage.setItem('beacon_local_counselor_id', restoredCounselor.id);
      }
      window.location.href = '/';
    } catch (err) {
      setRestoreError(err?.message || 'Could not restore backup.');
      setRestoring(false);
    }
  };

  const requireDecryptionInputs = () => {
    if (!licenseKey.trim()) {
      setRestoreError('Enter your license key first — Beacon needs it to decrypt the backup.');
      return false;
    }
    if (!email.trim()) {
      setRestoreError('Enter the work email you used originally — it\'s part of the encryption key.');
      return false;
    }
    return true;
  };

  const onPickRestoreFile = () => {
    if (!requireDecryptionInputs()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bcnbkp,.json,application/octet-stream,application/json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (file) await handleRestoreFile(file);
    };
    input.click();
  };

  /**
   * "Continue on another device" — the counselor points this device at the
   * same OneDrive/Google Drive folder her old device backs up into. We find
   * the newest beacon-backup-* file, restore it, and (behind the
   * district-managed acknowledgment) persist the folder handle so this
   * device keeps backing up to the same place going forward.
   * Poor-man's multi-device sync with zero cloud infrastructure.
   */
  const onRestoreFromFolder = async () => {
    if (!requireDecryptionInputs()) return;
    setRestoreError('');
    try {
      const handle = await pickBackupFolder();
      setRestoring(true);
      const newest = await findNewestBackupInFolder(handle);
      if (!newest) {
        setRestoreError('No Beacon backup files (beacon-backup-…) found in that folder. Pick the folder your old device backs up into, or use the file option below.');
        setRestoring(false);
        return;
      }
      // Restoring (reading) from the folder is always fine. WRITING future
      // auto-backups to it inherits whatever cloud account syncs it — so the
      // handle is persisted only behind the same district-managed
      // acknowledgment the Settings folder picker enforces. Decline = restore
      // still happens; the counselor can wire a folder later in Settings
      // (where the full guardrail modal lives).
      const ackDistrictManaged = window.confirm(
        'Keep backing up to this folder from this device?\n\n'
        + 'Only choose OK if this folder is district-managed (district OneDrive / Google Workspace) '
        + 'or does not sync to any cloud. Personal cloud accounts (free OneDrive, iCloud, personal '
        + 'Google Drive) do not include the FERPA agreements your district negotiated — placing '
        + 'student data there is a compliance gap, encrypted or not.\n\n'
        + 'Choosing Cancel still restores your data; it just won\'t auto-back-up to this folder.'
      );
      if (ackDistrictManaged) {
        try { await persistPickedBackupFolder(handle); } catch { /* non-blocking */ }
      }
      await handleRestoreFile(newest.file);
    } catch (err) {
      // User cancelled the picker (AbortError) — not an error worth showing
      if (err?.name !== 'AbortError') {
        setRestoreError(err?.message || 'Could not read that folder.');
      }
      setRestoring(false);
    }
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
          <div style={{ fontSize: 13, color: '#6b7280', letterSpacing: '.06em' }}>
            {isReturningUser ? 'Sign in to your existing account' : 'Counselor Command Center'}
          </div>
        </div>

        {isReturningUser && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
            padding: 14, marginBottom: 16, fontSize: 13, color: '#78350f', lineHeight: 1.55,
          }}>
            <strong>Welcome back.</strong> Beacon stores everything on the device, so signing in on a new browser starts a fresh local profile.{' '}
            <strong>If you have a backup file (.bcnbkp)</strong> from your old device, enter your license key and email below, then use the <em>Restore from backup</em> link to bring everything back.
          </div>
        )}

        {!isReturningUser && (
          <div style={{
            background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10,
            padding: 14, marginBottom: 20, fontSize: 13, color: '#0f766e', lineHeight: 1.5,
          }}>
            <strong>Privacy-First</strong> — All data stays on this device. Nothing is sent to any server.
          </div>
        )}

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

          {/* Grade band — which grades this counselor serves. Drives grade lists,
              promotion ladder, and default content. SB 179 (80/20) is identical
              across bands, so nothing compliance-related changes here. */}
          <label style={labelStyle}>Grade level I serve</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {[
              { key: 'elementary', label: 'Elementary', sub: 'K–5' },
              { key: 'middle', label: 'Middle', sub: '6–8' },
              { key: 'high', label: 'High', sub: '9–12' },
            ].map((b) => {
              const active = gradeBand === b.key;
              return (
                <button
                  type="button"
                  key={b.key}
                  onClick={() => setGradeBand(b.key)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                    border: active ? '2px solid #2A9D8F' : '1px solid #d1d5db',
                    background: active ? '#e6f4f2' : '#fff',
                    color: active ? '#1f2937' : '#6b7280',
                    fontWeight: active ? 700 : 500, fontSize: 13, lineHeight: 1.3,
                  }}
                >
                  {b.label}
                  <div style={{ fontSize: 11, fontWeight: 500, color: active ? '#2A9D8F' : '#9ca3af' }}>{b.sub}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 4 }}>
            You can change this later in Settings.
          </div>

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
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>From your purchase confirmation email.</span>
                <ForgotLicenseLink defaultEmail={email} />
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
            {saving
              ? 'Setting up...'
              : isReturningUser
                ? (licenseKey.trim() ? 'Sign In & Activate' : 'Continue (no license key entered)')
                : (licenseKey.trim() ? 'Activate & Start Beacon' : 'Start Free Trial \u2014 14 Days')}
          </button>
          {!isReturningUser && !licenseKey.trim() && (
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              No credit card needed. Full access for 14 days.
            </div>
          )}
        </form>

        {isReturningUser && (
          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: '1px solid #e5e7eb', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Continuing from another device?
            </div>
            {isFsAccessSupported() && (
              <button
                type="button"
                onClick={onRestoreFromFolder}
                disabled={restoring || saving}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                  background: '#2A9D8F', color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: restoring || saving ? 'wait' : 'pointer',
                  opacity: restoring || saving ? 0.6 : 1,
                  marginBottom: 8,
                }}
              >
                {restoring ? 'Restoring...' : 'Restore from backup folder (OneDrive / Drive)'}
              </button>
            )}
            {isFsAccessSupported() && (
              <div style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px', lineHeight: 1.5 }}>
                Pick the folder your old device backs up into — Beacon restores the newest backup automatically and keeps backing up to that folder from this device.
              </div>
            )}
            <button
              type="button"
              onClick={onPickRestoreFile}
              disabled={restoring || saving}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid #2A9D8F',
                background: '#fff', color: '#0f766e', fontSize: 14, fontWeight: 700,
                cursor: restoring || saving ? 'wait' : 'pointer',
                opacity: restoring || saving ? 0.6 : 1,
              }}
            >
              {restoring ? 'Restoring...' : 'Restore from backup file (.bcnbkp)'}
            </button>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.5 }}>
              Restore brings back everything from your previous device \u2014 students, sessions, time entries, notes, all of it. Encryption is keyed to your license + email, so both must be entered above before restoring.
            </div>
            {restoreError && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8, lineHeight: 1.5 }}>{restoreError}</div>
            )}
          </div>
        )}

        {/* B4 (CC30 naysayer audit): cloud sign-in hidden until cloud RLS is confirmed
            and district plumbing ships. Auto-restores when CLOUD_MODE_ENABLED flips. */}
        {isCloudModeEnabled() && (
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
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

/**
 * Forgot-license recovery modal. Posts to clearpathedgroup.com/api/recover-license
 * with the buyer's email. The endpoint queries ops Supabase product_licenses
 * via service-role and emails the active key(s) via Resend. Always returns
 * generic "if your email matches, you'll get an email" — anti-enumeration.
 *
 * Closes SCUTA's strongest competitive wedge from CC12 round 4: the lost-
 * license + lost-backup permanent-data-loss scenario.
 */
function ForgotLicenseLink({ defaultEmail }) {
  const [open, setOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Re-sync prefill when the parent's email field changes while modal is closed
  useEffect(() => {
    if (!open && defaultEmail && !recoveryEmail) setRecoveryEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch('https://clearpathedgroup.com/api/recover-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim().toLowerCase() }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not send recovery email. Try again or email support@clearpathedgroup.com.');
      }
    } catch {
      setError('Network error. Email support@clearpathedgroup.com if this keeps happening.');
    }
    setSending(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: 11, padding: 0, whiteSpace: 'nowrap' }}
      >
        Forgot your key?
      </button>

      {open && (
        <div
          onClick={() => !sending && setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', margin: '0 0 6px' }}>Recover your license key</h3>
            {!sent ? (
              <>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.55 }}>
                  Enter the email you used at purchase. We'll email any active license keys associated with that address. The email will only arrive if your address matches a real purchase — no error message either way (anti-enumeration).
                </p>
                <form onSubmit={handleSubmit}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>Purchase email</label>
                  <input
                    style={inputStyle}
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="e.g. you@district.edu"
                  />
                  {error && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</div>}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={sending}
                      style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: sending ? 'wait' : 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !recoveryEmail.trim()}
                      style={{
                        padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                        background: sending || !recoveryEmail.trim() ? '#9ca3af' : '#0d9488',
                        color: '#fff',
                        cursor: sending || !recoveryEmail.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sending ? 'Sending...' : 'Send recovery email'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#1a2332', margin: '0 0 14px', lineHeight: 1.55 }}>
                  If <strong>{recoveryEmail}</strong> matches a purchase, you'll receive an email with your license key shortly. Check your inbox (and spam folder). Then come back and paste the key into the License Key field.
                </p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.55 }}>
                  Didn't get an email? Email <a href="mailto:support@clearpathedgroup.com" style={{ color: '#0d9488' }}>support@clearpathedgroup.com</a> with your name and school — we'll look it up.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setSent(false); }}
                    style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
