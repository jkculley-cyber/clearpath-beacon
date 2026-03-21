/**
 * License Check Module — Beacon
 *
 * Checks a license key against the ops Supabase product_licenses table.
 * Caches result in localStorage with a 7-day offline grace period.
 * Sends ZERO student data — only the license key.
 */

const OPS_URL = 'https://xbpuqaqpcbixxodblaes.supabase.co';
const OPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicHVxYXFwY2JpeHhvZGJsYWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjk4MDQsImV4cCI6MjA4Nzk0NTgwNH0.9Rhmz-FLUXnEQXpRCkg3G2ppzPxs2DinaYDmdD_wvPA';
const STORAGE_KEY = 'beacon_license';
const GRACE_DAYS = 7;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — skip network if checked recently

export function getLicenseKey() {
  const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  return cached?.key || null;
}

export function setLicenseKey(key) {
  const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  cached.key = key.trim().toUpperCase();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export function clearLicense() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCachedLicense() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
}

export async function checkLicense() {
  const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

  if (!cached || !cached.key) {
    return { valid: false, softGated: true, reason: 'no_license' };
  }

  // If checked recently and was active, return cached result without fetching
  if (cached.checked_at && cached.status === 'active') {
    const msSinceCheck = Date.now() - new Date(cached.checked_at).getTime();
    if (msSinceCheck < CHECK_INTERVAL_MS) {
      const expOk = !cached.expires_at || new Date(cached.expires_at) > new Date();
      if (expOk) return { valid: true, softGated: false, reason: null };
    }
  }

  // Try network check
  try {
    const res = await fetch(
      `${OPS_URL}/rest/v1/product_licenses?license_key=eq.${encodeURIComponent(cached.key)}&select=status,expires_at`,
      {
        headers: { apikey: OPS_KEY, Authorization: `Bearer ${OPS_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length === 0) {
        cached.status = 'invalid';
        cached.checked_at = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
        return { valid: false, softGated: true, reason: 'invalid_key' };
      }
      const lic = rows[0];
      cached.status = lic.status;
      cached.expires_at = lic.expires_at;
      cached.checked_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));

      const expired = lic.expires_at && new Date(lic.expires_at) < new Date();
      if (lic.status !== 'active' || expired) {
        return { valid: false, softGated: true, reason: 'expired' };
      }
      return { valid: true, softGated: false, reason: null };
    }
  } catch (e) {
    // Network error — fall through to offline grace
  }

  // Offline grace period
  if (cached.checked_at && cached.status === 'active') {
    const daysSince = (Date.now() - new Date(cached.checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= GRACE_DAYS) {
      const expOk = !cached.expires_at || new Date(cached.expires_at) > new Date();
      if (expOk) return { valid: true, softGated: false, reason: null };
    }
  }

  return { valid: false, softGated: true, reason: 'offline_expired' };
}
