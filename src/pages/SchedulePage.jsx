import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/db';
import { SESSION_STATUSES } from '../lib/constants';
import { startOfWeek, endOfWeek, addWeeks, format, parseISO, isToday } from 'date-fns';
import { startOfMonth, endOfMonth, addMonths, getDay, getDaysInMonth } from 'date-fns';
import { autoLogTime } from '../lib/autoLogTime';

const HOURS = Array.from({ length: 8 }, (_, i) => i + 8);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTH_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GROUP_COLORS = ['#2A9D8F', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function getColorForGroup(groupId, groups) {
  const idx = groups.findIndex((g) => g.id === groupId);
  return GROUP_COLORS[Math.max(0, idx) % GROUP_COLORS.length];
}

/** Check if two time ranges overlap. Times are "HH:MM" or "HH:MM:SS" strings. */
function timesOverlap(startA, endA, startB, endB) {
  const toMin = (t) => {
    const parts = (t || '00:00').split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };
  const a0 = toMin(startA), a1 = toMin(endA);
  const b0 = toMin(startB), b1 = toMin(endB);
  return a0 < b1 && b0 < a1;
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
    await db.update('sessions', session.id, { status, notes });

    // Feature #1 — Auto-log time on session complete
    if (status === 'Completed') {
      await autoLogTime({
        counselorId: session.counselor_id,
        sessionId: session.id,
        date: session.session_date,
        durationMinutes: session.duration_minutes || 30,
        description: group ? `Group counseling: ${group.name}` : 'Individual counseling session',
      });
    }

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

/* ---- Monthly View Component ---- */
function MonthlyView({ currentMonth, sessions, groups, onPrevMonth, onNextMonth, onToday }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const startDow = getDay(monthStart); // 0=Sun

  // Build array of week rows
  const cells = [];
  // Leading blanks
  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Map sessions by date string
  const sessionsByDate = {};
  (sessions || []).forEach((s) => {
    if (!sessionsByDate[s.session_date]) sessionsByDate[s.session_date] = [];
    sessionsByDate[s.session_date].push(s);
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Schedule</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-outline" onClick={onPrevMonth} style={{ padding: '6px 12px' }}>&larr;</button>
          <button className="btn" onClick={onToday} style={{ padding: '6px 14px', background: '#e6f7f5', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Today</button>
          <button className="btn btn-outline" onClick={onNextMonth} style={{ padding: '6px 12px' }}>&rarr;</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', marginLeft: 8 }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {MONTH_DAYS.map((d) => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} style={{ minHeight: 80, background: '#fafafa', borderLeft: di > 0 ? '1px solid var(--border)' : 'none' }} />;
              }
              const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), 'yyyy-MM-dd');
              const daySessions = sessionsByDate[dateStr] || [];
              const isTod = dateStr === todayStr;
              return (
                <div key={di} style={{
                  minHeight: 80, padding: 6,
                  borderLeft: di > 0 ? '1px solid var(--border)' : 'none',
                  background: isTod ? '#e6f7f5' : 'transparent',
                }}>
                  <div style={{ fontSize: 13, fontWeight: isTod ? 700 : 400, color: isTod ? '#2A9D8F' : '#374151', marginBottom: 4 }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {daySessions.map((sess) => {
                      const color = getColorForGroup(sess.group_id, groups);
                      return (
                        <div
                          key={sess.id}
                          title={`${groups.find((g) => g.id === sess.group_id)?.name || 'Session'} ${sess.start_time?.slice(0, 5) || ''}`}
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {groups.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Group Legend</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {groups.map((g) => {
              const color = getColorForGroup(g.id, groups);
              return (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ color: '#374151' }}>{g.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  const [scheduleBlocks, setScheduleBlocks] = useState([]);

  // Feature #10 — Monthly view state
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' | 'monthly'
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [monthlySessions, setMonthlySessions] = useState([]);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Load weekly data (sessions + groups + schedule blocks)
  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    const [sessRes, grpRes, blocksRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: from },
        lte: { session_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
      db.select('campus_schedule_blocks', { eq: { counselor_id: counselor.id } }),
    ]);
    setSessions(sessRes.data || []);
    setGroups(grpRes.data || []);
    setScheduleBlocks(blocksRes.data || []);
  }, [counselor, weekStart, weekEnd]);

  // Load monthly data
  const loadMonthlyData = useCallback(async () => {
    if (!counselor?.id) return;
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const [sessRes, grpRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: from },
        lte: { session_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
    ]);
    setMonthlySessions(sessRes.data || []);
    setGroups(grpRes.data || []);
  }, [counselor, currentMonth]);

  useEffect(() => {
    if (viewMode === 'weekly') {
      loadData();
    } else {
      loadMonthlyData();
    }
  }, [viewMode, loadData, loadMonthlyData]);

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((w) => addWeeks(w, -1));
  const goNext = () => setWeekStart((w) => addWeeks(w, 1));

  const goMonthToday = () => setCurrentMonth(startOfMonth(new Date()));
  const goPrevMonth = () => setCurrentMonth((m) => addMonths(m, -1));
  const goNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const sessionsForDay = (dayIndex) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    const ds = format(d, 'yyyy-MM-dd');
    return sessions.filter((s) => s.session_date === ds);
  };

  // Feature #5 — Get schedule blocks for a given day-of-week
  // dayIndex: 0=Mon, 1=Tue, ..., 4=Fri in our grid
  // campus_schedule_blocks.day_of_week: 0=Sun, 1=Mon, ..., 6=Sat
  const blocksForDay = (dayIndex) => {
    const dbDow = dayIndex + 1; // Mon=1, Tue=2, ... Fri=5
    return scheduleBlocks.filter((b) => b.day_of_week === dbDow);
  };

  // Check if a session overlaps any schedule block for its day
  const sessionHasConflict = (sess, dayIndex) => {
    const blocks = blocksForDay(dayIndex);
    return blocks.some((b) =>
      timesOverlap(sess.start_time, sess.end_time, b.start_time, b.end_time)
    );
  };

  const blockPos = (item) => {
    const sH = parseInt(item.start_time?.split(':')[0] || '8', 10);
    const sM = parseInt(item.start_time?.split(':')[1] || '0', 10);
    const eH = parseInt(item.end_time?.split(':')[0] || '9', 10);
    const eM = parseInt(item.end_time?.split(':')[1] || '0', 10);
    return { top: (sH - 8) * 60 + sM, height: Math.max((eH - sH) * 60 + (eM - sM), 25) };
  };

  const toggleView = () => {
    if (viewMode === 'weekly') {
      setCurrentMonth(startOfMonth(weekStart));
      setViewMode('monthly');
    } else {
      setWeekStart(startOfWeek(currentMonth, { weekStartsOn: 1 }));
      setViewMode('weekly');
    }
  };

  /* ---- Monthly View ---- */
  if (viewMode === 'monthly') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={toggleView} style={{ fontSize: 13, padding: '6px 14px' }}>
            Weekly View
          </button>
        </div>
        <MonthlyView
          currentMonth={currentMonth}
          sessions={monthlySessions}
          groups={groups}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onToday={goMonthToday}
        />
      </div>
    );
  }

  /* ---- Weekly View ---- */
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
          <button className="btn btn-outline" onClick={toggleView} style={{ marginLeft: 8, fontSize: 13, padding: '6px 14px' }}>
            Monthly View
          </button>
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

              {/* Feature #5 — Schedule blocks (rendered behind sessions) */}
              {blocksForDay(dayIdx).map((block) => {
                const pos = blockPos(block);
                return (
                  <div key={block.id} style={{
                    position: 'absolute', top: pos.top, left: 0, right: 0, height: pos.height,
                    background: '#f3f4f6', border: '1px dashed #d1d5db',
                    borderRadius: 4, opacity: 0.6, zIndex: 0,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    paddingTop: 2,
                  }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>
                      {block.block_name}
                    </span>
                  </div>
                );
              })}

              {/* Session blocks */}
              {sessionsForDay(dayIdx).map((sess) => {
                const pos = blockPos(sess);
                const grp = groups.find((g) => g.id === sess.group_id);
                const color = getColorForGroup(sess.group_id, groups);
                const hasConflict = sessionHasConflict(sess, dayIdx);
                return (
                  <div key={sess.id} onClick={() => setSelected(sess)} style={{
                    position: 'absolute', top: pos.top, left: 2, right: 2, height: pos.height,
                    background: color, color: '#fff', borderRadius: 6, padding: '4px 8px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', overflow: 'hidden',
                    opacity: sess.status === 'Cancelled' ? 0.5 : 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    zIndex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasConflict && (
                        <span title="Scheduling conflict" style={{ color: '#f97316', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                          &#9888;
                        </span>
                      )}
                      <span>{grp?.name || 'Session'}</span>
                    </div>
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
