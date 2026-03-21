import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';

/*
 * "How am I doing?" Scorecard
 *
 * Analyzes a counselor's complete Beacon usage and provides targeted,
 * actionable feedback across 6 categories. Each category scores 0-100
 * and maps to a letter grade with a specific recommendation.
 *
 * Designed to surface once per week (dismissible for 7 days) and
 * always available via Dashboard.
 */

const DISMISS_KEY = 'beacon_scorecard_dismissed_until';

/* ── Category definitions ── */

function gradeFor(score) {
  if (score >= 90) return { letter: 'A', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  if (score >= 80) return { letter: 'B', color: '#2A9D8F', bg: '#f0fdfa', border: '#99f6e4' };
  if (score >= 70) return { letter: 'C', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' };
  if (score >= 60) return { letter: 'D', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
  return { letter: 'F', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
}

function overallGrade(categories) {
  const avg = categories.reduce((s, c) => s + c.score, 0) / categories.length;
  return { score: Math.round(avg), ...gradeFor(Math.round(avg)) };
}

/* ── Scoring engine ── */

async function computeScorecard(counselorId, counselor) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const schoolYearStart = counselor?.school_year_start
    || (now.getMonth() >= 7 ? `${now.getFullYear()}-08-01` : `${now.getFullYear() - 1}-08-01`);

  const [
    studentsRes,
    sessionsRes,
    sessions30Res,
    referralsOpenRes,
    referralsAllRes,
    timeRes,
    commsRes,
    groupsRes,
  ] = await Promise.all([
    db.select('students', { eq: { counselor_id: counselorId, status: 'active' } }),
    db.select('sessions', { eq: { counselor_id: counselorId }, gte: { session_date: schoolYearStart } }),
    db.select('sessions', { eq: { counselor_id: counselorId }, gte: { session_date: thirtyDaysAgo } }),
    db.select('referrals', { eq: { status: 'open' } }),
    db.select('referrals', { eq: { counselor_id: counselorId } }),
    db.select('time_entries', { eq: { counselor_id: counselorId }, gte: { entry_date: schoolYearStart } }),
    db.select('communications', { eq: { counselor_id: counselorId }, gte: { contact_date: thirtyDaysAgo } }),
    db.select('groups', { eq: { counselor_id: counselorId, status: 'active' } }),
  ]);

  const students = studentsRes.data || [];
  const sessionsAll = sessionsRes.data || [];
  const sessions30 = sessions30Res.data || [];
  const referralsOpen = referralsOpenRes.data || [];
  const referralsAll = referralsAllRes.data || [];
  const timeEntries = timeRes.data || [];
  const comms30 = commsRes.data || [];
  const groups = groupsRes.data || [];

  const categories = [];

  // ── 1. Session Cadence ──
  // How consistently are you meeting with students?
  const sessionsLast30 = sessions30.filter(s => s.status === 'Completed').length;
  const weeksActive = Math.max(1, Math.ceil((now - new Date(schoolYearStart)) / (7 * 86400000)));
  const sessionsPerWeek = sessionsAll.filter(s => s.status === 'Completed').length / weeksActive;
  let cadenceScore, cadenceTip;
  if (sessionsPerWeek >= 15) { cadenceScore = 95; cadenceTip = 'Outstanding cadence. You\'re averaging ' + sessionsPerWeek.toFixed(0) + ' sessions/week.'; }
  else if (sessionsPerWeek >= 10) { cadenceScore = 85; cadenceTip = sessionsPerWeek.toFixed(0) + ' sessions/week is solid. Push for 15+ to maximize impact.'; }
  else if (sessionsPerWeek >= 5) { cadenceScore = 70; cadenceTip = sessionsPerWeek.toFixed(0) + ' sessions/week. Can you add 2 more small group sessions per week?'; }
  else if (sessionsPerWeek >= 2) { cadenceScore = 55; cadenceTip = 'Only ' + sessionsPerWeek.toFixed(0) + ' sessions/week. Your students need more contact time. Start with one group a day.'; }
  else { cadenceScore = 30; cadenceTip = sessionsLast30 === 0 ? 'No sessions logged in 30 days. Open a student and tap "Log Session" after your next meeting.' : 'Very low session count. Try logging every student interaction — even brief check-ins count.'; }
  categories.push({ key: 'cadence', label: 'Session Cadence', score: cadenceScore, tip: cadenceTip, icon: '📅' });

  // ── 2. Student Coverage ──
  // What % of your caseload have you seen in the last 30 days?
  const studentsSeen30 = new Set(sessions30.filter(s => s.student_id).map(s => s.student_id));
  // Also count group sessions — students in those groups count as seen
  const groupSessionIds30 = sessions30.filter(s => s.group_id).map(s => s.group_id);
  // We don't have attendance data here easily, so just use direct student sessions
  const coveragePct = students.length > 0 ? Math.round((studentsSeen30.size / students.length) * 100) : 0;
  let coverageScore, coverageTip;
  if (students.length === 0) { coverageScore = 50; coverageTip = 'No students in your caseload yet. Add students to start tracking coverage.'; }
  else if (coveragePct >= 80) { coverageScore = 95; coverageTip = coveragePct + '% of your caseload seen this month. Excellent coverage.'; }
  else if (coveragePct >= 60) { coverageScore = 80; coverageTip = coveragePct + '% coverage. ' + (students.length - studentsSeen30.size) + ' students haven\'t been seen in 30 days.'; }
  else if (coveragePct >= 40) { coverageScore = 65; coverageTip = 'Only ' + coveragePct + '% of students seen this month. Consider scheduling brief check-ins for the students you\'re missing.'; }
  else { coverageScore = 40; coverageTip = coveragePct + '% coverage is a red flag. ' + (students.length - studentsSeen30.size) + ' students are overdue. Prioritize Tier 2/3 students.'; }
  categories.push({ key: 'coverage', label: 'Student Coverage', score: coverageScore, tip: coverageTip, icon: '👥' });

  // ── 3. 80/20 Compliance ──
  const totalMin = timeEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const counselingMin = timeEntries.filter(e => ['guidance', 'planning', 'responsive'].includes(e.domain)).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const compliancePct = totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : 0;
  let complianceScore, complianceTip;
  if (totalMin === 0) { complianceScore = 30; complianceTip = 'No time entries logged. Open Time Tracker and log today\'s activities — this powers your SB 179 compliance proof.'; }
  else if (compliancePct >= 82) { complianceScore = 95; complianceTip = compliancePct + '% counseling time. You\'re above the 80% SB 179 threshold. Keep it up.'; }
  else if (compliancePct >= 78) { complianceScore = 75; complianceTip = compliancePct + '% — close to the 80% threshold but not there yet. Reduce non-counseling duties where possible.'; }
  else if (compliancePct >= 70) { complianceScore = 55; complianceTip = compliancePct + '% is below compliance. Talk to your admin about reducing non-counseling assignments.'; }
  else { complianceScore = 35; complianceTip = compliancePct + '% counseling time means most of your day is non-counseling duties. This needs admin attention.'; }
  categories.push({ key: 'compliance', label: 'SB 179 Compliance', score: complianceScore, tip: complianceTip, icon: '⚖️' });

  // ── 4. Referral Responsiveness ──
  const oldestOpen = referralsOpen.reduce((oldest, r) => {
    const d = new Date(r.created_at || r.submitted_at);
    return d < oldest ? d : oldest;
  }, new Date());
  const daysOldest = referralsOpen.length > 0 ? Math.floor((now - oldestOpen) / 86400000) : 0;
  let referralScore, referralTip;
  if (referralsOpen.length === 0 && referralsAll.length > 0) { referralScore = 95; referralTip = 'All referrals addressed. Zero open queue. Teachers will love you.'; }
  else if (referralsOpen.length === 0) { referralScore = 80; referralTip = 'No referrals yet. Share the referral form link with teachers so they can refer students to you.'; }
  else if (daysOldest <= 3) { referralScore = 85; referralTip = referralsOpen.length + ' open referral(s), newest is ' + daysOldest + ' day(s) old. Good response time.'; }
  else if (daysOldest <= 7) { referralScore = 65; referralTip = referralsOpen.length + ' referral(s) waiting. Oldest is ' + daysOldest + ' days. Try to respond within 3 days.'; }
  else { referralScore = 40; referralTip = referralsOpen.length + ' referral(s) open, oldest is ' + daysOldest + ' days. Teachers lose trust when referrals sit. Address these today.'; }
  categories.push({ key: 'referrals', label: 'Referral Response', score: referralScore, tip: referralTip, icon: '📨' });

  // ── 5. Documentation Quality ──
  // Are you logging contacts, notes, progress ratings?
  const hasComms = comms30.length > 0;
  const sessionsWithNotes = sessions30.filter(s => s.notes && s.notes.trim().length > 10).length;
  const noteRatio = sessions30.length > 0 ? sessionsWithNotes / sessions30.length : 0;
  let docScore, docTip;
  if (sessions30.length === 0) { docScore = 40; docTip = 'No sessions logged recently. Documentation starts with logging sessions — even brief ones.'; }
  else if (noteRatio >= 0.7 && hasComms) { docScore = 95; docTip = Math.round(noteRatio * 100) + '% of sessions have notes + ' + comms30.length + ' parent contacts this month. Strong documentation.'; }
  else if (noteRatio >= 0.5) { docScore = 75; docTip = Math.round(noteRatio * 100) + '% of sessions have notes. Add brief notes to every session — it takes 15 seconds and protects you.'; }
  else if (noteRatio >= 0.2) { docScore = 55; docTip = 'Only ' + Math.round(noteRatio * 100) + '% of sessions have notes. If it goes to ARD or RTI, you\'ll need this documentation.'; }
  else { docScore = 35; docTip = 'Almost no session notes. Add even one sentence per session — "Discussed coping strategies, student engaged" is enough.'; }
  categories.push({ key: 'documentation', label: 'Documentation', score: docScore, tip: docTip, icon: '📋' });

  // ── 6. Data Safety ──
  const lastBackup = localStorage.getItem('beacon_last_backup');
  const daysSinceBackup = lastBackup ? Math.floor((now - new Date(lastBackup)) / 86400000) : 999;
  let safetyScore, safetyTip;
  if (daysSinceBackup <= 7) { safetyScore = 95; safetyTip = 'Backed up ' + daysSinceBackup + ' day(s) ago. Your data is safe.'; }
  else if (daysSinceBackup <= 14) { safetyScore = 75; safetyTip = 'Last backup was ' + daysSinceBackup + ' days ago. Back up weekly to protect your work.'; }
  else if (daysSinceBackup <= 30) { safetyScore = 50; safetyTip = daysSinceBackup + ' days since your last backup. Your data could be lost if the browser cache is cleared. Back up now in Settings.'; }
  else { safetyScore = 20; safetyTip = lastBackup ? 'Your backup is over a month old.' : 'You\'ve never backed up. If your browser cache is cleared, everything is gone. Go to Settings → Export Backup now.'; }
  categories.push({ key: 'safety', label: 'Data Safety', score: safetyScore, tip: safetyTip, icon: '🛡️' });

  return categories;
}

/* ── Component ── */

export default function Scorecard({ counselorId, counselor }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const until = localStorage.getItem(DISMISS_KEY);
    return until && new Date(until) > new Date();
  });

  const load = useCallback(async () => {
    if (!counselorId) return;
    const cats = await computeScorecard(counselorId, counselor);
    setCategories(cats);
  }, [counselorId, counselor]);

  useEffect(() => { load(); }, [load]);

  if (!categories || dismissed) return null;

  const overall = overallGrade(categories);
  const weakest = [...categories].sort((a, b) => a.score - b.score)[0];
  const needsAttention = categories.filter(c => c.score < 70);

  function dismissForWeek() {
    const until = new Date(Date.now() + 7 * 86400000).toISOString();
    localStorage.setItem(DISMISS_KEY, until);
    setDismissed(true);
  }

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: overall.bg, border: `2px solid ${overall.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: overall.color,
          }}>
            {overall.letter}
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', margin: '0 0 2px' }}>How am I doing?</h2>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Overall: {overall.score}/100 &middot; {needsAttention.length === 0 ? 'All areas on track' : needsAttention.length + ' area' + (needsAttention.length > 1 ? 's' : '') + ' need attention'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setExpanded(v => !v)} style={styles.toggleBtn}>
            {expanded ? 'Collapse' : 'Details'}
          </button>
          <button onClick={dismissForWeek} style={{ ...styles.toggleBtn, color: '#9ca3af' }}>
            Remind me next week
          </button>
        </div>
      </div>

      {/* Priority tip — always visible */}
      {weakest && weakest.score < 80 && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 8,
          background: gradeFor(weakest.score).bg,
          border: `1px solid ${gradeFor(weakest.score).border}`,
          fontSize: 13, color: gradeFor(weakest.score).color, lineHeight: 1.5,
        }}>
          <strong>{weakest.icon} {weakest.label}:</strong> {weakest.tip}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map(cat => {
            const grade = gradeFor(cat.score);
            return (
              <div key={cat.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: grade.bg, border: `1px solid ${grade.border}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#fff', border: `1px solid ${grade.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: grade.color, flexShrink: 0,
                }}>
                  {grade.letter}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{cat.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a2332' }}>{cat.label}</span>
                    <span style={{ fontSize: 12, color: grade.color, fontWeight: 700, marginLeft: 'auto' }}>{cat.score}/100</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{cat.tip}</div>
                </div>
              </div>
            );
          })}

          {/* Action button for weakest area */}
          {weakest && weakest.score < 70 && (
            <button
              onClick={() => {
                const paths = { cadence: '/students', coverage: '/students', compliance: '/time-tracker', referrals: '/referrals', documentation: '/students', safety: '/settings' };
                navigate(paths[weakest.key] || '/');
              }}
              style={styles.actionBtn}
            >
              Improve {weakest.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  toggleBtn: {
    background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
    padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#2A9D8F',
    cursor: 'pointer',
  },
  actionBtn: {
    width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
    background: '#2A9D8F', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
  },
};
