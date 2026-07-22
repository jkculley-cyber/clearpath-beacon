/* ─── Beacon Constants ─── */

export const CONCERN_TYPES = [
  'Academic',
  'Behavioral',
  'Social-Emotional',
  'Family Situation',
  'Attendance',
  'Crisis',
  'Self-Referral',
];

export const URGENCY_LEVELS = ['Routine', 'Soon', 'Urgent'];

export const ASCA_DOMAINS = ['Academic', 'Career', 'Social-Emotional'];

export const PROGRESS_LEVELS = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Demonstrating',
};

export const PROGRESS_COLORS = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#22c55e',
};

export const CONTACT_TYPES = [
  'Phone call',
  'Email',
  'Text / SMS',
  'Parent conference',
  'Certified mail',
  'Written notice',
  'Progress report',
  'No contact — attempted',
];

export const TIME_DOMAINS = {
  guidance: 'Guidance Curriculum',
  planning: 'Individual Student Planning',
  responsive: 'Responsive Services',
  system: 'System Support',
  non_counseling: 'Non-Counseling Duties',
};

export const ROTATION_TYPES = {
  weekly_abc: 'Weekly A/B/C',
  biweekly: 'Bi-weekly',
};

export const SESSION_STATUSES = [
  'Scheduled',
  'Completed',
  'Cancelled',
  'Make-up Needed',
];

export const REFERRAL_STATUSES = ['open', 'in_progress', 'closed'];

export const STUDENT_STATUSES = ['active', 'inactive', 'transferred'];

export const MTSS_TIERS = [1, 2, 3];

/* ─── Grade bands ───
 * Beacon is one product; the counselor picks the band they serve at setup.
 * SB 179 / TEC §33.006 (80/20) applies to ALL Texas public-school counselors,
 * so the compliance ring is identical across bands — only the grade list,
 * promotion ladder, and default content differ. */
export const DEFAULT_GRADE_BAND = 'elementary';

export const GRADE_BANDS = {
  elementary: { key: 'elementary', label: 'Elementary', short: 'K–5', grades: ['K', '1', '2', '3', '4', '5'] },
  middle: { key: 'middle', label: 'Middle', short: '6–8', grades: ['6', '7', '8'] },
  high: { key: 'high', label: 'High', short: '9–12', grades: ['9', '10', '11', '12'] },
};

export const GRADE_BAND_KEYS = ['elementary', 'middle', 'high'];

// Ordered union of every grade, used for combined-campus (served_grades) ranges.
export const ALL_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/* Resolve the grade list for a counselor.
 * Priority: explicit served_grades range → band preset → elementary default.
 * `counselor` may be the counselor record, a band key string, or null. */
export function getGrades(counselor) {
  if (typeof counselor === 'string') {
    return (GRADE_BANDS[counselor] || GRADE_BANDS[DEFAULT_GRADE_BAND]).grades;
  }
  const c = counselor || {};
  if (c.served_grades && c.served_grades.min && c.served_grades.max) {
    const lo = ALL_GRADES.indexOf(c.served_grades.min);
    const hi = ALL_GRADES.indexOf(c.served_grades.max);
    if (lo !== -1 && hi !== -1 && lo <= hi) return ALL_GRADES.slice(lo, hi + 1);
  }
  const band = GRADE_BANDS[c.grade_band] || GRADE_BANDS[DEFAULT_GRADE_BAND];
  return band.grades;
}

export function getGradeBand(counselor) {
  if (typeof counselor === 'string') return GRADE_BANDS[counselor] ? counselor : DEFAULT_GRADE_BAND;
  return (counselor && GRADE_BANDS[counselor.grade_band]) ? counselor.grade_band : DEFAULT_GRADE_BAND;
}

/* Year-end promotion map for a counselor's grade list.
 * Each grade promotes to the next; the band's TOP grade maps to the terminal
 * sentinel 'Graduated' — in a single-counselor tool the top grade always exits
 * the caseload (elementary 5th → middle school, middle 8th → high school, high
 * 12th → graduated). The EOY transition treats 'Graduated' as "exits caseload." */
export function getPromotionLadder(counselor) {
  const grades = getGrades(counselor);
  const ladder = {};
  for (let i = 0; i < grades.length - 1; i++) ladder[grades[i]] = grades[i + 1];
  ladder[grades[grades.length - 1]] = 'Graduated';
  return ladder;
}

// The band's top grade — the one that exits the caseload at year-end.
export function topGradeLabel(counselor) {
  const grades = getGrades(counselor);
  return gradeLabel(grades[grades.length - 1]);
}

// Ordinal display for a grade value (band-independent).
export function gradeLabel(g) {
  if (g === 'K') return 'Kindergarten';
  const suffix = g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th';
  return `${g}${suffix} Grade`;
}
