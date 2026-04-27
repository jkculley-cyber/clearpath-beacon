import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { db, isLocalMode } from '../lib/db';
import { CONCERN_TYPES, URGENCY_LEVELS } from '../lib/constants';

// Cloudflare Turnstile — bot/spam gate on the public referral form.
// The site key is PUBLIC by design (Cloudflare embeds it client-side; the
// secret key — separate value — is what stays server-side and is never
// shipped). The env var path is preferred, but if it's empty for any
// reason (Cloudflare Pages env-var quirks, dev mode, broken configs) we
// fall back to the hardcoded site key so the widget always renders.
//
// To rotate: register a new Turnstile site, paste the new public key here,
// and update VITE_TURNSTILE_SITE_KEY in Cloudflare Pages env. The env var
// wins when set.
const TURNSTILE_FALLBACK_KEY = '0x4AAAAAADEgqoGSVgO0m4aE';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || TURNSTILE_FALLBACK_KEY;

const GRADES = ['K', '1', '2', '3', '4', '5'];

// Length caps — keep referrals well under the IndexedDB / Supabase row size limit
// and short enough that a flooding attack can't pump huge payloads through.
const MAX_NAME_LEN = 100;
const MAX_TEACHER_LEN = 100;
const MAX_NOTES_LEN = 2000;

// Per-browser rate limit: max 5 submissions in any 10-minute rolling window.
// A determined attacker can clear localStorage to reset, but this stops the
// trivial form-spam case + accidental double-clicks.
const RATE_LIMIT_KEY = 'beacon_referral_rate_log';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function recordSubmissionAndCheckRate() {
  let log = [];
  try {
    log = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
  } catch { log = []; }
  const now = Date.now();
  log = log.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (log.length >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMin: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - log[0])) / 60000) };
  }
  log.push(now);
  try { localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(log)); } catch { /* private mode */ }
  return { allowed: true, retryAfterMin: 0 };
}

/**
 * ReferralFormPage — public form, two transport modes:
 *   1. mailto mode (default for individual / local-mode counselors):
 *      URL: /referral-form?to=counselor@email.com&n=Counselor+Name
 *      Submission opens the teacher's email client with a structured body.
 *      Counselor pastes the email content into Beacon's "Import from Email" feature.
 *      Zero data ever touches Clear Path infrastructure.
 *   2. cloud mode (district-licensed counselors):
 *      URL: /referral-form?c=COUNSELOR_UUID
 *      Submission writes directly to Supabase referrals table.
 */
export default function ReferralFormPage() {
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [concernType, setConcernType] = useState('');
  const [urgency, setUrgency] = useState('');
  const [harmToSelf, setHarmToSelf] = useState(false);
  const [harmToOthers, setHarmToOthers] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mailtoOpened, setMailtoOpened] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileWidgetRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const counselorEmail = params.get('to') || '';
  const counselorName = params.get('n') || 'your counselor';
  const counselorIdParam = params.get('c') || '';

  // Lazy-load Turnstile script + render widget into the placeholder div.
  // The script auto-discovers any element with class="cf-turnstile". We use
  // explicit render via the JS API so the callback can update React state.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let widgetId = null;
    const renderWidget = () => {
      if (!window.turnstile || !turnstileWidgetRef.current) return;
      widgetId = window.turnstile.render(turnstileWidgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
        theme: 'light',
        size: 'normal',
      });
    };
    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector('script[data-beacon-turnstile]');
      if (!existing) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__beaconTurnstileLoad';
        s.async = true;
        s.defer = true;
        s.dataset.beaconTurnstile = '1';
        window.__beaconTurnstileLoad = renderWidget;
        document.head.appendChild(s);
      } else {
        // Script already loading — register our render callback to fire on load
        const prior = window.__beaconTurnstileLoad;
        window.__beaconTurnstileLoad = () => { prior?.(); renderWidget(); };
      }
    }
    return () => {
      if (widgetId && window.turnstile) {
        try { window.turnstile.remove(widgetId); } catch { /* noop */ }
      }
    };
  }, []);

  // Mailto mode: when a counselor email is in the URL, the form relays via the teacher's email client.
  // No Clear Path infrastructure handles the data.
  const isMailtoMode = !!counselorEmail;

  const isSafetyAlert = harmToSelf || harmToOthers || urgency === 'Urgent' || concernType === 'Crisis';

  const buildEmailBody = () => {
    const headerLine = isSafetyAlert
      ? '*** SAFETY ALERT — REVIEW IMMEDIATELY *** A teacher has submitted a student referral that may require urgent attention.'
      : 'A teacher submitted a student referral via Beacon. Forward to your counselor inbox or paste the block below into Beacon → Referrals → Import from Email.';
    const lines = [
      headerLine,
      '',
      '--- BEACON REFERRAL ---',
      `Student: ${studentName}`,
      `Grade: ${grade}`,
      `Teacher: ${teacherName || '(not provided)'}`,
      `Concern: ${concernType}`,
      `Urgency: ${urgency}`,
      `Harm to Self: ${harmToSelf ? 'yes' : 'no'}`,
      `Harm to Others: ${harmToOthers ? 'yes' : 'no'}`,
      `Notes: ${notes || '(none)'}`,
      `Submitted: ${new Date().toISOString().slice(0, 10)}`,
      '--- END BEACON REFERRAL ---',
    ];
    return lines.join('\n');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Length caps — defense against payload-flooding attacks
    if ((studentName || '').length > MAX_NAME_LEN
        || (teacherName || '').length > MAX_TEACHER_LEN
        || (notes || '').length > MAX_NOTES_LEN) {
      setError('Some fields exceed the maximum length. Trim before submitting.');
      setSubmitting(false);
      return;
    }

    // Per-browser rate limit — 5 submissions per 10 minutes
    const rate = recordSubmissionAndCheckRate();
    if (!rate.allowed) {
      setError(`Too many recent submissions from this device. Try again in ~${rate.retryAfterMin} minute${rate.retryAfterMin === 1 ? '' : 's'}.`);
      setSubmitting(false);
      return;
    }

    // Cloudflare Turnstile gate — only enforced when a site key is configured.
    // The token is submitted alongside the referral so an Edge Function can
    // verify it server-side via the Turnstile siteverify endpoint when one
    // is wired up. For now, presence of the token is enough to break trivial
    // automated flooding (requires a real browser to solve the challenge).
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the bot-check below before submitting.');
      setSubmitting(false);
      return;
    }

    if (isMailtoMode) {
      // Build mailto: with structured body. Open in teacher's email client.
      // Prefix [SAFETY ALERT] when the teacher checked harm-to-self / harm-to-others
      // or marked the referral Urgent / Crisis — the alert is visible in the inbox preview
      // before the counselor even opens the email.
      const alertPrefix = isSafetyAlert ? '🚨 [SAFETY ALERT] ' : '';
      const subject = `${alertPrefix}Beacon Referral — ${studentName} (${urgency})`;
      const body = buildEmailBody();
      const href = `mailto:${encodeURIComponent(counselorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = href;
      setMailtoOpened(true);
      setSubmitting(false);
      setSubmitted(true);
      return;
    }

    // Cloud mode (existing behavior) — direct insert.
    // Note: the Turnstile token validates that this submission came from a
    // real browser; once the token is collected the gate has done its job.
    // We don't persist the token (no column on referrals; would 400 the insert).
    // A future Edge Function in front of the insert can call Turnstile
    // siteverify with the token before relaying to Supabase.
    const referralData = {
      student_name: studentName,
      grade,
      teacher_name: teacherName,
      concern_type: concernType,
      urgency,
      harm_to_self: harmToSelf,
      harm_to_others: harmToOthers,
      notes: notes || null,
      status: 'open',
    };

    if (isLocalMode()) {
      const localCounselorId = localStorage.getItem('beacon_local_counselor_id');
      if (localCounselorId) referralData.counselor_id = localCounselorId;
    } else if (counselorIdParam) {
      referralData.counselor_id = counselorIdParam;
    }

    const { error: err } = isLocalMode()
      ? await db.insert('referrals', referralData)
      : await supabase.from('referrals').insert(referralData);

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  const copyEmailBody = async () => {
    try {
      await navigator.clipboard.writeText(buildEmailBody());
    } catch { /* ignore */ }
  };

  if (submitted) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.brandRow}>
            <div style={styles.logoCircle}>
              <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="16" stroke="#fff" strokeWidth="2" />
                <path d="M18 6 L18 30 M10 14 L18 6 L26 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={styles.brand}>Beacon</h1>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '0 0 8px' }}>
              {isMailtoMode ? 'Email Opened' : 'Referral Submitted'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
              {isMailtoMode
                ? <>Your email client should have opened with the referral pre-filled to <strong>{counselorName}</strong>. <strong>Click Send</strong> to deliver it.</>
                : 'Thank you. The school counselor will review this referral and follow up as needed.'}
            </p>

            {isMailtoMode && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 12, color: '#6b7280', textAlign: 'left', marginBottom: 16 }}>
                <strong>Email didn't open?</strong> Copy the referral text and email it to <strong>{counselorEmail}</strong> manually.
                <button onClick={copyEmailBody} className="btn btn-outline" style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', width: '100%' }}>
                  Copy Referral Text
                </button>
              </div>
            )}

            <button onClick={() => { setSubmitted(false); setMailtoOpened(false); setStudentName(''); setGrade(''); setTeacherName(''); setConcernType(''); setUrgency(''); setHarmToSelf(false); setHarmToOthers(false); setNotes(''); }}
              className="btn btn-primary" style={{ marginTop: 8 }}>
              Submit Another Referral
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.logoCircle}>
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="16" stroke="#fff" strokeWidth="2" />
              <path d="M18 6 L18 30 M10 14 L18 6 L26 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={styles.brand}>Beacon</h1>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', textAlign: 'center', margin: '0 0 4px' }}>
          Student Referral Form
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
          {isMailtoMode
            ? <>This referral will be sent to <strong>{counselorName}</strong> via your email client. No data is stored on any server.</>
            : 'Use this form to refer a student to the school counselor.'}
        </p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="form-label">Student Name *</label>
          <input className="form-input" required maxLength={MAX_NAME_LEN} value={studentName} onChange={(e) => setStudentName(e.target.value.slice(0, MAX_NAME_LEN))} placeholder="First and last name" style={{ marginBottom: 12 }} />

          <label className="form-label">Grade *</label>
          <select className="form-input" required value={grade} onChange={(e) => setGrade(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Select grade...</option>
            {GRADES.map((g) => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`}</option>)}
          </select>

          <label className="form-label">Your Name (Teacher)</label>
          <input className="form-input" maxLength={MAX_TEACHER_LEN} value={teacherName} onChange={(e) => setTeacherName(e.target.value.slice(0, MAX_TEACHER_LEN))} placeholder="Your name" style={{ marginBottom: 12 }} />

          <label className="form-label">Concern Category *</label>
          <select className="form-input" required value={concernType} onChange={(e) => setConcernType(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Select concern...</option>
            {CONCERN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="form-label">Urgency *</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {URGENCY_LEVELS.map((u) => {
              const colors = { Routine: '#6b7280', Soon: '#f59e0b', Urgent: '#ef4444' };
              const active = urgency === u;
              return (
                <button key={u} type="button" onClick={() => setUrgency(u)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${active ? colors[u] : '#d1d5db'}`,
                  background: active ? colors[u] + '15' : '#fff',
                  color: active ? colors[u] : '#6b7280',
                }}>
                  {u}
                </button>
              );
            })}
          </div>

          {/* Safety concerns — escalates to a prominent alert in the counselor's queue + global banner. */}
          <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true">⚠️</span>
              <span>Safety Concerns</span>
            </div>
            <p style={{ fontSize: 12, color: '#7f1d1d', margin: '0 0 10px', lineHeight: 1.5 }}>
              <strong>If a student is in immediate danger, call 911 first.</strong> Then submit this referral so the counselor has a record.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#7f1d1d', marginBottom: 8, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={harmToSelf} onChange={(e) => setHarmToSelf(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>This concern involves <strong>possible harm to self</strong> (suicide ideation, self-injury, etc.)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#7f1d1d', cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={harmToOthers} onChange={(e) => setHarmToOthers(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>This concern involves <strong>possible harm to others</strong> (threats, weapons, violence)</span>
            </label>
            {(harmToSelf || harmToOthers) && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                This referral will be flagged as a SAFETY ALERT to the counselor's attention.
              </div>
            )}
          </div>

          <label className="form-label">Additional Notes <span style={{ fontWeight: 400, color: '#9ca3af' }}>({notes.length}/{MAX_NOTES_LEN})</span></label>
          <textarea className="form-input" rows={4} maxLength={MAX_NOTES_LEN} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LEN))} placeholder="Describe the concern, what you have observed, and any steps already taken..." style={{ marginBottom: 24 }} />

          {TURNSTILE_SITE_KEY && (
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <div ref={turnstileWidgetRef} />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !urgency || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
            style={{ width: '100%' }}
          >
            {submitting ? (isMailtoMode ? 'Opening email...' : 'Submitting...') : (isMailtoMode ? 'Open Email to Send' : 'Submit Referral')}
          </button>

          {isMailtoMode && (
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
              Your email client will open with the referral pre-filled. You'll need to click <strong>Send</strong> to deliver it.
            </p>
          )}
        </form>
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
        Beacon by Clear Path Education Group
      </p>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f5 100%)', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 500, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 16, padding: '36px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  brandRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16,
  },
  logoCircle: {
    width: 40, height: 40, borderRadius: '50%', background: '#2A9D8F',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brand: {
    fontSize: 22, fontWeight: 700, color: '#2A9D8F', margin: 0,
  },
};
