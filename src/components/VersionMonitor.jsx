/**
 * VersionMonitor — non-blocking "new version available" toast.
 *
 * The PWA service worker aggressively caches the app bundle, so a counselor
 * with Beacon already loaded keeps running the OLD code until she manually
 * refreshes. Marcia (CC12 round 4): "I've been told to clear browser cache
 * twice now to get fresh code. That's going to make support tickets
 * miserable when they have 200 customers."
 *
 * Fix: the build emits /version.json containing { version, builtAt }. The
 * page polls it on load + every 10 min + on visibility change. When the
 * deployed version differs from what we loaded with, render a tiny toast
 * at the bottom-left with a Refresh button that:
 *   1. Tells the active service worker to skipWaiting (so the next nav
 *      fetches the NEW bundle, not the cached one).
 *   2. Calls window.location.reload(true) (or navigates to /).
 *
 * The user is never forced to reload. Counselors mid-crisis-workflow keep
 * working on the old bundle; the toast is dismissible.
 */

import { useEffect, useState } from 'react';

// Build-stamped at compile time via Vite's define mechanism (see vite.config).
// Falls back to a Date-derived string if the define isn't set, so dev hot-
// reload doesn't accidentally show the banner.
// eslint-disable-next-line no-undef
const BUILD_VERSION = (typeof __BEACON_BUILD_VERSION__ !== 'undefined' ? __BEACON_BUILD_VERSION__ : null);

const POLL_MS = 10 * 60 * 1000; // 10 minutes
const DISMISS_KEY = 'beacon_version_toast_dismissed_for';

async function fetchDeployedVersion() {
  try {
    const res = await fetch('/version.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version || null;
  } catch {
    return null;
  }
}

export default function VersionMonitor() {
  const [newVersion, setNewVersion] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const check = async () => {
      const deployed = await fetchDeployedVersion();
      if (cancelled || !deployed) return;
      // Compare to what we loaded with. If the deployed version differs AND
      // we haven't dismissed for THIS specific version, show the toast.
      if (BUILD_VERSION && deployed !== BUILD_VERSION) {
        const dismissedFor = localStorage.getItem(DISMISS_KEY);
        if (dismissedFor !== deployed) {
          setNewVersion(deployed);
        }
      }
    };

    check();
    timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!newVersion || dismissed) return null;

  const handleRefresh = async () => {
    // Tell the service worker to skip waiting so the next nav request
    // fetches the new bundle through the network, not the SW cache.
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Also nuke our caches so the new bundle loads cleanly
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* best-effort */ }
    // Hard reload — bypass HTTP cache too
    window.location.reload();
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, newVersion);
    setDismissed(true);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      maxWidth: 380,
      background: '#0d9488',
      color: '#fff',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 6px 20px rgba(13,148,136,0.35)',
      zIndex: 220,
      fontSize: 13,
      lineHeight: 1.5,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{'✨'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>New version available</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          A newer Beacon build is live. Refresh when convenient — your work is saved.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleRefresh}
            style={{
              background: '#fff', color: '#0f766e', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            Refresh now
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 6, padding: '6px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
