import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TIME_DOMAINS } from '../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const DOMAIN_KEYS = Object.keys(TIME_DOMAINS);
const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];

/* ---- Compliance Ring (large) ---- */
function ComplianceRing({ percentage, size = 200, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = percentage >= 82 ? '#22c55e' : percentage >= 78 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#1a2332' }}>{percentage}%</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>YTD Counseling</div>
      </div>
    </div>
  );
}

/* ---- Entry Modal ---- */
function EntryModal({ open, onClose, counselorId, editEntry }) {
  const [date, setDate] = useState(editEntry?.entry_date || new Date().toISOString().slice(0, 10));
  const [domain, setDomain] = useState(editEntry?.domain || 'guidance');
  const [activity, setActivity] = useState(editEntry?.activity_description || '');
  const [duration, setDuration] = useState(editEntry?.duration_minutes?.toString() || '');
  const [notes, setNotes] = useState(editEntry?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editEntry) {
      setDate(editEntry.entry_date || new Date().toISOString().slice(0, 10));
      setDomain(editEntry.domain || 'guidance');
      setActivity(editEntry.activity_description || '');
      setDuration(editEntry.duration_minutes?.toString() || '');
      setNotes(editEntry.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setDomain('guidance');
      setActivity('');
      setDuration('');
      setNotes('');
    }
  }, [editEntry, open]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const row = {
      counselor_id: counselorId,
      entry_date: date,
      domain,
      activity_description: activity,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
    };
    if (editEntry) {
      await supabase.from('time_entries').update(row).eq('id', editEntry.id);
    } else {
      await supabase.from('time_entries').insert(row);
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={modalTitle}>{editEntry ? 'Edit Entry' : 'New Time Entry'}</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <input className="form-input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
          </div>
          <label className="form-label">Domain</label>
          <select className="form-input" value={domain} onChange={(e) => setDomain(e.target.value)} style={{ marginBottom: 10 }}>
            {Object.entries(TIME_DOMAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="form-label">Activity</label>
          <input className="form-input" value={activity} onChange={(e) => setActivity(e.target.value)} required placeholder="Brief description" style={{ marginBottom: 10 }} />
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Main ---- */
export default function TimeTrackerPage() {
  const { counselor } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayEntries, setDayEntries] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [ytdPct, setYtdPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const loadAll = useCallback(async () => {
    if (!counselor?.id) return;
    setLoading(true);
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const ws = format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const we = format(endOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const ms = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const me = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');

    const [dayRes, weekRes, monthRes, ytdRes] = await Promise.all([
      supabase.from('time_entries').select('*').eq('counselor_id', counselor.id).eq('entry_date', selectedDate).order('created_at'),
      supabase.from('time_entries').select('domain, duration_minutes').eq('counselor_id', counselor.id).gte('entry_date', ws).lte('entry_date', we),
      supabase.from('time_entries').select('domain, duration_minutes').eq('counselor_id', counselor.id).gte('entry_date', ms).lte('entry_date', me),
      supabase.from('time_entries').select('domain, duration_minutes').eq('counselor_id', counselor.id).gte('entry_date', yearStart),
    ]);

    setDayEntries(dayRes.data || []);

    // Aggregate weekly
    const wMap = {};
    (weekRes.data || []).forEach((e) => { wMap[e.domain] = (wMap[e.domain] || 0) + e.duration_minutes; });
    setWeeklyData(Object.entries(TIME_DOMAINS).map(([k, v]) => ({
      domain: v.replace('Individual ', 'Ind. ').replace(' Duties', ''),
      hours: Math.round(((wMap[k] || 0) / 60) * 10) / 10,
      fill: COUNSELING_DOMAINS.includes(k) ? '#2A9D8F' : '#94a3b8',
    })));

    // Aggregate monthly
    const mMap = {};
    (monthRes.data || []).forEach((e) => { mMap[e.domain] = (mMap[e.domain] || 0) + e.duration_minutes; });
    setMonthlyData(Object.entries(TIME_DOMAINS).map(([k, v]) => ({
      domain: v, minutes: mMap[k] || 0, hours: Math.round(((mMap[k] || 0) / 60) * 10) / 10,
    })));

    // YTD compliance
    const yMap = {};
    (ytdRes.data || []).forEach((e) => { yMap[e.domain] = (yMap[e.domain] || 0) + e.duration_minutes; });
    const totalMin = Object.values(yMap).reduce((a, b) => a + b, 0) || 1;
    const counselingMin = COUNSELING_DOMAINS.reduce((s, d) => s + (yMap[d] || 0), 0);
    setYtdPct(Math.round((counselingMin / totalMin) * 100));

    setLoading(false);
  }, [counselor, selectedDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const deleteEntry = async (entryId) => {
    if (!confirm('Delete this time entry?')) return;
    await supabase.from('time_entries').delete().eq('id', entryId);
    loadAll();
  };

  const dayTotal = dayEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Time Tracker</h1>
        <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowModal(true); }}>+ New Entry</button>
      </div>

      {/* Alert banner */}
      {ytdPct < 82 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>!</span>
          <span style={{ color: '#b91c1c', fontSize: 14 }}>
            Your YTD counseling percentage is <strong>{ytdPct}%</strong>, below the 80/20 compliance threshold of 82%.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* Day entries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <input className="form-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 180 }} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total: {dayTotal} min ({Math.round(dayTotal / 60 * 10) / 10} hrs)</span>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : dayEntries.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--text-muted)' }}>No entries for this date.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {dayEntries.map((e) => (
                <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1a2332', marginBottom: 2 }}>{e.activity_description}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {TIME_DOMAINS[e.domain] || e.domain} &middot; {e.duration_minutes} min
                    </div>
                    {e.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{e.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditEntry(e); setShowModal(true); }} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weekly summary chart */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginTop: 28, marginBottom: 12 }}>Weekly Summary</h2>
          <div className="card">
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={weeklyData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => `${v} hrs`} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={16}>
                    {weeklyData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly rollup */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginTop: 28, marginBottom: 12 }}>Monthly Totals</h2>
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>Domain</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((d) => (
                  <tr key={d.domain} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{d.domain}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{d.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>Export Monthly PDF</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>Export Annual PDF</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>Export CSV</button>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>Custom Date Range</button>
          </div>
        </div>

        {/* Right: Compliance ring */}
        <div className="card" style={{ textAlign: 'center', position: 'sticky', top: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            80/20 Compliance
          </h3>
          <ComplianceRing percentage={ytdPct} />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
            {ytdPct >= 82 ? 'You are in compliance.' : 'Below threshold. Increase counseling activities.'}
          </p>
        </div>
      </div>

      <EntryModal
        open={showModal}
        onClose={(saved) => { setShowModal(false); setEditEntry(null); if (saved) loadAll(); }}
        counselorId={counselor?.id}
        editEntry={editEntry}
      />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px' };
