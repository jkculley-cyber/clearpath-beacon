import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ASCA_DOMAINS, ROTATION_TYPES } from '../lib/constants';

function NewGroupModal({ open, onClose, counselorId, onCreated }) {
  const [name, setName] = useState('');
  const [gradeBand, setGradeBand] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [rotationType, setRotationType] = useState('weekly_abc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [obj1, setObj1] = useState('');
  const [obj1Domain, setObj1Domain] = useState('Social-Emotional');
  const [obj2, setObj2] = useState('');
  const [obj2Domain, setObj2Domain] = useState('Academic');
  const [obj3, setObj3] = useState('');
  const [obj3Domain, setObj3Domain] = useState('Career');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({
        counselor_id: counselorId,
        name,
        grade_band: gradeBand,
        focus_area: focusArea,
        rotation_type: rotationType,
        start_date: startDate || null,
        end_date: endDate || null,
        status: 'active',
      })
      .select()
      .single();

    if (gErr) {
      setError(gErr.message);
      setSaving(false);
      return;
    }

    // Insert objectives
    const objectives = [
      { group_id: group.id, description: obj1, asca_domain: obj1Domain, sort_order: 1 },
      { group_id: group.id, description: obj2, asca_domain: obj2Domain, sort_order: 2 },
      { group_id: group.id, description: obj3, asca_domain: obj3Domain, sort_order: 3 },
    ].filter((o) => o.description.trim());

    if (objectives.length) {
      await supabase.from('group_objectives').insert(objectives);
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>New Group</h3>
        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="form-label">Group Name *</label>
          <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friendship Skills" style={{ marginBottom: 10 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Grade Band</label>
              <input className="form-input" value={gradeBand} onChange={(e) => setGradeBand(e.target.value)} placeholder="e.g. K-2" />
            </div>
            <div>
              <label className="form-label">Focus Area</label>
              <input className="form-input" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="e.g. Social Skills" />
            </div>
          </div>

          <label className="form-label">Rotation Type</label>
          <select className="form-input" value={rotationType} onChange={(e) => setRotationType(e.target.value)} style={{ marginBottom: 10 }}>
            {Object.entries(ROTATION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 10 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Objectives</label>
            {[
              { val: obj1, set: setObj1, dom: obj1Domain, setDom: setObj1Domain, n: 1 },
              { val: obj2, set: setObj2, dom: obj2Domain, setDom: setObj2Domain, n: 2 },
              { val: obj3, set: setObj3, dom: obj3Domain, setDom: setObj3Domain, n: 3 },
            ].map((o) => (
              <div key={o.n} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="form-input" style={{ flex: 1 }} value={o.val} onChange={(e) => o.set(e.target.value)} placeholder={`Objective ${o.n}`} />
                <select className="form-input" style={{ width: 140 }} value={o.dom} onChange={(e) => o.setDom(e.target.value)}>
                  {ASCA_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const { counselor } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('groups')
      .select('*, group_members(id)')
      .eq('counselor_id', counselor.id)
      .order('created_at', { ascending: false });
    setGroups(data || []);
    setLoading(false);
  }, [counselor]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const statusColor = (s) => s === 'active' ? '#22c55e' : '#9ca3af';

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Groups</h1>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Group</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>No groups yet. Create your first group to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {groups.map((g) => (
            <div
              key={g.id}
              className="card"
              onClick={() => navigate(`/groups/${g.id}`)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'box-shadow 0.15s' }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2332', marginBottom: 4 }}>{g.name}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                  {g.grade_band && <span>Grades: {g.grade_band}</span>}
                  {g.focus_area && <span>Focus: {g.focus_area}</span>}
                  <span>Rotation: {ROTATION_TYPES[g.rotation_type] || g.rotation_type}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2332' }}>{g.group_members?.length || 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Members</div>
                </div>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                  fontSize: 12, fontWeight: 600, background: statusColor(g.status) + '20', color: statusColor(g.status),
                }}>
                  {g.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewGroupModal
        open={showNew}
        onClose={() => setShowNew(false)}
        counselorId={counselor?.id}
        onCreated={() => { setShowNew(false); loadGroups(); }}
      />
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};
