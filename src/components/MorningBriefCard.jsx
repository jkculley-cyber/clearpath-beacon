/**
 * MorningBriefCard — dismissible "executive view" card at the top of Dashboard.
 * Shows once per day. Aggregates from local IndexedDB via buildMorningBrief().
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildMorningBrief, isBriefDismissedToday, dismissBriefToday } from '../lib/morningBrief';

export default function MorningBriefCard({ counselorId }) {
  const [brief, setBrief] = useState(null);
  const [dismissed, setDismissed] = useState(true); // start "dismissed" so card doesn't flash before the check

  useEffect(() => {
    if (!counselorId) return;
    let cancelled = false;
    (async () => {
      const isDismissed = await isBriefDismissedToday();
      if (cancelled) return;
      if (isDismissed) {
        setDismissed(true);
        return;
      }
      const b = await buildMorningBrief(counselorId);
      if (cancelled) return;
      setBrief(b);
      setDismissed(false);
    })();
    return () => { cancelled = true; };
  }, [counselorId]);

  if (dismissed || !brief) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    await dismissBriefToday();
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Morning Brief
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '0 0 12px' }}>
            {brief.greeting}
          </h2>
        </div>
        <button onClick={handleDismiss} style={dismissBtn} title="Dismiss for today">
          Got it ✓
        </button>
      </div>

      {/* Today + This Week strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
        <Stat label="Today" lines={[
          `${brief.today.sessionCount} session${brief.today.sessionCount === 1 ? '' : 's'} scheduled`,
          brief.today.firstSessionTime ? `First: ${brief.today.firstSessionTime}` : null,
          brief.today.blockCount > 0 ? `${brief.today.blockCount} recurring block${brief.today.blockCount === 1 ? '' : 's'}` : null,
          brief.today.openFollowUps > 0
            ? `⚠ ${brief.today.openFollowUps} follow-up${brief.today.openFollowUps === 1 ? '' : 's'} need attention`
            : null,
        ]} accent="#6d28d9" />
        <Stat label="This Week" lines={[
          `${brief.thisWeek.scheduledSessions} sessions across the week`,
          brief.thisWeek.sb179.hoursLogged > 0
            ? `${brief.thisWeek.sb179.pct}% SB 179 (${brief.thisWeek.sb179.hoursLogged} hrs logged)`
            : 'No SB 179 time logged yet',
          brief.thisWeek.sb179.hoursToTarget > 0
            ? `+${brief.thisWeek.sb179.hoursToTarget} hrs counseling reaches 80%`
            : null,
          brief.thisWeek.openReferrals > 0
            ? `${brief.thisWeek.openReferrals} open referral${brief.thisWeek.openReferrals === 1 ? '' : 's'}`
            : null,
        ]} accent="#2A9D8F" />
        <Stat label="Coming Up" lines={
          brief.deadlines.length > 0
            ? brief.deadlines.map((d) => `${d.severity === 'red' ? '🔴 ' : d.severity === 'amber' ? '🟡 ' : ''}${d.label} — ${d.daysUntil === 0 ? 'today' : `${d.daysUntil}d`}`)
            : ['No upcoming deadlines in the next 60 days.']
        } accent={brief.deadlines.some((d) => d.severity === 'red') ? '#dc2626' : '#a16207'} />
      </div>

      {/* Signals */}
      {brief.signals.length > 0 && (
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#6d28d9', lineHeight: 1.6 }}>
          <strong>Signals:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 22 }}>
            {brief.signals.map((s, i) => (<li key={i}>{s}</li>))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <Link to="/schedule" style={linkBtn}>Open schedule →</Link>
        <Link to="/time-tracker" style={linkBtn}>Log time →</Link>
        <Link to="/referrals" style={linkBtn}>Triage referrals →</Link>
        {brief.deadlines.find((d) => d.label.startsWith('CREST')) && (
          <Link to="/crest" style={linkBtn}>CREST portfolio →</Link>
        )}
      </div>
    </div>
  );
}

function Stat({ label, lines, accent }) {
  const visible = lines.filter(Boolean);
  return (
    <div style={{ borderLeft: `4px solid ${accent}`, padding: '8px 14px', background: '#f9fafb', borderRadius: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a2332', lineHeight: 1.6 }}>
        {visible.length === 0 ? <span style={{ color: '#9ca3af' }}>—</span> : visible.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

const card = {
  marginBottom: 20,
  background: 'linear-gradient(135deg, #faf5ff 0%, #fff 60%)',
  border: '1px solid #e9d5ff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const dismissBtn = {
  background: '#fff',
  color: '#6d28d9',
  border: '1px solid #d8b4fe',
  borderRadius: 8,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const linkBtn = {
  background: '#fff',
  color: '#6d28d9',
  border: '1px solid #d8b4fe',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};
