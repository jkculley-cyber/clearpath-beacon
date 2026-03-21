import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';

const STEPS = [
  { key: 'student', label: 'Add your first student', path: '/students', icon: '👤', tip: 'Start with 3-5 students you see most often.' },
  { key: 'group', label: 'Create a counseling group', path: '/groups', icon: '👥', tip: 'Friendship, grief, anger management — whatever you run.' },
  { key: 'session', label: 'Log your first session', path: '/students', icon: '📝', tip: 'Open a student → Log Session. Takes 30 seconds.' },
  { key: 'time', label: 'Log a time entry', path: '/time-tracker', icon: '⏱', tip: 'This powers your 80/20 compliance gauge.' },
  { key: 'backup', label: 'Set up a backup reminder', path: '/settings', icon: '💾', tip: 'Your data lives on this device — protect it.' },
];

const STORAGE_KEY = 'beacon_onboarding_dismissed';

export default function OnboardingChecklist({ counselorId }) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState({});
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!counselorId || dismissed) { setLoading(false); return; }

    (async () => {
      const [students, groups, sessions, timeEntries] = await Promise.all([
        db.count('students', { counselor_id: counselorId }),
        db.count('groups', { counselor_id: counselorId }),
        db.select('sessions', { eq: { counselor_id: counselorId }, limit: 1 }),
        db.select('time_entries', { eq: { counselor_id: counselorId }, limit: 1 }),
      ]);

      const lastBackup = localStorage.getItem('beacon_last_backup');

      setCompleted({
        student: (students.count || 0) > 0,
        group: (groups.count || 0) > 0,
        session: (sessions.data || []).length > 0,
        time: (timeEntries.data || []).length > 0,
        backup: !!lastBackup,
      });
      setLoading(false);
    })();
  }, [counselorId, dismissed]);

  if (dismissed || loading) return null;

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = completedCount === STEPS.length;

  // Auto-dismiss when all steps complete
  if (allDone) {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', marginBottom: 4 }}>You're all set!</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Beacon is ready to work for you. You can dismiss this card.</div>
          <button
            onClick={() => { localStorage.setItem(STORAGE_KEY, 'true'); setDismissed(true); }}
            style={styles.dismissBtn}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Getting Started</h2>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{completedCount} of {STEPS.length} complete</div>
        </div>
        <button
          onClick={() => { localStorage.setItem(STORAGE_KEY, 'true'); setDismissed(true); }}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
        >
          Skip
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginBottom: 16 }}>
        <div style={{ height: 4, background: '#2A9D8F', borderRadius: 2, width: `${(completedCount / STEPS.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEPS.map((step) => {
          const done = completed[step.key];
          return (
            <div
              key={step.key}
              onClick={() => !done && navigate(step.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: done ? '#f0fdf4' : '#fff',
                border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`,
                cursor: done ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? '#22c55e' : '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 14 : 16, flexShrink: 0,
                color: done ? '#fff' : undefined,
                fontWeight: 700,
              }}>
                {done ? '✓' : step.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: done ? '#15803d' : '#1a2332',
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {step.label}
                </div>
                {!done && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{step.tip}</div>
                )}
              </div>
              {!done && (
                <div style={{ fontSize: 13, color: '#2A9D8F', fontWeight: 600, flexShrink: 0 }}>→</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    border: '2px solid #99f6e4',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  dismissBtn: {
    background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8,
    padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
  },
};
