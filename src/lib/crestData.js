/**
 * CREST Award Tracking — Texas School Counselor Association.
 *
 * "Counselors Reinforcing Excellence for Students in Texas" (CREST) is sponsored
 * by TSCA and awarded to school counseling programs that demonstrate effective
 * communication and a commitment to obtaining results, evaluated against the
 * five categories of the Texas Model for Comprehensive School Counseling
 * Programs.
 *
 * Applications are due November 1 annually. Three consecutive wins = CREST
 * Leadership Level. Leadership + conference presentation = CREST Advocacy Level.
 *
 * Beacon's CREST page is a year-long evidence collection workspace so counselors
 * can build the portfolio as they work, not scramble in October.
 *
 * This module is the single source of truth for category labels, suggested
 * artifact types, and progress calculation. Used by:
 *   - src/pages/CrestPage.jsx
 *   - src/pages/CrestCategoryPage.jsx (drill-down)
 *   - future: District Preview rollup
 *
 * Source: TSCA / Texas Model for Comprehensive School Counseling Programs (5e).
 * https://www.txca.org/education/education-conferences/pscc/pscc-crest
 */

export const CREST_CATEGORIES = [
  {
    key: 'intro',
    number: 1,
    title: 'Introduction to the School and the Role of the Professional School Counselor',
    short: 'Introduction & Role',
    color: '#2A9D8F',
    description: 'Establishes context: who you serve, where you work, and the role of professional school counselors on this campus.',
    suggestedArtifacts: [
      { type: 'school_demographics',    label: 'School Demographics & Profile',                hint: 'Enrollment, grade levels served, demographic breakdown, special programs.' },
      { type: 'counselor_role',         label: 'Counselor Role Description',                   hint: 'Job description aligned to the Texas Model. Distinguish counselor work from non-counseling duties.' },
      { type: 'principal_letter',       label: 'Letter from Principal',                        hint: 'Endorsement of the program; how the counselor is supported and integrated into campus leadership.' },
      { type: 'team_org_chart',         label: 'Counseling Team Org Chart',                    hint: 'Visual showing counselor(s), assistants, support staff, and reporting structure.' },
      { type: 'counselor_calendar',     label: 'Counselor Calendar / Master Schedule',         hint: 'Weekly or monthly calendar showing direct services, indirect services, planning, etc.' },
    ],
  },
  {
    key: 'cycle',
    number: 2,
    title: 'Program Implementation Cycle',
    short: 'Implementation Cycle',
    color: '#6366f1',
    description: 'Plan → Implement → Evaluate → Communicate. Demonstrates how the program is run and improved over time.',
    suggestedArtifacts: [
      { type: 'annual_plan',            label: 'Annual Counseling Program Plan',               hint: 'Goals, objectives, calendar of major activities for the year.' },
      { type: 'use_of_time',            label: 'Use of Time Analysis (SB 179 / 80-20)',        hint: 'Direct + indirect counseling vs. non-counseling time. Beacon\'s Time Tracker generates this.' },
      { type: 'midyear_check',          label: 'Mid-Year Progress Check',                       hint: 'Where you stand against annual goals as of January.' },
      { type: 'eoy_evaluation',         label: 'End-of-Year Program Evaluation',                hint: 'Outcome data, what worked, what to change next year.' },
      { type: 'communication_log',      label: 'Communication Artifacts',                       hint: 'Newsletters, parent emails, faculty announcements showing counseling visibility.' },
    ],
  },
  {
    key: 'foundation',
    number: 3,
    title: 'Foundational Components',
    short: 'Foundational',
    color: '#8b5cf6',
    description: 'Vision, mission, beliefs, and program goals — the philosophical anchor for the program.',
    suggestedArtifacts: [
      { type: 'vision_statement',       label: 'Program Vision Statement',                      hint: 'What students will be able to do because of the program (long view).' },
      { type: 'mission_statement',      label: 'Program Mission Statement',                     hint: 'Aligned to school + district mission. Explains the program\'s purpose.' },
      { type: 'beliefs_philosophy',     label: 'Beliefs / Philosophy Statement',                hint: 'What you believe about students, families, equity, and the counselor\'s role.' },
      { type: 'annual_goals',           label: 'Annual Program Goals (Measurable)',             hint: '3-5 SMART goals with student outcome data tied to each.' },
    ],
  },
  {
    key: 'delivery',
    number: 4,
    title: 'Four Service Delivery Components',
    short: 'Service Delivery',
    color: '#f59e0b',
    description: 'Evidence of all four delivery types: Guidance Curriculum, Responsive Services, Individual Planning, and System Support.',
    suggestedArtifacts: [
      { type: 'guidance_lessons',       label: 'Guidance Curriculum Lessons',                    hint: 'Sample classroom guidance lessons — outcome data if available. Beacon\'s Lessons module has 35 bundled.' },
      { type: 'responsive_services',    label: 'Responsive Services Evidence',                   hint: 'Referrals, small groups, crisis response, individual sessions. Beacon\'s Referrals + Sessions cover this.' },
      { type: 'individual_planning',    label: 'Individual Student Planning',                    hint: 'Course planning, transition planning, goal-setting sessions, post-secondary advising.' },
      { type: 'system_support',         label: 'System Support Activities',                      hint: 'Consultation with teachers / parents, professional development, program coordination.' },
    ],
  },
  {
    key: 'curriculum',
    number: 5,
    title: 'Program Curriculum',
    short: 'Curriculum',
    color: '#ef4444',
    description: 'Scope, sequence, and outcome data for the year\'s counseling curriculum across all three ASCA domains.',
    suggestedArtifacts: [
      { type: 'scope_sequence',         label: 'Scope and Sequence',                             hint: 'Curriculum mapped to grade levels and ASCA domains (Academic / Career / Social-Emotional).' },
      { type: 'sample_lesson_plans',    label: 'Sample Lesson Plans',                            hint: 'Detailed plans showing standards, activities, assessments, and accommodations.' },
      { type: 'pre_post_assessment',    label: 'Pre/Post Assessment Data',                       hint: 'Student knowledge or skill change after a unit. Closing-the-gap data is gold here.' },
      { type: 'outcome_data',           label: 'Student Outcome Data',                           hint: 'Attendance, behavior, academic, social-emotional changes attributable to counseling.' },
    ],
  },
];

export const CREST_CATEGORY_BY_KEY = Object.fromEntries(CREST_CATEGORIES.map((c) => [c.key, c]));

/**
 * Returns the next November 1 deadline as a Date, with a `daysUntil` count.
 * If today is on or after Nov 1, returns next year's deadline.
 */
export function getNextCrestDeadline(now = new Date()) {
  const year = now.getFullYear();
  const thisYearNov1 = new Date(year, 10, 1); // month is 0-indexed
  const target = now <= thisYearNov1 ? thisYearNov1 : new Date(year + 1, 10, 1);
  const ms = target - now;
  return {
    date: target,
    daysUntil: Math.max(0, Math.ceil(ms / 86400000)),
  };
}

/**
 * Compute completeness percentage for one category given the artifacts the
 * counselor has saved in IndexedDB.
 *   - 100% when at least one artifact is saved against every suggested type
 *   - Partial when some types are filled
 */
export function categoryProgress(category, artifacts) {
  const filledTypes = new Set(
    artifacts
      .filter((a) => a.category === category.key)
      .map((a) => a.type)
  );
  const required = category.suggestedArtifacts.length;
  const filled = category.suggestedArtifacts.filter((sa) => filledTypes.has(sa.type)).length;
  return {
    filled,
    required,
    pct: required === 0 ? 0 : Math.round((filled / required) * 100),
  };
}

export function overallProgress(artifacts) {
  let total = 0;
  let complete = 0;
  CREST_CATEGORIES.forEach((c) => {
    const p = categoryProgress(c, artifacts);
    total += p.required;
    complete += p.filled;
  });
  return {
    filled: complete,
    required: total,
    pct: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}
