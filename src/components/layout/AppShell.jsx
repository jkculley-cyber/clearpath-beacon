import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

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

  return (
    <div className="shell">
      {/* Mobile topbar */}
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
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Scoped styles */}
      <style>{shellStyles}</style>
    </div>
  );
}

/* ─── Inline styles (keeps the component self-contained) ─── */
const shellStyles = `
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

/* ── Topbar ── */
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--navy);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 16px;
  z-index: 40;
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

/* ── Banners ── */
.trial-banner {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  background: #f59e0b;
  color: #1a2332;
  text-align: center;
  padding: 6px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  z-index: 39;
}
.gate-banner {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  background: #ef4444;
  color: #fff;
  text-align: center;
  padding: 6px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  z-index: 39;
}

/* ── Sidebar ── */
.sidebar {
  position: fixed;
  top: 56px;
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
  margin-top: 56px;
  padding: 24px;
  min-height: calc(100vh - 56px);
}

/* ── Desktop ── */
@media (min-width: 768px) {
  .topbar-hamburger { display: none; }
  .sidebar {
    transform: translateX(0);
  }
  .drawer-backdrop { display: none; }
  .main-content {
    margin-left: 240px;
  }
  .topbar {
    left: 240px;
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
