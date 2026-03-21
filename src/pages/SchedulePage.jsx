import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SESSION_STATUSES } from '../lib/constants';
import { startOfWeek, endOfWeek, addWeeks, format, parseISO, isToday } from 'date-fns';

const HOURS = Array.from({ length: 8 }, (_, i) => i + 8);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const GROUP_COLORS = ['#2A9D8F', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function getColorForGroup(groupId, groups) {
  const idx = groups.findIndex((g) => g.id === groupId);
  return GROUP_COLORS[Math.max(0, idx) % GROUP_COLORS.length];
}

/* ---- Session Detail Modal ---- */
function SessionDetailModal({ session, groups, onClose, onSave }) {
  const [status, setStatus] = useState('Scheduled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) {
      setStatus(session.status || 'Scheduled');
      setNotes(session.notes || '');
    }
  }, [session]);

  if (!session) return null;
  const group = groups.find((g) => g.id === session.group_id);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('sessions').update({ status, notes }).eq('id', session.id);
    setSaving(false);
    onSave();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>
          {group?.name || 'Session'}
        </h3>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          {format(parseISO(session.session_date), 'EEEE, MMMM d')} &middot;{' '}
          {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
        </div>

        <label style={lbl}>Status</label>
        <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {SESSION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label style={lbl}>Notes</label>
        <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Close</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Main Page ---- */
export default function SchedulePage() {
  const { counselor } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    const [sessRes, grpRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .eq('counselor_id', counselor.id)
        .gte('session_date', from)
        .lte('session_date', to)
        .order('start_time'),
      supabase.from('groups').select('id, name').eq('counselor_id', counselor.id),
    ]);
    setSessions(sessRes.data || []);
    setGroups(grpRes.data || []);
  }, [counselor, weekStart, weekEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((w) => addWeeks(w, -1));
  const goNext = () => setWeekStart((w) => addWeeks(w, 1));

  const sessionsForDay = (dayIndex) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    const ds = format(d, 'yyyy-MM-dd');
    return sessions.filter((s) => s.session_date === ds);
  };

  const blockPos = (sess) => {
    const sH = parseInt(sess.start_time?.split(':')[0] || '8', 10);
    const sM = parseInt(sess.start_time?.split(':')[1] || '0', 10);
    const eH = parseInt(sess.end_time?.split(':')[0] || '9', 10);
    const eM = parseInt(sess.end_time?.split(':')[1] || '0', 10);
    return { top: (sH - 8) * 60 + sM, height: Math.max((eH - sH) * 60 + (eM - sM), 25) };
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Schedule</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-outline" onClick={goPrev} style={{ padding: '6px 12px' }}>&larr;</button>
          <button className="btn" onClick={goToday} style={{ padding: '6px 14px', background: '#e6f7f5', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Today</button>
          <button className="btn btn-outline" onClick={goNext} style={{ padding: '6px 12px' }}>&rarr;</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', marginLeft: 8 }}>
            {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', borderBottom: '1px solid var(--border)' }}>
          <div />
          {DAYS.map((day, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const tod = isToday(d);
            return (
              <div key={day} style={{
                padding: '10px 0', textAlign: 'center', borderLeft: '1px solid var(--border)',
                background: tod ? '#e6f7f5' : 'transparent', color: tod ? 'var(--teal)' : '#374151',
              }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase' }}>{DAY_SHORT[i]}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)' }}>
          {/* Time labels */}
          <div>
            {HOURS.map((h) => (
              <div key={h} style={{ height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, fontSize: 11, color: '#9ca3af' }}>
                {h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((_, dayIdx) => (
            <div key={dayIdx} style={{ position: 'relative', borderLeft: '1px solid var(--border)' }}>
              {HOURS.map((h) => <div key={h} style={{ height: 60, borderBottom: '1px solid #f3f4f6' }} />)}
              {sessionsForDay(dayIdx).map((sess) => {
                const pos = blockPos(sess);
                const grp = groups.find((g) => g.id === sess.group_id);
                const color = getColorForGroup(sess.group_id, groups);
                return (
                  <div key={sess.id} onClick={() => setSelected(sess)} style={{
                    position: 'absolute', top: pos.top, left: 2, right: 2, height: pos.height,
                    background: color, color: '#fff', borderRadius: 6, padding: '4px 8px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', overflow: 'hidden',
                    opacity: sess.status === 'Cancelled' ? 0.5 : 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}>
                    <div>{grp?.name || 'Session'}</div>
                    {pos.height > 35 && (
                      <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.9 }}>
                        {sess.start_time?.slice(0, 5)} - {sess.end_time?.slice(0, 5)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <SessionDetailModal
        session={selected}
        groups={groups}
        onClose={() => setSelected(null)}
        onSave={() => { setSelected(null); loadData(); }}
      />
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: 28, width: 440,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 12, marginBottom: 4 };
