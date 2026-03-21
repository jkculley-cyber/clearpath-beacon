import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { URGENCY_LEVELS } from '../lib/constants';

const urgencyColor = { Urgent: '#ef4444', Soon: '#f59e0b', Routine: '#6b7280' };

function AcceptModal({ open, onClose, referral, counselorId }) {
  const [mode, setMode] = useState('individual');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('groups').select('id, name').eq('counselor_id', counselorId).eq('status', 'active').then(({ data }) => setGroups(data || []));
    }
  }, [open, counselorId]);

  if (!open || !referral) return null;

  const handleAccept = async () => {
    setSaving(true);

    // Create student record
    const { data: student } = await supabase.from('students').insert({
      counselor_id: counselorId,
      first_name: referral.student_name?.split(' ')[0] || referral.student_name,
      last_name: referral.student_name?.split(' ').slice(1).join(' ') || '',
      grade: referral.grade,
      teacher: referral.teacher_name,
      referral_source: referral.concern_type,
      tier: referral.urgency === 'Urgent' ? 3 : referral.urgency === 'Soon' ? 2 : 1,
      status: 'active',
    }).select().single();

    // Link to group if selected
    if (mode === 'group' && selectedGroup && student) {
      await supabase.from('group_members').insert({ group_id: selectedGroup, student_id: student.id });
    }

    // Update referral status
    await supabase.from('referrals').update({
      status: 'closed',
      resolution: mode === 'group' ? `Added to group` : 'Individual services',
      resolved_at: new Date().toISOString(),
    }).eq('id', referral.id);

    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>Accept Referral</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          Student: <strong>{referral.student_name}</strong> &middot; {referral.concern_type}
        </p>

        <label className="form-label">Assign To</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button type="button"
            className={mode === 'individual' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('individual')} style={{ flex: 1 }}>
            Individual Services
          </button>
          <button type="button"
            className={mode === 'group' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setMode('group')} style={{ flex: 1 }}>
            Existing Group
          </button>
        </div>

        {mode === 'group' && (
          <>
            <label className="form-label">Select Group</label>
            <select className="form-input" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">Choose a group...</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={saving || (mode === 'group' && !selectedGroup)} style={{ flex: 1 }}>
            {saving ? 'Processing...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const { counselor } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptRef, setAcceptRef] = useState(null);

  const loadReferrals = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('counselor_id', counselor.id)
      .order('created_at', { ascending: false });
    setReferrals(data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const openRefs = referrals.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const closedRefs = referrals.filter((r) => r.status === 'closed' || r.status === 'deferred');

  // Sort open referrals by urgency
  const urgencyOrder = { Urgent: 0, Soon: 1, Routine: 2 };
  openRefs.sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));

  const daysOpen = (ref) => {
    const created = new Date(ref.created_at);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  };

  const handleDefer = async (ref) => {
    await supabase.from('referrals').update({ status: 'deferred', resolved_at: new Date().toISOString() }).eq('id', ref.id);
    loadReferrals();
  };

  const handleClose = async (ref) => {
    await supabase.from('referrals').update({ status: 'closed', resolution: 'Closed without action', resolved_at: new Date().toISOString() }).eq('id', ref.id);
    loadReferrals();
  };

  return (
    <div className="page">
      <h1 className="page-title">Referrals</h1>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          {/* Open Queue */}
          <h2 style={sectionTitle}>Open Referrals ({openRefs.length})</h2>
          {openRefs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--text-muted)' }}>No pending referrals. Nice work!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
              {openRefs.map((r) => (
                <div key={r.id} className="card" style={{ borderLeft: `4px solid ${urgencyColor[r.urgency] || '#6b7280'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1a2332', fontSize: 16 }}>{r.student_name}</span>
                      <span style={{
                        marginLeft: 10, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: (urgencyColor[r.urgency] || '#6b7280') + '20',
                        color: urgencyColor[r.urgency] || '#6b7280',
                      }}>{r.urgency}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{daysOpen(r)} day{daysOpen(r) !== 1 ? 's' : ''} open</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                    <span>{r.concern_type}</span>
                    {r.teacher_name && <span> &middot; From: {r.teacher_name}</span>}
                    {r.created_at && <span> &middot; {r.created_at.slice(0, 10)}</span>}
                  </div>
                  {r.notes && <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 10px' }}>{r.notes}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => setAcceptRef(r)}>Accept</button>
                    <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => handleDefer(r)}>Defer</button>
                    <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: 13, color: '#9ca3af' }} onClick={() => handleClose(r)}>Close</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          <h2 style={sectionTitle}>History</h2>
          {closedRefs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No closed referrals.</p>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Concern</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Resolution</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRefs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{r.student_name}</td>
                      <td style={tdStyle}>{r.concern_type}</td>
                      <td style={tdStyle}><span style={{ textTransform: 'capitalize' }}>{r.status}</span></td>
                      <td style={tdStyle}>{r.resolution || '--'}</td>
                      <td style={tdStyle}>{r.resolved_at?.slice(0, 10) || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AcceptModal
        open={!!acceptRef}
        onClose={(done) => { setAcceptRef(null); if (done) loadReferrals(); }}
        referral={acceptRef}
        counselorId={counselor?.id}
      />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' };
const sectionTitle = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px' };
