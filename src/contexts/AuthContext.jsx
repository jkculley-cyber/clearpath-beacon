import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isLocalMode, getStorageMode, setStorageMode, seedLocalLessons, seedLocalTemplates } from '../lib/db';
import * as local from '../lib/localDb';

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
    subscription_status: 'active',
    onboarding_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await local.put('counselor', record);
  localStorage.setItem(LOCAL_COUNSELOR_KEY, record.id);

  // Seed bundled lessons and templates
  await seedLocalLessons(record.id);
  await seedLocalTemplates(record.id);

  return record;
}

/* ─── Provider ─── */

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [counselor, setCounselor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageMode, setMode] = useState(getStorageMode);

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
      // Local mode — load profile from IndexedDB
      getOrCreateLocalCounselor().then((profile) => {
        if (!mounted) return;
        setCounselor(profile);
        // Create a synthetic session so RequireAuth doesn't block
        if (profile) {
          setSession({ user: { id: profile.id, email: profile.email } });
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
    () => storageMode === 'local'
      ? { isSoftGated: false, trialDaysLeft: null }  // Local mode is never gated
      : computeGateState(counselor),
    [counselor, storageMode]
  );

  const value = useMemo(() => ({
    session,
    counselor,
    loading,
    isSoftGated,
    trialDaysLeft,
    storageMode,
    isLocalMode: storageMode === 'local',
    signIn,
    signOut,
    refreshCounselor,
    switchStorageMode,
    setupLocalProfile,
  }), [session, counselor, loading, isSoftGated, trialDaysLeft, storageMode, signIn, signOut, refreshCounselor, switchStorageMode, setupLocalProfile]);

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
