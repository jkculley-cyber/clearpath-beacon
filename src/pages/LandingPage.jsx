export default function LandingPage() {
  const features = [
    {
      title: '80/20 Compliance Tracking',
      desc: 'Prove you\'re meeting SB 179 requirements with automatic time tracking and exportable reports.',
      icon: '\u2713',
    },
    {
      title: 'Caseload Management',
      desc: 'Students, groups, sessions, referrals \u2014 all organized by tier with progress tracking.',
      icon: '\u2630',
    },
    {
      title: 'Session Documentation',
      desc: 'Log sessions in 30 seconds. Notes, attendance, and progress ratings in one place.',
      icon: '\u270E',
    },
    {
      title: 'Works Offline',
      desc: 'All data stays on your device. No cloud, no district approval needed. FERPA compliant by design.',
      icon: '\u26A1',
    },
  ];

  return (
    <div style={page}>
      {/* Hero */}
      <div style={hero}>
        <p style={eyebrow}>Beacon</p>
        <h1 style={heroTitle}>The first tool built for elementary school counselors</h1>
        <p style={heroSub}>
          Track your caseload, prove your 80/20 compliance, and document everything &mdash; all from one place.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
          <a href="/setup" style={ctaPrimary}>Start Free 14-Day Trial &rarr;</a>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = localStorage.getItem('beacon_local_counselor_id') ? '/' : '/setup?signin=1'; }} style={ctaSecondary}>Already have an account? Sign in</a>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
          No credit card needed &middot; $79/year after trial ($8/month) &middot; All data stays on your device
        </p>
      </div>

      {/* Feature grid */}
      <div style={featureGrid}>
        {features.map((f) => (
          <div key={f.title} style={featureCard}>
            <div style={featureIcon}>{f.icon}</div>
            <h3 style={featureTitle}>{f.title}</h3>
            <p style={featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CountSel section */}
      <div style={countselSection}>
        <div style={countselInner}>
          <h2 style={countselTitle}>Switching from CountSel?</h2>
          <p style={countselText}>
            Beacon does everything CountSel did &mdash; plus SB 179 compliance tracking, group session management,
            and professional PDF reports. Import your existing student data via CSV in under 2 minutes.
          </p>
          <a href="/setup" style={{ ...ctaPrimary, display: 'inline-block' }}>Try Beacon Free &rarr;</a>
        </div>
      </div>

      {/* Footer */}
      <div style={footer}>
        <p style={footerText}>Beacon by Clear Path Education Group, LLC</p>
      </div>
    </div>
  );
}

/* ── Styles ── */
const page = {
  minHeight: '100vh',
  background: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const hero = {
  textAlign: 'center',
  padding: '80px 24px 60px',
  maxWidth: 720,
  margin: '0 auto',
};

const eyebrow = {
  fontSize: 14,
  fontWeight: 700,
  color: '#2A9D8F',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 12,
};

const heroTitle = {
  fontSize: 'clamp(28px, 5vw, 44px)',
  fontWeight: 800,
  color: '#1a2332',
  lineHeight: 1.15,
  margin: '0 0 16px',
};

const heroSub = {
  fontSize: 18,
  color: '#6b7280',
  lineHeight: 1.6,
  margin: 0,
};

const ctaPrimary = {
  display: 'inline-block',
  padding: '14px 28px',
  background: '#2A9D8F',
  color: '#fff',
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 700,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
};

const ctaSecondary = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '14px 28px',
  background: 'transparent',
  color: '#6b7280',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid #e5e7eb',
};

const featureGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 24,
  maxWidth: 960,
  margin: '0 auto',
  padding: '0 24px 60px',
};

const featureCard = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 28,
};

const featureIcon = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: '#e6f7f5',
  color: '#2A9D8F',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 14,
};

const featureTitle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#1a2332',
  margin: '0 0 8px',
};

const featureDesc = {
  fontSize: 14,
  color: '#6b7280',
  lineHeight: 1.6,
  margin: 0,
};

const countselSection = {
  background: '#f0fdfa',
  borderTop: '1px solid #ccfbf1',
  borderBottom: '1px solid #ccfbf1',
  padding: '48px 24px',
};

const countselInner = {
  maxWidth: 640,
  margin: '0 auto',
  textAlign: 'center',
};

const countselTitle = {
  fontSize: 24,
  fontWeight: 800,
  color: '#1a2332',
  margin: '0 0 12px',
};

const countselText = {
  fontSize: 16,
  color: '#4b5563',
  lineHeight: 1.7,
  margin: '0 0 24px',
};

const footer = {
  textAlign: 'center',
  padding: '32px 24px',
};

const footerText = {
  fontSize: 13,
  color: '#9ca3af',
  margin: 0,
};
