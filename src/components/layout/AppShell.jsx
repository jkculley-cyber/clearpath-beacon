import { useState, useMemo, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, exportLocalBackup } from '../../lib/db';

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
  { to: '/reports',       label: 'Reports',          icon: ReportsIcon },
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

  const schoolName = counselor?.school_name || 'Beacon';

  // Backup reminder — tiered urgency, non-dismissible when critical
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [showRestoreGuide, setShowRestoreGuide] = useState(false);
  const backupAge = useMemo(() => {
    if (!counselor) return null;
    const last = localStorage.getItem('beacon_last_backup');
    if (!last) return 999; // never backed up
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }, [counselor]);
  // Urgency tiers: 7+ days = amber nudge, 14+ = orange warning, 30+/never = red critical
  const backupUrgency = backupAge >= 30 || backupAge >= 999 ? 'critical' : backupAge >= 14 ? 'warning' : backupAge >= 7 ? 'nudge' : null;
  // Critical banners cannot be dismissed. Nudge can be dismissed for this session.
  const showBackupBanner = backupUrgency && !(backupUrgency === 'nudge' && backupDismissed);

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

  const hasBanner = showTrialBanner || isSoftGated || showBackupBanner;

  return (
    <div className={`shell${hasBanner ? ' has-banner' : ''}`}>
      {/* Fixed header stack: topbar + banners */}
      <div className="header-stack">
        <header className="topbar">
          <button className="topbar-hamburger" onClick={() => setDrawerOpen(o => !o)} aria-label="Toggle menu">
            <HamburgerIcon />
          </button>
          <div className="topbar-brand">{schoolName}</div>
          <div className="topbar-right">
            <span className="topbar-counselor">{counselor?.full_name || ''}</span>
            <button className="btn-ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

      {/* Trial / gate banners */}
      {showTrialBanner && (
        <div className="trial-banner">
          {trialDaysLeft === 0
            ? 'Your trial ends today — subscribe to keep your data.'
            : `Trial ends in ${trialDaysLeft} day${trialDaysLeft > 1 ? 's' : ''} — subscribe to keep your data.`}
        </div>
      )}
      {isSoftGated && (
        <div className="gate-banner">
          Your trial has expired. Subscribe to restore full access.
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
              {backupUrgency === 'nudge' && (
                <button className="backup-banner-dismiss" onClick={() => setBackupDismissed(true)}>
                  Later
                </button>
              )}
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
          <span className="sidebar-logo">Beacon</span>
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
      </aside>

      {/* Main content — spacer pushes below fixed header-stack */}
      <main className="main-content">
        <div className="header-spacer" />
        <Outlet />
      </main>

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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.08a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.08a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
