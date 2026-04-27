/**
 * District Preview Mock Data
 *
 * Deterministic sample data for the "Pitch Your District" demo view.
 * No real students, no IndexedDB writes — pure render-from-static.
 * Numbers are tuned so the demo tells a coherent story:
 *   - One counselor noncompliant with SB 179 (Robert Kim, 72%)
 *   - Two counselors borderline (Sarah Chen 78%, Maria Rodriguez 79%)
 *   - Five counselors compliant (≥80%)
 *   - One campus over ASCA caseload ratio (Magnolia West average 270:1)
 *   - 3 active safety plans pending 30-day review
 *
 * If you change a metric, double-check the rollups still add up.
 */

export const DEMO_DISTRICT = {
  name: 'Sample ISD',
  schoolYear: '2025–26',
  asOfDate: 'as of last Friday',
};

export const DEMO_CAMPUSES = [
  { id: 'c1', name: 'Sample Elementary',      studentCount: 425, counselorCount: 2, ratio: 213 },
  { id: 'c2', name: 'Sample East Elementary', studentCount: 540, counselorCount: 3, ratio: 180 },
  { id: 'c3', name: 'Sample West Elementary', studentCount: 540, counselorCount: 2, ratio: 270 },
];

// Status: 'green' (compliant), 'amber' (borderline), 'red' (noncompliant)
export const DEMO_COUNSELORS = [
  // Sample Elementary
  { id: 'co1', name: 'Nicole Hill',       campus: 'Sample Elementary',      caseload: 215, sessionsThisWeek: 21, sessionsYtd: 482, sb179: 84, openReferrals: 4, docCompleteness: 96, status: 'green',  yearsExperience: 7 },
  { id: 'co2', name: 'Sarah Chen',        campus: 'Sample Elementary',      caseload: 210, sessionsThisWeek: 16, sessionsYtd: 421, sb179: 78, openReferrals: 6, docCompleteness: 88, status: 'amber',  yearsExperience: 3 },
  // Sample East Elementary
  { id: 'co3', name: 'Marcus Davis',      campus: 'Sample East Elementary', caseload: 178, sessionsThisWeek: 22, sessionsYtd: 510, sb179: 87, openReferrals: 3, docCompleteness: 98, status: 'green',  yearsExperience: 12 },
  { id: 'co4', name: 'Jennifer Lopez',    campus: 'Sample East Elementary', caseload: 184, sessionsThisWeek: 19, sessionsYtd: 458, sb179: 82, openReferrals: 4, docCompleteness: 94, status: 'green',  yearsExperience: 5 },
  { id: 'co5', name: 'Robert Kim',        campus: 'Sample East Elementary', caseload: 178, sessionsThisWeek: 14, sessionsYtd: 385, sb179: 72, openReferrals: 5, docCompleteness: 76, status: 'red',    yearsExperience: 1 },
  // Sample West Elementary
  { id: 'co6', name: 'Lisa Anderson',     campus: 'Sample West Elementary', caseload: 268, sessionsThisWeek: 20, sessionsYtd: 487, sb179: 81, openReferrals: 7, docCompleteness: 92, status: 'green',  yearsExperience: 9 },
  { id: 'co7', name: 'Maria Rodriguez',   campus: 'Sample West Elementary', caseload: 272, sessionsThisWeek: 17, sessionsYtd: 432, sb179: 79, openReferrals: 8, docCompleteness: 89, status: 'amber',  yearsExperience: 4 },
];

// District KPIs
export const DEMO_KPIS = {
  studentsServedYtd: 942,
  sessionsYtd: 3175,
  openReferrals: 37,
  hoursLoggedThisMonth: 412,
  sb179DistrictAverage: 80,
  ferpaDeleteRequests: 2,
};

// Crisis Response (SB 11 / suicide prevention compliance)
export const DEMO_CRISIS = {
  suicideScreeningsYtd: 47,
  activeSafetyPlans: 12,
  threatAssessmentsCompleted: 8,
  avgCrisisResponseHours: 1.4,
  pendingSafetyPlanReviews: 3, // safety plans approaching 30-day review
};

// Sessions per month (Aug → April school year)
export const DEMO_MONTHLY_SESSIONS = [
  { month: 'Aug', sessions: 218 },
  { month: 'Sep', sessions: 487 },
  { month: 'Oct', sessions: 541 },
  { month: 'Nov', sessions: 458 },
  { month: 'Dec', sessions: 312 },
  { month: 'Jan', sessions: 489 },
  { month: 'Feb', sessions: 461 },
  { month: 'Mar', sessions: 209 },
];

// Time allocation (district-wide, hours this month)
// Direct + indirect should be ≥ 80% per SB 179
export const DEMO_TIME_ALLOCATION = [
  { category: 'Direct Services',     hours: 247, color: '#22c55e' }, // 60%
  { category: 'Indirect Services',   hours:  82, color: '#16a34a' }, // 20% — so total counseling = 80%
  { category: 'Admin / Non-Counseling', hours: 49, color: '#f59e0b' }, // 12%
  { category: 'Testing Coordination', hours:   21, color: '#ef4444' }, // 5%
  { category: 'Other Duties',         hours:   13, color: '#9ca3af' }, // 3%
];

// Cross-campus comparison
export const DEMO_CAMPUS_COMPARISON = [
  { campus: 'Sample Elementary',      referrals: 32, sessions: 903,  sb179: 81 },
  { campus: 'Sample East Elementary', referrals: 21, sessions: 1353, sb179: 80 },
  { campus: 'Sample West Elementary', referrals: 24, sessions: 919,  sb179: 80 },
];

export const DEMO_ALERTS = [
  {
    severity: 'red',
    title: 'SB 179 noncompliance risk',
    detail: 'Robert Kim is at 72% direct services this month — below SB 179 threshold. Reassign non-counseling duties this week.',
  },
  {
    severity: 'amber',
    title: 'Caseload over ASCA 250:1 recommendation',
    detail: 'Sample West Elementary averages 270:1. ASCA recommends 250:1. Consider adding a counselor at next budget cycle.',
  },
  {
    severity: 'amber',
    title: 'Active safety plans pending 30-day review',
    detail: '3 students with active safety plans require 30-day check-ins this week. Assigned: Lisa Anderson, Maria Rodriguez.',
  },
  {
    severity: 'amber',
    title: 'Documentation completeness below 80%',
    detail: 'Robert Kim at 76% completeness on session notes. Targeted coaching recommended.',
  },
];

// Caseload by tier (district-wide)
export const DEMO_CASELOAD_BY_TIER = [
  { tier: 'Tier 1 (Universal)',  count: 1380, color: '#22c55e' },
  { tier: 'Tier 2 (Targeted)',   count:  124, color: '#f59e0b' },
  { tier: 'Tier 3 (Intensive)',  count:   41, color: '#ef4444' },
];

// CREST Award portfolio readiness per counselor.
// crestPct = pct of suggested artifact types covered across the 5 Texas Model categories.
// crestAuto = how many were auto-derived from Beacon vs entered manually.
// Numbers tuned to mirror the rest of the demo: high performers near 90%+, Robert Kim trailing.
export const DEMO_CREST_READINESS = [
  { counselorId: 'co1', counselorName: 'Nicole Hill',     campus: 'Sample Elementary',      crestPct: 91, crestAuto: 7, crestManual: 12 },
  { counselorId: 'co2', counselorName: 'Sarah Chen',      campus: 'Sample Elementary',      crestPct: 73, crestAuto: 6, crestManual:  8 },
  { counselorId: 'co3', counselorName: 'Marcus Davis',    campus: 'Sample East Elementary', crestPct: 95, crestAuto: 7, crestManual: 14 },
  { counselorId: 'co4', counselorName: 'Jennifer Lopez',  campus: 'Sample East Elementary', crestPct: 86, crestAuto: 7, crestManual: 11 },
  { counselorId: 'co5', counselorName: 'Robert Kim',      campus: 'Sample East Elementary', crestPct: 41, crestAuto: 5, crestManual:  3 },
  { counselorId: 'co6', counselorName: 'Lisa Anderson',   campus: 'Sample West Elementary', crestPct: 82, crestAuto: 7, crestManual: 10 },
  { counselorId: 'co7', counselorName: 'Maria Rodriguez', campus: 'Sample West Elementary', crestPct: 77, crestAuto: 6, crestManual:  9 },
];

// District-wide CREST roll-up — average of per-counselor pct + total artifact counts.
export const DEMO_CREST_DISTRICT = (() => {
  const n = DEMO_CREST_READINESS.length;
  const avg = Math.round(DEMO_CREST_READINESS.reduce((s, c) => s + c.crestPct, 0) / n);
  const totalAuto = DEMO_CREST_READINESS.reduce((s, c) => s + c.crestAuto, 0);
  const totalManual = DEMO_CREST_READINESS.reduce((s, c) => s + c.crestManual, 0);
  const onTrack = DEMO_CREST_READINESS.filter((c) => c.crestPct >= 80).length;
  const atRisk = DEMO_CREST_READINESS.filter((c) => c.crestPct < 60).length;
  return { avgPct: avg, totalAuto, totalManual, total: totalAuto + totalManual, onTrack, atRisk, counselorCount: n };
})();
