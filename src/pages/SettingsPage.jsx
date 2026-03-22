import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { db, exportLocalBackup, importLocalBackup } from '../lib/db';

const GRADE_PROMOTIONS = [
  { from: 'K', to: '1' },
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '4' },
  { from: '4', to: '5' },
  { from: '5', to: 'Graduated' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function SettingsPage() {
  const { counselor, refreshCounselor, isLocalMode, switchStorageMode, licenseState, saveLicenseKey, getLicenseKey } = useAuth();
  const [licKey, setLicKey] = useState('');
  const [licMsg, setLicMsg] = useState('');
  const [licSaving, setLicSaving] = useState(false);
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

  // School Year Transition
  const [showTransition, setShowTransition] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState(null);
  const [archiveGroups, setArchiveGroups] = useState(true);
  const [resetSessions, setResetSessions] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionResult, setTransitionResult] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Share Beacon
  const [compliancePct, setCompliancePct] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

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
    const { data } = await db.select('schedule_blocks', {
      eq: { counselor_id: counselor.id },
      order: { column: 'day_of_week', ascending: true },
    });
    // Secondary sort by start_time (db.select only supports one order)
    const sorted = (data || []).sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week < b.day_of_week ? -1 : 1;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    setBlocks(sorted);
  }, [counselor]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // Load compliance % for share message
  useEffect(() => {
    if (!counselor?.id) return;
    (async () => {
      const { data: entries } = await db.select('time_entries', { eq: { counselor_id: counselor.id } });
      if (!entries || entries.length === 0) return;
      const direct = entries.filter(e => e.category === 'direct' || e.service_type === 'direct').reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const total = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      if (total > 0) setCompliancePct(Math.round((direct / total) * 100));
    })();
  }, [counselor]);

  const shareMessage = useMemo(() => {
    let msg = "I've been using Beacon to track my caseload and 80/20 compliance \u2014 it's been a game changer.";
    if (compliancePct != null) {
      msg += ` I'm at ${compliancePct}% compliance this year thanks to Beacon.`;
    }
    msg += ' Free 14-day trial, no setup needed: beacon.clearpathedgroup.com';
    return msg;
  }, [compliancePct]);

  const [editableShareMsg, setEditableShareMsg] = useState('');
  useEffect(() => { setEditableShareMsg(shareMessage); }, [shareMessage]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(editableShareMsg);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Check out Beacon');
    const body = encodeURIComponent(editableShareMsg);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    const { error } = await db.update('counselors', counselor.id, {
      name,
      campus,
      district,
      school_year_start: yearStart || null,
      school_year_end: yearEnd || null,
      alert_threshold: alertThreshold,
      notify_email: notifyEmail,
      notify_referral: notifyReferral,
    });

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
      await db.update('schedule_blocks', editBlock.id, row);
    } else {
      await db.insert('schedule_blocks', row);
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
    await db.del('schedule_blocks', id);
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

  const handleStartTransition = async () => {
    if (!counselor?.id) return;
    const { data: allStudents } = await db.select('students', {
      eq: { counselor_id: counselor.id, status: 'active' },
    });
    const students = allStudents || [];
    const promoteCounts = {};
    let graduateCount = 0;
    for (const s of students) {
      const grade = (s.grade || '').toString().trim();
      const promo = GRADE_PROMOTIONS.find((p) => p.from === grade);
      if (promo) {
        if (promo.to === 'Graduated') {
          graduateCount++;
        } else {
          promoteCounts[`${promo.from} -> ${promo.to}`] = (promoteCounts[`${promo.from} -> ${promo.to}`] || 0) + 1;
        }
      }
    }
    setTransitionPreview({
      totalStudents: students.length,
      promoteCounts,
      graduateCount,
      students,
    });
    setArchiveGroups(true);
    setResetSessions(true);
    setTransitionResult(null);
    setShowTransition(true);
  };

  const handleConfirmTransition = async () => {
    if (!transitionPreview || !counselor?.id) return;
    setTransitioning(true);
    let promoted = 0;
    let graduated = 0;
    let archived = 0;

    // Promote / graduate each student
    for (const s of transitionPreview.students) {
      const grade = (s.grade || '').toString().trim();
      const promo = GRADE_PROMOTIONS.find((p) => p.from === grade);
      if (!promo) continue;
      if (promo.to === 'Graduated') {
        await db.update('students', s.id, { status: 'graduated' });
        graduated++;
      } else {
        await db.update('students', s.id, { grade: promo.to });
        promoted++;
      }
    }

    // Archive completed groups if checked
    if (archiveGroups) {
      const { data: groups } = await db.select('groups', {
        eq: { counselor_id: counselor.id, status: 'completed' },
      });
      for (const g of (groups || [])) {
        await db.update('groups', g.id, { status: 'archived' });
        archived++;
      }
    }

    setTransitioning(false);
    setTransitionResult({ promoted, graduated, archived });
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

        {/* License */}
        {isLocalMode && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={sectionTitle}>License</h2>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              padding: '10px 14px', borderRadius: 8,
              background: licenseState.valid ? '#f0fdfa' : '#fef2f2',
              border: `1px solid ${licenseState.valid ? '#99f6e4' : '#fecaca'}`,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: licenseState.valid ? '#22c55e' : '#ef4444',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: licenseState.valid ? '#0f766e' : '#dc2626' }}>
                {licenseState.valid ? 'License Active' :
                  licenseState.reason === 'no_license' ? 'No License Key' :
                  licenseState.reason === 'invalid_key' ? 'Invalid License Key' :
                  licenseState.reason === 'expired' ? 'License Expired' :
                  'License Verification Failed'}
              </span>
            </div>
            {getLicenseKey() && (
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Current key: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{getLicenseKey()}</code>
              </p>
            )}
            {!licenseState.valid && (
              <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>
                Your license is inactive. You can view existing data but cannot create new records until you enter a valid license key.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">License Key</label>
                <input
                  className="form-input"
                  value={licKey}
                  onChange={(e) => setLicKey(e.target.value.toUpperCase())}
                  placeholder="BCN-XXXX-XXXX"
                  style={{ maxWidth: 280 }}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                disabled={licSaving || !licKey.trim()}
                onClick={async () => {
                  setLicSaving(true);
                  setLicMsg('');
                  const result = await saveLicenseKey(licKey.trim());
                  if (result.valid) {
                    setLicMsg('License activated!');
                    setLicKey('');
                  } else {
                    setLicMsg(result.reason === 'invalid_key' ? 'Invalid key.' : result.reason === 'expired' ? 'License expired.' : 'Could not verify.');
                  }
                  setLicSaving(false);
                  setTimeout(() => setLicMsg(''), 4000);
                }}
              >
                {licSaving ? 'Verifying...' : 'Activate'}
              </button>
            </div>
            {licMsg && <div style={{ fontSize: 13, marginTop: 6, color: licMsg.includes('activated') ? '#22c55e' : '#ef4444' }}>{licMsg}</div>}
          </div>
        )}

        {/* School Year Transition */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>School Year Transition</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Archive this year's data and promote students to the next grade. Your history is preserved.
          </p>
          <button
            className="btn btn-primary"
            style={{ background: '#2A9D8F', borderColor: '#2A9D8F', fontWeight: 600, fontSize: 14, padding: '10px 24px' }}
            onClick={handleStartTransition}
          >
            Start New School Year
          </button>
        </div>

        {/* Transition Confirmation Modal */}
        {showTransition && transitionPreview && (
          <div style={transitionOverlay} onClick={() => { if (!transitioning) { setShowTransition(false); setTransitionResult(null); } }}>
            <div style={transitionModal} onClick={(e) => e.stopPropagation()}>
              {transitionResult ? (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>Transition Complete</h3>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>{transitionResult.promoted} student{transitionResult.promoted !== 1 ? 's' : ''} promoted.</p>
                    <p style={{ color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>{transitionResult.graduated} 5th grader{transitionResult.graduated !== 1 ? 's' : ''} graduated.</p>
                    {transitionResult.archived > 0 && (
                      <p style={{ color: '#6b7280', fontSize: 13 }}>{transitionResult.archived} completed group{transitionResult.archived !== 1 ? 's' : ''} archived.</p>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={() => { setShowTransition(false); setTransitionResult(null); }} style={{ width: '100%' }}>Done</button>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Promote & Archive</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                    {transitionPreview.totalStudents - transitionPreview.graduateCount} student{transitionPreview.totalStudents - transitionPreview.graduateCount !== 1 ? 's' : ''} will be promoted, {transitionPreview.graduateCount} 5th grader{transitionPreview.graduateCount !== 1 ? 's' : ''} will be graduated.
                  </p>

                  {/* Grade promotion preview */}
                  <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Grade Promotions</p>
                    {GRADE_PROMOTIONS.map((p) => (
                      <div key={p.from} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                        <span style={{ color: '#374151' }}>{p.from === '5' ? 'Grade 5' : p.from === 'K' ? 'Kindergarten' : `Grade ${p.from}`}</span>
                        <span style={{ color: '#6b7280' }}>&rarr;</span>
                        <span style={{ fontWeight: 600, color: p.to === 'Graduated' ? '#f59e0b' : '#2A9D8F' }}>{p.to === 'Graduated' ? 'Graduated' : `Grade ${p.to}`}</span>
                      </div>
                    ))}
                  </div>

                  {/* Options */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
                    <input type="checkbox" checked={archiveGroups} onChange={(e) => setArchiveGroups(e.target.checked)} />
                    Archive completed groups
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
                    <input type="checkbox" checked={resetSessions} onChange={(e) => setResetSessions(e.target.checked)} />
                    Reset session counts (sessions have dates, so historical data is preserved)
                  </label>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" onClick={() => setShowTransition(false)} disabled={transitioning} style={{ flex: 1 }}>Cancel</button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, background: '#2A9D8F', borderColor: '#2A9D8F' }}
                      disabled={transitioning}
                      onClick={handleConfirmTransition}
                    >
                      {transitioning ? 'Promoting...' : 'Promote & Archive'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
                  localStorage.setItem('beacon_last_backup', new Date().toISOString());
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

        {/* Share Beacon */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitle}>Share Beacon with a colleague</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Know another counselor who could use this?
          </p>
          <textarea
            className="form-input"
            rows={4}
            value={editableShareMsg}
            onChange={(e) => setEditableShareMsg(e.target.value)}
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleCopyShare}>
              {shareCopied ? 'Copied!' : 'Copy Message'}
            </button>
            <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={handleEmailShare}>
              Email This
            </button>
          </div>
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
const transitionOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const transitionModal = { background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh', overflowY: 'auto' };
