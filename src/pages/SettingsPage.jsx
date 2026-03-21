import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { exportLocalBackup, importLocalBackup } from '../lib/db';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function SettingsPage() {
  const { counselor, refreshCounselor, isLocalMode, switchStorageMode } = useAuth();
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [district, setDistrict] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(82);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyReferral, setNotifyReferral] = useState(true);

  // Schedule blocks
  const [blocks, setBlocks] = useState([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [blockName, setBlockName] = useState('');
  const [blockDay, setBlockDay] = useState('Monday');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (counselor) {
      setName(counselor.name || '');
      setCampus(counselor.campus || '');
      setDistrict(counselor.district || '');
      setYearStart(counselor.school_year_start || '');
      setYearEnd(counselor.school_year_end || '');
      setAlertThreshold(counselor.alert_threshold || 82);
      setNotifyEmail(counselor.notify_email !== false);
      setNotifyReferral(counselor.notify_referral !== false);
    }
  }, [counselor]);

  const loadBlocks = useCallback(async () => {
    if (!counselor?.id) return;
    const { data } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('counselor_id', counselor.id)
      .order('day_of_week')
      .order('start_time');
    setBlocks(data || []);
  }, [counselor]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('counselors').update({
      name,
      campus,
      district,
      school_year_start: yearStart || null,
      school_year_end: yearEnd || null,
      alert_threshold: alertThreshold,
      notify_email: notifyEmail,
      notify_referral: notifyReferral,
    }).eq('id', counselor.id);

    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Settings saved.');
      if (refreshCounselor) refreshCounselor();
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleSaveBlock = async () => {
    if (!blockName || !blockStart || !blockEnd) return;
    const row = {
      counselor_id: counselor.id,
      block_name: blockName,
      day_of_week: blockDay,
      start_time: blockStart,
      end_time: blockEnd,
    };
    if (editBlock) {
      await supabase.from('schedule_blocks').update(row).eq('id', editBlock.id);
    } else {
      await supabase.from('schedule_blocks').insert(row);
    }
    setShowBlockForm(false);
    setEditBlock(null);
    setBlockName('');
    setBlockStart('');
    setBlockEnd('');
    loadBlocks();
  };

  const handleEditBlock = (b) => {
    setEditBlock(b);
    setBlockName(b.block_name);
    setBlockDay(b.day_of_week);
    setBlockStart(b.start_time);
    setBlockEnd(b.end_time);
    setShowBlockForm(true);
  };

  const handleDeleteBlock = async (id) => {
    if (!confirm('Delete this schedule block?')) return;
    await supabase.from('schedule_blocks').delete().eq('id', id);
    loadBlocks();
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }

    // Verify current password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: counselor.email || '',
      password: currentPw,
    });
    if (signInErr) { setPwError('Current password is incorrect.'); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); return; }

    setPwSuccess('Password updated successfully.');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div style={{ maxWidth: 640 }}>
        {/* Profile */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" value={counselor?.email || ''} disabled style={{ background: '#f3f4f6' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Campus</label>
              <input className="form-input" value={campus} onChange={(e) => setCampus(e.target.value)} />
            </div>
            <div>
              <label className="form-label">District</label>
              <input className="form-input" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
          </div>
        </div>

        {/* School Year */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>School Year Dates</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Used for YTD compliance calculations.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Schedule Blocks */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Schedule Blocks</h2>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => { setEditBlock(null); setBlockName(''); setBlockDay('Monday'); setBlockStart(''); setBlockEnd(''); setShowBlockForm(true); }}>
              + Add Block
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Mark times unavailable for counseling (lunch, specials, testing, etc.)
          </p>

          {blocks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No blocks configured.</p>
          ) : (
            <div>
              {blocks.map((b) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1a2332', fontSize: 14 }}>{b.block_name}</span>
                    <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280' }}>
                      {b.day_of_week} {b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleEditBlock(b)} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDeleteBlock(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showBlockForm && (
            <div style={{ marginTop: 12, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a2332', margin: '0 0 10px' }}>
                {editBlock ? 'Edit Block' : 'New Block'}
              </h4>
              <label className="form-label">Block Name</label>
              <input className="form-input" value={blockName} onChange={(e) => setBlockName(e.target.value)} placeholder="e.g. Lunch" style={{ marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <label className="form-label">Day</label>
                  <select className="form-input" value={blockDay} onChange={(e) => setBlockDay(e.target.value)}>
                    {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Start</label>
                  <input className="form-input" type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">End</label>
                  <input className="form-input" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => { setShowBlockForm(false); setEditBlock(null); }} style={{ fontSize: 13 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveBlock} style={{ fontSize: 13 }}>
                  {editBlock ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 80/20 Threshold */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Compliance Alert Threshold</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Show a warning when YTD counseling percentage drops below this value.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input className="form-input" type="number" min="50" max="100" value={alertThreshold} onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))} style={{ width: 100 }} />
            <span style={{ fontSize: 14, color: '#6b7280' }}>% (default: 82%)</span>
          </div>
        </div>

        {/* Notifications */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Notifications</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Email notifications for compliance alerts
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyReferral} onChange={(e) => setNotifyReferral(e.target.checked)} />
            Email notifications for new referrals
          </label>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ padding: '10px 32px' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saveMsg && <span style={{ fontSize: 14, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>}
        </div>

        {/* Change Password */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Change Password</h2>
          {pwError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 10 }}>{pwSuccess}</div>}
          <label className="form-label">Current Password</label>
          <input className="form-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} style={{ marginBottom: 8, maxWidth: 320 }} />
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ marginBottom: 8, maxWidth: 320 }} />
          <label className="form-label">Confirm New Password</label>
          <input className="form-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={{ marginBottom: 14, maxWidth: 320 }} />
          <button className="btn btn-outline" onClick={handleChangePassword} disabled={!currentPw || !newPw}>
            Update Password
          </button>
        </div>

        {/* Data Storage */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Data Storage</h2>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '10px 14px', borderRadius: 8,
            background: isLocalMode ? '#f0fdfa' : '#eff6ff',
            border: `1px solid ${isLocalMode ? '#99f6e4' : '#bfdbfe'}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isLocalMode ? '#2A9D8F' : '#3b82f6',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: isLocalMode ? '#0f766e' : '#1d4ed8' }}>
              {isLocalMode ? 'Local Mode — data stays on this device' : 'Cloud Mode — synced to Supabase'}
            </span>
          </div>

          {isLocalMode && (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
                All your data is stored in this browser's IndexedDB. Export a backup regularly to avoid data loss if you clear browser data.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={async () => {
                  const data = await exportLocalBackup();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `beacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  Export Backup (JSON)
                </button>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const text = await file.text();
                    if (confirm('This will replace ALL local data. Continue?')) {
                      await importLocalBackup(text);
                      window.location.reload();
                    }
                  };
                  input.click();
                }}>
                  Restore from Backup
                </button>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                  Have a district data agreement? Switch to cloud mode for cross-device sync and AI features.
                </p>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => {
                    if (confirm('Switch to cloud mode? You will need to sign in with a district account. Your local data will remain available if you switch back.')) {
                      switchStorageMode('cloud');
                    }
                  }}
                >
                  Switch to Cloud Mode
                </button>
              </div>
            </>
          )}

          {!isLocalMode && (
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Your data is synced to the cloud via Supabase. It is accessible from any device where you sign in.
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
            Beacon by Clear Path Education Group
          </p>
          <p style={{ fontSize: 11, color: '#d1d5db', margin: '4px 0 0' }}>
            Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
