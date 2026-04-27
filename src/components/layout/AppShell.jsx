import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, exportLocalBackup } from '../../lib/db';
import { isReferralAlert } from '../../lib/referralAlerts';
import { startNotificationPoll, stopNotificationPoll, getNotificationPrefs } from '../../lib/notifications';
import CrisisLaunchButton from '../CrisisLaunchButton';

/* ─── Nav items ─── */
const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard',       icon: DashboardIcon },
  { to: '/schedule',      label: 'Schedule',        icon: ScheduleIcon },
  { to: '/groups',        label: 'Groups',          icon: GroupsIcon },
  { to: '/students',      label: 'Students',        icon: StudentsIcon },
  { to: '/referrals',     label: 'Referrals',       icon: ReferralsIcon },
  { to: '/time-tracker',  label: 'Time Tracker',    icon: TimeTrackerIcon },
  { to: '/lessons',       label: 'Lessons',         icon: LessonsIcon },
  { to: '/communications',label: 'Communications',  icon: CommsIcon },
  { to: '/sessions',      label: 'Sessions',        icon: SessionsIcon },
  { to: '/goals',         label: 'Goals',           icon: GoalsIcon },
  { to: '/needs-assessment', label: 'Assessments',  icon: AssessmentIcon },
  { to: '/reports',       label: 'Reports',          icon: ReportsIcon },
  { to: '/crest',         label: 'CREST Award',     icon: CrestIcon },
  { to: '/templates',     label: 'Templates',       icon: TemplatesIcon },
  { to: '/resources',     label: 'Resources',       icon: ResourcesIcon },
  { to: '/settings',      label: 'Settings',        icon: SettingsIcon },
];

/* ─── Component ─── */
export default function AppShell() {
  const { counselor, signOut, isSoftGated, trialDaysLeft } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const showTrialBanner =
    !isSoftGated &&
    trialDaysLeft !== null &&
    trialDaysLeft <= 4 &&
    counselor?.subscription_status !== 'active' &&
    counselor?.subscription_status !== 'extended';

  const schoolName = counselor?.school_name || counselor?.campus || 'Beacon';

  // Backup reminder — tiered urgency, dismissible until next day
  const [backupDismissed, setBackupDismissed] = useState(() => {
    const dismissedUntil = localStorage.getItem('beacon_backup_dismissed_until');
    return dismissedUntil && new Date(dismissedUntil) > new Date();
  });
  const [backingUp, setBackingUp] = useState(false);
  const [showRestoreGuide, setShowRestoreGuide] = useState(false);
  const backupAge = useMemo(() => {
    if (!counselor) return null;
    const last = localStorage.getItem('beacon_last_backup');
    if (!last) return 999; // never backed up
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }, [counselor]);
  const backupUrgency = backupAge >= 30 || backupAge >= 999 ? 'critical' : backupAge >= 14 ? 'warning' : backupAge >= 7 ? 'nudge' : null;
  // Suppress backup banner for first 48 hours after signup — don't scare new users
  const isNewUser = counselor?.trial_started_at && (Date.now() - new Date(counselor.trial_started_at).getTime()) < 48 * 60 * 60 * 1000;
  const showBackupBanner = backupUrgency && !backupDismissed && !isNewUser;

  function dismissBackupUntilTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    localStorage.setItem('beacon_backup_dismissed_until', tomorrow.toISOString());
    setBackupDismissed(true);
  }

  async function handleQuickBackup() {
    setBackingUp(true);
    try {
      const data = await exportLocalBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('beacon_last_backup', new Date().toISOString());
      setBackupDismissed(true);
    } catch { /* ignore */ }
    setBackingUp(false);
  }

  // Sidebar value counter — lifetime totals
  const [sidebarSessionCount, setSidebarSessionCount] = useState(null);
  const [sidebarStudentCount, setSidebarStudentCount] = useState(null);

  useEffect(() => {
    if (!counselor?.id) return;
    (async () => {
      const [sessRes, stuRes] = await Promise.all([
        db.count('sessions', { counselor_id: counselor.id }),
        db.count('students', { counselor_id: counselor.id, status: 'active' }),
      ]);
      setSidebarSessionCount(sessRes.count ?? 0);
      setSidebarStudentCount(stuRes.count ?? 0);
    })();
  }, [counselor?.id]);

  // Native notification poll — fires browser alerts for upcoming sessions + follow-ups.
  // Honors counselor's enable/disable preference; no-op if permission not granted.
  useEffect(() => {
    if (!counselor?.id) return;
    let cancelled = false;
    (async () => {
      const prefs = await getNotificationPrefs();
      if (cancelled) return;
      if (prefs.enabled) startNotificationPoll(counselor.id);
    })();
    return () => {
      cancelled = true;
      stopNotificationPoll();
    };
  }, [counselor?.id]);

  // Active safety-alert poll. Refreshes every 30s and on window focus.
  // Counts open referrals where harm-to-self / harm-to-others / urgency=Urgent / concern=Crisis.
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    if (!counselor?.id) return;
    let active = true;
    const check = async () => {
      const { data } = await db.select('referrals', { eq: { counselor_id: counselor.id } });
      if (!active) return;
      const open = (data || []).filter((r) => r.status === 'open' || r.status === 'in_progress');
      setAlertCount(open.filter(isReferralAlert).length);
    };
    check();
    const interval = setInterval(check, 30000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [counselor?.id]);

  // Measure the header-stack height so the content spacer always matches,
  // regardless of how many banners are stacked (safety + trial + backup, etc.)
  const headerStackRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(56);
  useLayoutEffect(() => {
    if (!headerStackRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) setHeaderHeight(h);
    });
    ro.observe(headerStackRef.current);
    return () => ro.disconnect();
  }, []);

  const hasBanner = showTrialBanner || isSoftGated || showBackupBanner || alertCount > 0;

  return (
    <div className={`shell${hasBanner ? ' has-banner' : ''}`}>
      {/* Fixed header stack: topbar + banners */}
      <div className="header-stack" ref={headerStackRef}>
        <header className="topbar">
          <button className="topbar-hamburger" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu">
            <HamburgerIcon />
          </button>
          <div className="topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/icons/Beacon-AppIcon-192.png" alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
            {schoolName}
          </div>
          <div className="topbar-right">
            <span className="topbar-counselor">{counselor?.name || ''}</span>
            <button className="btn-ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

      {/* Safety alert banner — most prominent, sits above other banners */}
      {alertCount > 0 && (
        <Link to="/referrals" className="safety-alert-banner">
          <span className="safety-alert-text">
            🚨 {alertCount} ACTIVE SAFETY ALERT{alertCount !== 1 ? 'S' : ''} — Review now
          </span>
          <span className="safety-alert-btn">Open Referrals →</span>
        </Link>
      )}

      {/* Trial / gate banners */}
      {showTrialBanner && (
        <div className="trial-banner">
          {trialDaysLeft === 0
            ? 'Your trial ends today.'
            : `Trial ends in ${trialDaysLeft} day${trialDaysLeft > 1 ? 's' : ''}.`}
          {' '}
          <a href="https://clearpathedgroup.com/store.html#card-beacon" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}>
            Subscribe — $8/mo
          </a>
        </div>
      )}
      {isSoftGated && (
        <div className="gate-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', padding: '14px 20px' }}>
          <span style={{ fontSize: '0.95rem' }}>Your trial has expired. Your data is safe — subscribe to restore full access.</span>
          <a href="https://clearpathedgroup.com/store.html#card-beacon" target="_blank" rel="noopener noreferrer" style={{ background: '#fff', color: '#b91c1c', padding: '10px 24px', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            Subscribe Now — $8/mo or $79/yr
          </a>
        </div>
      )}
      {showBackupBanner && (
        <div className={`backup-banner backup-${backupUrgency}`}>
          <div className="backup-banner-content">
            <span className="backup-banner-text">
              {backupAge >= 999
                ? '⚠️ You have never backed up. Your students, sessions, and compliance data exist ONLY on this device. If your browser data is cleared, everything is permanently lost.'
                : backupUrgency === 'critical'
                ? `🚨 Your last backup was ${backupAge} days ago. Your data is at serious risk. Back up now — it takes 3 seconds.`
                : backupUrgency === 'warning'
                ? `⚠️ Your last backup was ${backupAge} days ago. Weekly backups protect months of work. One click and you're safe.`
                : `🛡️ Your last backup was ${backupAge} days ago. A quick backup keeps your data safe.`}
            </span>
            <span className="backup-banner-actions">
              <button className="backup-banner-btn" onClick={handleQuickBackup} disabled={backingUp}>
                {backingUp ? 'Saving…' : '⬇ Back Up Now'}
              </button>
              <button className="backup-banner-btn-alt" onClick={() => setShowRestoreGuide(true)}>
                How to restore?
              </button>
              <button className="backup-banner-dismiss" onClick={dismissBackupUntilTomorrow}>
                Remind me tomorrow
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Restore Guide Modal */}
      {showRestoreGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowRestoreGuide(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 520, width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>How to Restore Your Data</h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>If you lose your data or move to a new device, follow these steps.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={guideStep}>
                <div style={guideNum}>1</div>
                <div>
                  <div style={guideTitle}>Back up regularly</div>
                  <div style={guideDesc}>Click <strong>"Back Up Now"</strong> in the banner above or go to <strong>Settings → Data Storage → Export Backup</strong>. This downloads a JSON file to your device. Do this every week.</div>
                </div>
              </div>

              <div style={guideStep}>
                <div style={guideNum}>2</div>
                <div>
                  <div style={guideTitle}>Save the backup file somewhere safe</div>
                  <div style={guideDesc}>Email it to yourself, save it to Google Drive, or put it on a USB drive. Don't leave it only in your Downloads folder — that gets cleared too.</div>
                </div>
              </div>

              <div style={guideStep}>
                <div style={guideNum}>3</div>
                <div>
                  <div style={guideTitle}>If you need to restore</div>
                  <div style={guideDesc}>Open Beacon → <strong>Settings → Data Storage → Restore from Backup</strong> → select your JSON file. All your students, sessions, groups, time entries, and notes will be restored exactly as they were.</div>
                </div>
              </div>

              <div style={guideStep}>
                <div style={guideNum}>4</div>
                <div>
                  <div style={guideTitle}>Moving to a new device?</div>
                  <div style={guideDesc}>Export a backup on your old device, then open <strong>beacon.clearpathedgroup.com</strong> on your new device, complete the setup, and immediately restore from backup. Your license key works on any device.</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#15803d', lineHeight: 1.5 }}>
              <strong>Pro tip:</strong> Set a weekly calendar reminder — "Friday 3pm: Back up Beacon." It takes 3 seconds and protects months of work.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowRestoreGuide(false); navigate('/settings'); }} style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                Go to Settings
              </button>
              <button onClick={() => { setShowRestoreGuide(false); handleQuickBackup(); }} style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: '#2A9D8F', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Back Up Now
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* /header-stack */}

      {/* Backdrop */}
      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${drawerOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <img src="/icons/Beacon-AppIcon-192.png" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="sidebar-logo">Beacon</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.03em' }}>Counselor Command Center</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>Clear Path Education Group, LLC</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {sidebarSessionCount !== null && (
          <div className="sidebar-footer">
            {sidebarSessionCount} session{sidebarSessionCount !== 1 ? 's' : ''} &middot; {sidebarStudentCount} student{sidebarStudentCount !== 1 ? 's' : ''}
          </div>
        )}
        <div className="sidebar-brand-footer">
          <img src="/icons/Beacon-AppIcon-192.png" alt="" style={{ width: 16, height: 16, borderRadius: 4, opacity: 0.6 }} />
          <span>Clear Path Education Group</span>
        </div>
      </aside>

      {/* Main content — spacer pushes below fixed header-stack */}
      <main className="main-content">
        <div className="header-spacer" style={{ height: headerHeight }} />
        <Outlet />
        <div className="content-footer">
          © {new Date().getFullYear()} Clear Path Education Group, LLC · Beacon Counselor Command Center
        </div>
      </main>

      {/* Floating Crisis Now button — visible on every authed page */}
      <CrisisLaunchButton />

      {/* Scoped styles */}
      <style>{shellStyles}</style>
    </div>
  );
}

/* ─── Inline styles (keeps the component self-contained) ─── */
/* ── Restore guide inline styles ── */
const guideStep = { display: 'flex', gap: 14, alignItems: 'flex-start' };
const guideNum = { width: 28, height: 28, borderRadius: '50%', background: '#2A9D8F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 };
const guideTitle = { fontSize: 15, fontWeight: 600, color: '#1a2332', marginBottom: 2 };
const guideDesc = { fontSize: 13, color: '#4b5563', lineHeight: 1.55 };

const shellStyles = `
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

/* ── Header Stack (topbar + banners, fixed) ── */
.header-stack {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
}

/* ── Topbar ── */
.topbar {
  height: 56px;
  background: var(--navy);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}
.topbar-hamburger {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  display: flex;
}
.topbar-brand {
  font-weight: 600;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.topbar-counselor {
  font-size: 0.875rem;
  opacity: 0.85;
}
.btn-ghost {
  background: none;
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8125rem;
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); }

/* ── Banners (inside header-stack, flow naturally below topbar) ── */
.safety-alert-banner {
  background: #dc2626;
  color: #fff !important;
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  text-decoration: none;
  border-bottom: 2px solid #991b1b;
  animation: safety-alert-pulse 2.2s ease-in-out infinite;
  cursor: pointer;
}
.safety-alert-banner:hover { background: #b91c1c; }
.safety-alert-text { letter-spacing: 0.4px; }
.safety-alert-btn {
  background: #fff;
  color: #dc2626;
  padding: 4px 14px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.8125rem;
  white-space: nowrap;
}
@keyframes safety-alert-pulse {
  0%, 100% { background: #dc2626; }
  50% { background: #ef4444; }
}

.trial-banner {
  background: #f59e0b;
  color: #1a2332;
  text-align: center;
  padding: 8px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
}
.gate-banner {
  background: #ef4444;
  color: #fff;
  text-align: center;
  padding: 8px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
}
.backup-banner {
  padding: 10px 20px;
  font-size: 0.8125rem;
  font-weight: 500;
}
.backup-banner-content {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.backup-banner-text { flex: 1; min-width: 200px; line-height: 1.4; }
.backup-banner-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

/* Tier: nudge (7-13 days) */
.backup-nudge { background: #fef3c7; color: #92400e; border-bottom: 1px solid #fde68a; }
.backup-nudge .backup-banner-btn { background: #92400e; color: #fff; }

/* Tier: warning (14-29 days) */
.backup-warning { background: #fff7ed; color: #9a3412; border-bottom: 2px solid #fb923c; }
.backup-warning .backup-banner-btn { background: #ea580c; color: #fff; }

/* Tier: critical (30+ days or never) */
.backup-critical { background: #fef2f2; color: #991b1b; border-bottom: 2px solid #ef4444; animation: pulse-bg 2s ease-in-out infinite; }
.backup-critical .backup-banner-btn { background: #dc2626; color: #fff; font-size: 0.8125rem; padding: 5px 16px; }
@keyframes pulse-bg {
  0%, 100% { background: #fef2f2; }
  50% { background: #fee2e2; }
}

.backup-banner-btn {
  border: none;
  border-radius: 6px;
  padding: 4px 14px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.backup-banner-btn:hover { opacity: 0.9; }
.backup-banner-btn-alt {
  background: none;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 3px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
  white-space: nowrap;
}
.backup-banner-btn-alt:hover { opacity: 0.7; }
.backup-banner-dismiss {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
  opacity: 0.7;
}

/* ── Sidebar ── */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 240px;
  background: var(--navy);
  color: #fff;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-top: 56px;
}
.sidebar--open { transform: translateX(0); }

.sidebar-header {
  padding: 20px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sidebar-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--teal);
  letter-spacing: -0.01em;
}
.sidebar-nav {
  padding: 8px 0;
  flex: 1;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  color: rgba(255,255,255,0.65);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s, color 0.15s;
}
.sidebar-link:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
}
.sidebar-link--active {
  color: var(--teal);
  background: rgba(42,157,143,0.1);
  border-right: 3px solid var(--teal);
}
.sidebar-link svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
}
.sidebar-brand-footer {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

/* ── Backdrop ── */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 45;
}

/* ── Main content ── */
.main-content {
  flex: 1;
  padding: 0 24px 24px;
  min-height: 100vh;
}
.header-spacer {
  height: 56px; /* topbar height — banners add to this automatically via header-stack */
}
.has-banner .header-spacer {
  height: 100px; /* topbar + banner */
}
.content-footer {
  margin-top: 40px;
  padding: 16px 0;
  border-top: 1px solid var(--border, #e2e8f0);
  text-align: center;
  font-size: 11px;
  color: #9ca3af;
}

/* ── Desktop ── */
@media (min-width: 768px) {
  .topbar-hamburger { display: none; }
  .sidebar {
    transform: translateX(0);
  }
  .header-stack {
    left: 240px;
  }
  .drawer-backdrop { display: none; }
  .main-content {
    margin-left: 240px;
  }
}
`;

/* ─── SVG Icons ─── */

function HamburgerIcon() {
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ReferralsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M12 18v-6M9 15h6" />
    </svg>
  );
}

function TimeTrackerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function LessonsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

function CommsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function AssessmentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function ResourcesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="13" y2="11" />
    </svg>
  );
}

function CrestIcon() {
  // Trophy icon — fits the "award" framing
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.08a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.08a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
