import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

/* ─── Provider ─── */

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [counselor, setCounselor] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (session?.user?.id) {
      await fetchCounselor(session.user.id);
    }
  }, [session, fetchCounselor]);

  // Bootstrap session
  useEffect(() => {
    let mounted = true;

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
  }, [fetchCounselor]);

  // Auth actions
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCounselor(null);
  }, []);

  const { isSoftGated, trialDaysLeft } = useMemo(
    () => computeGateState(counselor),
    [counselor]
  );

  const value = useMemo(() => ({
    session,
    counselor,
    loading,
    isSoftGated,
    trialDaysLeft,
    signIn,
    signOut,
    refreshCounselor,
  }), [session, counselor, loading, isSoftGated, trialDaysLeft, signIn, signOut, refreshCounselor]);

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
