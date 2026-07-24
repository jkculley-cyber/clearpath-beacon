import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isLocalMode, getStorageMode, setStorageMode, seedLocalLessons, seedLocalTemplates } from '../lib/db';
import * as local from '../lib/localDb';
import { checkLicense, getLicenseKey, setLicenseKey, clearLicense, getCachedLicense, getLicenseDaysLeft } from '../lib/license';
import { getGrades } from '../lib/constants';

const AuthContext = createContext(null);

/* ─── Trial / subscription helpers ─── */

const TRIAL_DAYS = 14;

function computeGateState(counselor) {
  if (!counselor) return { isSoftGated: false, trialDaysLeft: null };

  const status = counselor.subscription_status || 'trial';

  // Active or extended subscriptions are never gated
  if (status === 'active' || status === 'extended') {
    // Check paid_through for active
    if (status === 'active' && counselor.paid_through) {
      const paidThrough = new Date(counselor.paid_through);
      if (paidThrough < new Date()) {
        return { isSoftGated: true, trialDaysLeft: 0 };
      }
    }
    return { isSoftGated: false, trialDaysLeft: null };
  }

  // Trial logic
  if (status === 'trial' && counselor.trial_started_at) {
    const trialStart = new Date(counselor.trial_started_at);
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const now = new Date();
    const msLeft = trialEnd - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    return { isSoftGated: daysLeft <= 0, trialDaysLeft: daysLeft };
  }

  // Expired
  if (status === 'expired') {
    return { isSoftGated: true, trialDaysLeft: 0 };
  }

  return { isSoftGated: false, trialDaysLeft: null };
}

/* ─── Local mode counselor helpers ─── */

const LOCAL_COUNSELOR_KEY = 'beacon_local_counselor_id';

async function getOrCreateLocalCounselor() {
  const existingId = localStorage.getItem(LOCAL_COUNSELOR_KEY);
  if (existingId) {
    const profile = await local.getById('counselor', existingId);
    if (profile) return profile;
  }
  // No local profile yet — will be created during local setup
  return null;
}

async function createLocalCounselor(profile) {
  const record = {
    id: local.uuid(),
    name: profile.name,
    email: profile.email || 'local@beacon.local',
    campus: profile.campus || '',
    district: profile.district || '',
    grade_band: profile.grade_band || 'elementary',
    served_grades: profile.served_grades || null,
    subscription_status: 'trial',
    trial_started_at: new Date().toISOString(),
    onboarding_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await local.put('counselor', record);
  localStorage.setItem(LOCAL_COUNSELOR_KEY, record.id);

  // Seed bundled lessons (scoped to the counselor's served grades) and templates
  await seedLocalLessons(record.id, getGrades(record));
  await seedLocalTemplates(record.id);

  return record;
}

/* ─── Provider ─── */

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [counselor, setCounselor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageMode, setMode] = useState(getStorageMode);
  // Fail-closed: start as not-yet-checked. Trial logic in the useMemo below carries
  // legitimate trial users; explicit license check then sets the truth before loading=false.
  const [licenseState, setLicenseState] = useState({ valid: false, softGated: false, reason: 'pending' });

  const switchStorageMode = useCallback((mode) => {
    setStorageMode(mode);
    setMode(mode);
    // Force reload to reinitialize with new mode
    window.location.reload();
  }, []);

  // Cloud mode: fetch counselor from Supabase
  const fetchCounselor = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('counselors')
      .select('*')
      .eq('supabase_auth_id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch counselor profile:', error.message);
      setCounselor(null);
    } else {
      setCounselor(data);
    }
  }, []);

  const refreshCounselor = useCallback(async () => {
    if (storageMode === 'local') {
      const profile = await getOrCreateLocalCounselor();
      setCounselor(profile);
    } else if (session?.user?.id) {
      await fetchCounselor(session.user.id);
    }
  }, [session, fetchCounselor, storageMode]);

  // Bootstrap
  useEffect(() => {
    let mounted = true;

    if (storageMode === 'local') {
      // Local mode — load profile from IndexedDB + check license
      getOrCreateLocalCounselor().then(async (profile) => {
        if (!mounted) return;
        setCounselor(profile);
        if (profile) {
          setSession({ user: { id: profile.id, email: profile.email } });
        }
        // Check license — fail CLOSED. If anything throws we mark the gate active.
        // Trial users without a license key are still carried by the useMemo below.
        try {
          const lic = await checkLicense();
          if (mounted) setLicenseState(lic);
        } catch (err) {
          if (mounted) setLicenseState({ valid: false, softGated: true, reason: 'check_failed' });
          console.warn('License check threw:', err);
        }
        setLoading(false);
      });
      return () => { mounted = false; };
    }

    // Cloud mode — normal Supabase auth flow
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchCounselor(s.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (!mounted) return;
        setSession(s);
        if (s?.user) {
          fetchCounselor(s.user.id);
        } else {
          setCounselor(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchCounselor, storageMode]);

  // Auth actions
  const signIn = useCallback(async (email, password) => {
    if (storageMode === 'local') {
      throw new Error('Cloud sign-in not available in local mode');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, [storageMode]);

  const signOut = useCallback(async () => {
    if (storageMode === 'cloud') {
      await supabase.auth.signOut();
    }
    // Purge service-worker caches so the previous counselor's UI cannot serve
    // from cache on a shared device. Belt-and-suspenders to the IndexedDB
    // sign-out (which clears in-memory state below).
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      const reg = navigator.serviceWorker?.controller;
      if (reg) reg.postMessage({ type: 'BEACON_PURGE_CACHE' });
    } catch { /* purge is best-effort; never block signout */ }
    setSession(null);
    setCounselor(null);
  }, [storageMode]);

  // Local mode setup — called from LocalSetupPage
  const setupLocalProfile = useCallback(async (profile) => {
    const record = await createLocalCounselor(profile);
    setCounselor(record);
    setSession({ user: { id: record.id, email: record.email } });
    return record;
  }, []);

  const { isSoftGated, trialDaysLeft } = useMemo(
    () => {
      if (storageMode === 'local') {
        // Local mode: valid license key = full access (not gated)
        if (licenseState.valid && !licenseState.softGated && getLicenseKey()) {
          return { isSoftGated: false, trialDaysLeft: null };
        }
        // No license key — use trial period from counselor record
        const trialState = computeGateState(counselor);
        // If trial is still active, not gated
        if (!trialState.isSoftGated) {
          return trialState;
        }
        // Trial expired AND no valid license = gated
        return { isSoftGated: true, trialDaysLeft: trialState.trialDaysLeft };
      }
      return computeGateState(counselor);
    },
    [counselor, storageMode, licenseState]
  );

  // Days until the active license expires (null when unlicensed / unknown).
  // Drives the renewal banner + Morning Brief renewal deadline so a paying
  // counselor never lapses straight into the soft gate without warning.
  const licenseDaysLeft = useMemo(() => {
    if (!licenseState.valid) return null;
    return getLicenseDaysLeft();
  }, [licenseState]);

  // License key management
  const saveLicenseKey = useCallback(async (key) => {
    setLicenseKey(key);
    const lic = await checkLicense();
    setLicenseState(lic);
    return lic;
  }, []);

  const removeLicense = useCallback(() => {
    clearLicense();
    setLicenseState({ valid: false, softGated: true, reason: 'no_license' });
  }, []);

  const value = useMemo(() => ({
    session,
    counselor,
    loading,
    isSoftGated,
    trialDaysLeft,
    licenseDaysLeft,
    storageMode,
    isLocalMode: storageMode === 'local',
    licenseState,
    signIn,
    signOut,
    refreshCounselor,
    switchStorageMode,
    setupLocalProfile,
    saveLicenseKey,
    removeLicense,
    getLicenseKey,
    getCachedLicense,
  }), [session, counselor, loading, isSoftGated, trialDaysLeft, licenseDaysLeft, storageMode, licenseState, signIn, signOut, refreshCounselor, switchStorageMode, setupLocalProfile, saveLicenseKey, removeLicense]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
