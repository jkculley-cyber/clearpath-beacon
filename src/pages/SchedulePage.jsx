import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'duty', label: 'Duty' },
  { value: 'planning', label: 'Planning' },
  { value: 'training', label: 'Training / PD' },
  { value: 'ard', label: 'ARD' },
  { value: '504', label: '504' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
];
const EVENT_COLOR = '#475569'; // slate — distinct from group colors

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
  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session) {
      setStatus(session.status || 'Scheduled');
      setNotes(session.notes || '');
      setSessionDate(session.session_date || '');
      setStartTime((session.start_time || '').slice(0, 5));
      setDuration(session.duration_minutes ?? 30);
    }
  }, [session]);

  if (!session) return null;
  const group = groups.find((g) => g.id === session.group_id);

  const computeEnd = (start, dur) => {
    if (!start) return null;
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + Number(dur || 0);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    setSaving(true);
    const end = computeEnd(startTime, duration);
    await db.update('sessions', session.id, {
      status,
      notes,
      session_date: sessionDate || session.session_date,
      start_time: startTime || null,
      end_time: end,
      duration_minutes: Number(duration),
    });

    if (status === 'Completed') {
      await autoLogTime({
        counselorId: session.counselor_id,
        sessionId: session.id,
        date: sessionDate || session.session_date,
        durationMinutes: Number(duration) || 30,
        description: group ? `Group counseling: ${group.name}` : 'Individual counseling session',
      });
    }

    setSaving(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(true);
    await db.del('sessions', session.id);
    setDeleting(false);
    onSave();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>
          {group?.name || 'Session'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>Date</label>
            <input className="form-input" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Start Time</label>
            <input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Duration (min)</label>
            <input className="form-input" type="number" min="5" max="480" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)} />
          </div>
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
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #fecaca',
              background: '#fff', color: '#b91c1c', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {deleting ? '...' : 'Delete'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Monthly View Component ---- */
function MonthlyView({ currentMonth, sessions, events, groups, onPrevMonth, onNextMonth, onToday, onEventClick }) {
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

  // Map events by date string
  const eventsByDate = {};
  (events || []).forEach((e) => {
    if (!eventsByDate[e.event_date]) eventsByDate[e.event_date] = [];
    eventsByDate[e.event_date].push(e);
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
              const dayEvents = eventsByDate[dateStr] || [];
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
                    {dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(evt); }}
                        title={`${evt.title} ${evt.start_time?.slice(0, 5) || ''}`}
                        style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: EVENT_COLOR,
                          flexShrink: 0,
                          cursor: onEventClick ? 'pointer' : 'default',
                        }}
                      />
                    ))}
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

/* ---- Add Session / Event Modal ---- */
function AddSessionModal({ open, onClose, counselorId }) {
  const [kind, setKind] = useState('individual'); // individual | group | event
  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('meeting');
  const [sessionDate, setSessionDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [students, setStudents] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !counselorId) return;
    setKind('individual');
    setStudentId('');
    setGroupId('');
    setEventTitle('');
    setEventType('meeting');
    setSessionDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setDuration(30);
    setNotes('');
    setSaving(false);
    Promise.all([
      db.select('students', { eq: { counselor_id: counselorId, status: 'active' }, order: { column: 'first_name', ascending: true } }),
      db.select('groups', { eq: { counselor_id: counselorId, status: 'active' }, order: { column: 'name', ascending: true } }),
    ]).then(([sRes, gRes]) => {
      setStudents(sRes.data || []);
      setGroupList(gRes.data || []);
    });
  }, [open, counselorId]);

  if (!open) return null;

  const computeEndTime = (start, dur) => {
    const [h, m] = start.split(':').map(Number);
    const totalMin = h * 60 + m + dur;
    const eH = Math.floor(totalMin / 60);
    const eM = totalMin % 60;
    return `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const endTime = computeEndTime(startTime, duration);

    let err;
    if (kind === 'event') {
      const record = {
        counselor_id: counselorId,
        title: eventTitle.trim() || EVENT_TYPES.find((t) => t.value === eventType)?.label || 'Event',
        event_type: eventType,
        event_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        notes: notes || null,
      };
      ({ error: err } = await db.insert('schedule_events', record));
    } else {
      const record = {
        counselor_id: counselorId,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        status: 'Scheduled',
        notes: notes || null,
        session_type: kind,
        student_id: kind === 'individual' ? (studentId || null) : null,
        group_id: kind === 'group' ? (groupId || null) : null,
      };
      ({ error: err } = await db.insert('sessions', record));
    }

    if (err) {
      alert(err.message || String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <div style={overlay} onClick={() => onClose(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>
          Add to Schedule
        </h3>
        <form onSubmit={handleSave}>
          <label style={lbl}>Type</label>
          <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="individual">Individual session</option>
            <option value="group">Group session</option>
            <option value="event">Other event (meeting, duty, etc.)</option>
          </select>

          {kind === 'individual' && (
            <>
              <label style={lbl}>Student</label>
              <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">-- Select student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name || ''}
                  </option>
                ))}
              </select>
            </>
          )}

          {kind === 'group' && (
            <>
              <label style={lbl}>Group</label>
              <select className="form-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">-- Select group --</option>
                {groupList.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </>
          )}

          {kind === 'event' && (
            <>
              <label style={lbl}>Title *</label>
              <input
                className="form-input"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g., Faculty meeting, Bus duty, ARD for J. Smith"
                required
                autoFocus
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Shows up on your calendar — make it descriptive.
              </div>

              <label style={lbl}>Event Type</label>
              <select className="form-input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </>
          )}

          <label style={lbl}>Date</label>
          <input className="form-input" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />

          <label style={lbl}>Start Time</label>
          <input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />

          <label style={lbl}>Duration (minutes)</label>
          <input className="form-input" type="number" min="5" max="480" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 30)} required />

          <label style={lbl}>Notes</label>
          <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose(false)} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Event Detail Modal (non-counseling events) ---- */
function EventDetailModal({ event, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('meeting');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setEventType(event.event_type || 'meeting');
      setEventDate(event.event_date || '');
      setStartTime((event.start_time || '').slice(0, 5));
      setDuration(event.duration_minutes ?? 30);
      setNotes(event.notes || '');
    }
  }, [event]);

  if (!event) return null;

  const computeEnd = (start, dur) => {
    if (!start) return null;
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + Number(dur || 0);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    setSaving(true);
    await db.update('schedule_events', event.id, {
      title: title.trim() || 'Event',
      event_type: eventType,
      event_date: eventDate || event.event_date,
      start_time: startTime || null,
      end_time: computeEnd(startTime, duration),
      duration_minutes: Number(duration),
      notes: notes || null,
    });
    setSaving(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    setDeleting(true);
    await db.del('schedule_events', event.id);
    setDeleting(false);
    onSave();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: '0 0 16px' }}>Edit Event</h3>

        <label style={lbl}>Title *</label>
        <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label style={lbl}>Event Type</label>
        <select className="form-input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>Date</label>
            <input className="form-input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Start Time</label>
            <input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Duration (min)</label>
            <input className="form-input" type="number" min="5" max="480" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>

        <label style={lbl}>Notes</label>
        <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Close</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #fecaca',
              background: '#fff', color: '#b91c1c', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {deleting ? '...' : 'Delete'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Agenda View Component (search + chronological list) ---- */
function AgendaView({ sessions, events, groups, students, range, onSessionClick, onEventClick }) {
  const [query, setQuery] = useState('');

  const groupMap = {};
  groups.forEach((g) => { groupMap[g.id] = g; });
  const studentMap = {};
  students.forEach((s) => { studentMap[s.id] = s; });

  const sName = (s) => s
    ? (s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || ''))
    : '';

  // Combine sessions + events into a single sortable agenda
  const items = [];
  for (const s of sessions || []) {
    const stu = studentMap[s.student_id];
    const grp = groupMap[s.group_id];
    const label = s.session_type === 'group' && grp
      ? grp.name
      : (stu ? sName(stu) : 'Session');
    items.push({
      kind: 'session',
      id: s.id,
      date: s.session_date,
      time: s.start_time || '',
      duration: s.duration_minutes || 0,
      label,
      typeLabel: s.session_type === 'group' ? 'Group' : 'Individual',
      notes: s.notes || '',
      status: s.status || '',
      raw: s,
      _haystack: [label, s.session_type, s.notes, s.status].filter(Boolean).join(' ').toLowerCase(),
    });
  }
  for (const e of events || []) {
    const typeLabel = EVENT_TYPES.find((t) => t.value === e.event_type)?.label || e.event_type;
    items.push({
      kind: 'event',
      id: e.id,
      date: e.event_date,
      time: e.start_time || '',
      duration: e.duration_minutes || 0,
      label: e.title || typeLabel,
      typeLabel,
      notes: e.notes || '',
      status: '',
      raw: e,
      _haystack: [e.title, typeLabel, e.event_type, e.notes].filter(Boolean).join(' ').toLowerCase(),
    });
  }

  // Apply date-range filter
  const today = format(new Date(), 'yyyy-MM-dd');
  const past30 = format(addWeeks(new Date(), -4), 'yyyy-MM-dd');
  const upcoming90 = format(addWeeks(new Date(), 13), 'yyyy-MM-dd');
  const filteredByRange = items.filter((it) => {
    if (!it.date) return false;
    if (range === 'past') return it.date >= past30 && it.date < today;
    if (range === 'upcoming') return it.date >= today && it.date <= upcoming90;
    return true; // 'all'
  });

  // Apply search
  const q = query.trim().toLowerCase();
  const filtered = q
    ? filteredByRange.filter((it) => it._haystack.includes(q))
    : filteredByRange;

  // Sort: chronological. Upcoming = ascending, past = descending (most recent first), all = ascending.
  filtered.sort((a, b) => {
    const cmp = (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time);
    return range === 'past' ? -cmp : cmp;
  });

  // Group by date for sticky-style dividers
  const byDate = [];
  let currentDate = null;
  for (const it of filtered) {
    if (it.date !== currentDate) {
      byDate.push({ kind: 'header', date: it.date });
      currentDate = it.date;
    }
    byDate.push(it);
  }

  const handleClick = (it) => {
    if (it.kind === 'session') onSessionClick(it.raw);
    else onEventClick(it.raw);
  };

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions, events, students, notes..."
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {query && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            {filtered.length} match{filtered.length === 1 ? '' : 'es'} for "{query}"
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
          {query ? 'No matches.' : 'Nothing on the schedule for this range.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {byDate.map((row, i) => {
            if (row.kind === 'header') {
              const d = parseISO(row.date);
              const isTodayRow = row.date === today;
              return (
                <div key={`h-${row.date}-${i}`} style={{
                  padding: '8px 16px',
                  background: isTodayRow ? '#e6f7f5' : '#f9fafb',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: isTodayRow ? '#2A9D8F' : '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {format(d, 'EEEE, MMM d, yyyy')}{isTodayRow ? ' · Today' : ''}
                </div>
              );
            }
            const isEvent = row.kind === 'event';
            const groupColor = !isEvent
              ? getColorForGroup(row.raw.group_id, groups)
              : EVENT_COLOR;
            return (
              <div
                key={row.id}
                onClick={() => handleClick(row)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr auto',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  alignItems: 'center',
                  background: '#fff',
                  borderLeft: `4px solid ${groupColor}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  {row.time ? row.time.slice(0, 5) : '—'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2332' }}>
                    {row.label}
                  </div>
                  {row.notes && (
                    <div style={{
                      fontSize: 12, color: '#6b7280', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 10,
                    background: isEvent ? '#475569' : '#e5e7eb',
                    color: isEvent ? '#fff' : '#374151',
                  }}>
                    {row.typeLabel}
                  </span>
                  {row.duration ? (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{row.duration}m</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---- Main Page ---- */
export default function SchedulePage() {
  const { counselor } = useAuth();
  const [searchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => {
    const q = searchParams.get('date');
    const seed = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? parseISO(q) : new Date();
    return startOfWeek(seed, { weekStartsOn: 1 });
  });
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [monthlyEvents, setMonthlyEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [showAddSession, setShowAddSession] = useState(false);

  // Feature #10 — Monthly view state
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' | 'monthly' | 'agenda'
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [monthlySessions, setMonthlySessions] = useState([]);

  // Agenda view state
  const [agendaSessions, setAgendaSessions] = useState([]);
  const [agendaEvents, setAgendaEvents] = useState([]);
  const [agendaStudents, setAgendaStudents] = useState([]);
  const [agendaRange, setAgendaRange] = useState('upcoming'); // 'past' | 'upcoming' | 'all'

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Load weekly data (sessions + events + groups + schedule blocks)
  const loadData = useCallback(async () => {
    if (!counselor?.id) return;
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    const [sessRes, evtRes, grpRes, blocksRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: from },
        lte: { session_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('schedule_events', {
        eq: { counselor_id: counselor.id },
        gte: { event_date: from },
        lte: { event_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
      db.select('campus_schedule_blocks', { eq: { counselor_id: counselor.id } }),
    ]);
    setSessions(sessRes.data || []);
    setEvents(evtRes.data || []);
    setGroups(grpRes.data || []);
    setScheduleBlocks(blocksRes.data || []);
  }, [counselor, weekStart, weekEnd]);

  // Load monthly data
  const loadMonthlyData = useCallback(async () => {
    if (!counselor?.id) return;
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const [sessRes, evtRes, grpRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        gte: { session_date: from },
        lte: { session_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('schedule_events', {
        eq: { counselor_id: counselor.id },
        gte: { event_date: from },
        lte: { event_date: to },
        order: { column: 'start_time', ascending: true },
      }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
    ]);
    setMonthlySessions(sessRes.data || []);
    setMonthlyEvents(evtRes.data || []);
    setGroups(grpRes.data || []);
  }, [counselor, currentMonth]);

  // Load agenda data — wide window so search can find anything
  const loadAgendaData = useCallback(async () => {
    if (!counselor?.id) return;
    const [sessRes, evtRes, grpRes, stuRes] = await Promise.all([
      db.select('sessions', {
        eq: { counselor_id: counselor.id },
        order: { column: 'session_date', ascending: false },
      }),
      db.select('schedule_events', {
        eq: { counselor_id: counselor.id },
        order: { column: 'event_date', ascending: false },
      }),
      db.select('groups', { eq: { counselor_id: counselor.id } }),
      db.select('students', { eq: { counselor_id: counselor.id } }),
    ]);
    setAgendaSessions(sessRes.data || []);
    setAgendaEvents(evtRes.data || []);
    setGroups(grpRes.data || []);
    setAgendaStudents(stuRes.data || []);
  }, [counselor]);

  useEffect(() => {
    if (viewMode === 'weekly') loadData();
    else if (viewMode === 'monthly') loadMonthlyData();
    else if (viewMode === 'agenda') loadAgendaData();
  }, [viewMode, loadData, loadMonthlyData, loadAgendaData]);

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

  const eventsForDay = (dayIndex) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    const ds = format(d, 'yyyy-MM-dd');
    return events.filter((e) => e.event_date === ds);
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

  const switchView = (mode) => {
    if (mode === viewMode) return;
    if (mode === 'weekly' && viewMode === 'monthly') {
      setWeekStart(startOfWeek(currentMonth, { weekStartsOn: 1 }));
    } else if (mode === 'monthly' && viewMode === 'weekly') {
      setCurrentMonth(startOfMonth(weekStart));
    }
    setViewMode(mode);
  };

  const ViewSwitcher = () => (
    <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #d1d5db', overflow: 'hidden' }}>
      {[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['agenda', 'Agenda']].map(([m, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => switchView(m)}
          style={{
            padding: '6px 14px', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: viewMode === m ? '#2A9D8F' : '#fff',
            color: viewMode === m ? '#fff' : '#6b7280',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  /* ---- Agenda View ---- */
  if (viewMode === 'agenda') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Schedule</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={agendaRange}
              onChange={(e) => setAgendaRange(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
                fontSize: 13, color: '#374151', background: '#fff',
              }}
            >
              <option value="upcoming">Upcoming (next 90 days)</option>
              <option value="past">Past 30 days</option>
              <option value="all">All time</option>
            </select>
            <ViewSwitcher />
            <button
              onClick={() => setShowAddSession(true)}
              style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2A9D8F', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              + Add Session
            </button>
          </div>
        </div>

        <AgendaView
          sessions={agendaSessions}
          events={agendaEvents}
          groups={groups}
          students={agendaStudents}
          range={agendaRange}
          onSessionClick={setSelected}
          onEventClick={setSelectedEvent}
        />

        <SessionDetailModal
          session={selected}
          groups={groups}
          onClose={() => setSelected(null)}
          onSave={() => { setSelected(null); loadAgendaData(); }}
        />
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={() => { setSelectedEvent(null); loadAgendaData(); }}
        />
        <AddSessionModal
          open={showAddSession}
          onClose={(saved) => { setShowAddSession(false); if (saved) loadAgendaData(); }}
          counselorId={counselor?.id}
        />
      </div>
    );
  }

  /* ---- Monthly View ---- */
  if (viewMode === 'monthly') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
          <button
            onClick={() => setShowAddSession(true)}
            style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2A9D8F', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            + Add Session
          </button>
          <ViewSwitcher />
        </div>
        <MonthlyView
          currentMonth={currentMonth}
          sessions={monthlySessions}
          events={monthlyEvents}
          groups={groups}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onToday={goMonthToday}
          onEventClick={setSelectedEvent}
        />
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={() => { setSelectedEvent(null); loadMonthlyData(); }}
        />
        <AddSessionModal
          open={showAddSession}
          onClose={(saved) => { setShowAddSession(false); if (saved) loadMonthlyData(); }}
          counselorId={counselor?.id}
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
          <span style={{ marginLeft: 8 }}>
            <ViewSwitcher />
          </span>
          <button
            onClick={() => setShowAddSession(true)}
            style={{ marginLeft: 4, padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2A9D8F', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            + Add Session
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

              {/* Non-counseling events */}
              {eventsForDay(dayIdx).map((evt) => {
                const pos = blockPos({ start_time: evt.start_time, end_time: evt.end_time || (evt.start_time && evt.duration_minutes
                  ? (() => {
                      const [h, m] = evt.start_time.split(':').map(Number);
                      const t = h * 60 + m + (evt.duration_minutes || 0);
                      return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
                    })()
                  : null) });
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    title={`${evt.title} (${evt.event_type})`}
                    style={{
                      position: 'absolute', top: pos.top, left: 2, right: 2, height: pos.height,
                      background: EVENT_COLOR, color: '#fff', borderRadius: 6, padding: '4px 8px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '3px solid #1e293b',
                      zIndex: 1,
                    }}
                  >
                    <div>{evt.title}</div>
                    {pos.height > 35 && (
                      <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>
                        {evt.start_time?.slice(0, 5)}
                        {evt.end_time ? ` - ${evt.end_time.slice(0, 5)}` : ''}
                      </div>
                    )}
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

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSave={() => { setSelectedEvent(null); loadData(); }}
      />

      <AddSessionModal
        open={showAddSession}
        onClose={(saved) => { setShowAddSession(false); if (saved) loadData(); }}
        counselorId={counselor?.id}
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
