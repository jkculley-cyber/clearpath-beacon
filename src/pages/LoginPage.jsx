import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // View modes: 'login' | 'forgot' | 'forgot-sent' | 'reset'
  const [view, setView] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Detect password recovery callback from Supabase
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setView('reset');
    }
    // Also listen for auth state change with PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : err.message || 'An unexpected error occurred.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/login',
      });
      if (resetError) throw resetError;
      setView('forgot-sent');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setResetSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  // --- Render helpers ---

  const renderBrand = () => (
    <div style={styles.brand}>
      <div style={styles.logoCircle}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="#fff" strokeWidth="2" />
          <path d="M18 6 L18 30 M10 14 L18 6 L26 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 style={styles.title}>Beacon</h1>
      <p style={styles.tagline}>Guiding every student forward.</p>
    </div>
  );

  const renderError = () =>
    error ? (
      <div style={styles.error}>
        <span style={{ marginRight: 8 }}>!</span>
        {error}
      </div>
    ) : null;

  const renderFooter = () => (
    <p style={styles.footer}>Beacon by Clear Path Education Group</p>
  );

  // --- Reset password view (after clicking email link) ---
  if (view === 'reset') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          {renderBrand()}

          {resetSuccess ? (
            <div style={styles.success}>
              Password updated! Redirecting to dashboard...
            </div>
          ) : (
            <>
              <p style={styles.subtitle}>Set a new password for your account.</p>
              {renderError()}
              <form onSubmit={handleResetSubmit} style={styles.form}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  className="form-input"
                  style={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  autoFocus
                />

                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  style={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />

                <button
                  type="submit"
                  style={{ ...styles.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {renderFooter()}
        </div>
      </div>
    );
  }

  // --- Forgot password sent confirmation ---
  if (view === 'forgot-sent') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          {renderBrand()}
          <div style={styles.success}>
            Check your email for a reset link. It may take a minute to arrive.
          </div>
          <button
            type="button"
            onClick={() => { setView('login'); setError(''); setResetEmail(''); }}
            style={styles.link}
          >
            Back to Sign In
          </button>
          {renderFooter()}
        </div>
      </div>
    );
  }

  // --- Forgot password form ---
  if (view === 'forgot') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          {renderBrand()}
          <p style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </p>
          {renderError()}
          <form onSubmit={handleForgotSubmit} style={styles.form}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              className="form-input"
              style={styles.input}
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@school.edu"
              required
              autoFocus
            />

            <button
              type="submit"
              style={{ ...styles.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setView('login'); setError(''); }}
            style={styles.link}
          >
            Back to Sign In
          </button>
          {renderFooter()}
        </div>
      </div>
    );
  }

  // --- Default login view ---
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {renderBrand()}
        {renderError()}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            className="form-input"
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
            autoFocus
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            className="form-input"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <button
            type="submit"
            style={{
              ...styles.btn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setView('forgot'); setError(''); }}
          style={styles.link}
        >
          Forgot Password?
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>No district account?</p>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('beacon_storage_mode', 'local');
              window.location.href = '/setup';
            }}
            style={{ ...styles.link, marginTop: 0, fontSize: 13, fontWeight: 600 }}
          >
            Use Local Mode (data stays on this device)
          </button>
        </div>

        {renderFooter()}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a7a6f 0%, #2A9D8F 40%, #3bb8a9 100%)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    padding: '48px 36px 36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#2A9D8F',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a2332',
    margin: '0 0 4px',
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  error: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
  },
  success: {
    background: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    marginTop: 20,
    padding: '12px 0',
    background: '#2A9D8F',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.3px',
    transition: 'background 0.15s',
  },
  link: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    marginTop: 16,
    background: 'none',
    border: 'none',
    color: '#2A9D8F',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 28,
  },
};
