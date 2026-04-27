/**
 * CREST Auto-Derive — pulls live evidence from Beacon's existing tables
 * and exposes it as virtual artifacts on the CREST workspace.
 *
 * Each derive function returns null (no data) or an object shaped like:
 *   {
 *     category: 'cycle',                       // CREST category key
 *     type: 'use_of_time',                     // suggested artifact type
 *     title: 'Use of Time Analysis (YTD)',
 *     summary: 'Direct + indirect counseling: 82% (above SB 179 80% threshold)',
 *     evidence: '... long-form text safe for the portfolio PDF ...',
 *     dataPoints: { ... raw numbers a counselor can verify ... },
 *     sourceLabel: 'Beacon Time Tracker',      // shown on the card
 *     enoughData: true,                        // false → render greyed-out "needs more data"
 *   }
 *
 * The CrestPage drill-down renders these as cards alongside the saved artifacts.
 * "Promote to Portfolio" snapshots the current state into crest_artifacts so the
 * November 1 portfolio export shows what was true the day it was promoted, not
 * whatever's in the live tables a month later.
 */

import { db } from './db';

const SCHOOL_YEAR_START_MONTH = 7; // August (0-indexed)

export function currentSchoolYearRange(now = new Date()) {
  const y = now.getFullYear();
  const startYear = now.getMonth() >= SCHOOL_YEAR_START_MONTH ? y : y - 1;
  const start = `${startYear}-08-01`;
  const end = `${startYear + 1}-07-31`;
  const label = `${startYear}-${String(startYear + 1).slice(-2)}`;
  return { start, end, label };
}

const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
const DOMAIN_LABEL = {
  guidance: 'Guidance Curriculum',
  planning: 'Individual Student Planning',
  responsive: 'Responsive Services',
  system: 'System Support',
  non_counseling: 'Non-Counseling Duties',
};

/* ─── Cat 2: Use of Time Analysis (SB 179 / 80-20) ─── */
async function deriveUseOfTime(counselorId, range) {
  const { data: entries } = await db.select('time_entries', {
    eq: { counselor_id: counselorId },
    gte: { entry_date: range.start },
    lte: { entry_date: range.end },
  });
  if (!entries || entries.length === 0) {
    return {
      category: 'cycle',
      type: 'use_of_time',
      title: 'Use of Time Analysis (SB 179 / 80-20)',
      sourceLabel: 'Beacon Time Tracker',
      enoughData: false,
      summary: 'No time entries logged for this school year yet.',
    };
  }

  const byDomain = {};
  let totalMin = 0;
  for (const e of entries) {
    const m = e.duration_minutes || 0;
    byDomain[e.domain] = (byDomain[e.domain] || 0) + m;
    totalMin += m;
  }
  const counselingMin = COUNSELING_DOMAINS.reduce((s, d) => s + (byDomain[d] || 0), 0);
  const pct = totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : 0;
  const totalHrs = Math.round((totalMin / 60) * 10) / 10;
  const counselingHrs = Math.round((counselingMin / 60) * 10) / 10;

  const breakdown = Object.entries(byDomain)
    .sort(([, a], [, b]) => b - a)
    .map(([d, min]) => `  - ${DOMAIN_LABEL[d] || d}: ${Math.round((min / 60) * 10) / 10} hrs (${Math.round((min / totalMin) * 100)}%)`);

  const status = pct >= 80 ? 'COMPLIANT' : pct >= 75 ? 'WATCH' : 'ACTION NEEDED';
  return {
    category: 'cycle',
    type: 'use_of_time',
    title: `Use of Time Analysis (${range.label})`,
    summary: `${pct}% direct + indirect counseling (${status} for SB 179 80% threshold). ${counselingHrs} of ${totalHrs} total hours logged.`,
    evidence:
      `Texas SB 179 (86th Leg., 2019, TEC Sec. 33.006) requires 80% of counselor time on direct or indirect counseling services.\n\n` +
      `School Year: ${range.label}\n` +
      `Total hours logged: ${totalHrs}\n` +
      `Counseling hours: ${counselingHrs}\n` +
      `Compliance: ${pct}%  (${status})\n\n` +
      `Breakdown by domain:\n${breakdown.join('\n')}\n\n` +
      `Source: Beacon Time Tracker, ${entries.length} entries.`,
    dataPoints: { totalHrs, counselingHrs, pct, entryCount: entries.length, status },
    sourceLabel: 'Beacon Time Tracker',
    enoughData: true,
  };
}

/* ─── Cat 4: Responsive Services (referrals + sessions) ─── */
async function deriveResponsiveServices(counselorId, range) {
  const [{ data: referrals }, { data: sessions }] = await Promise.all([
    db.select('referrals', { eq: { counselor_id: counselorId } }),
    db.select('sessions', {
      eq: { counselor_id: counselorId },
      gte: { session_date: range.start },
      lte: { session_date: range.end },
    }),
  ]);

  const refs = (referrals || []).filter((r) => {
    const d = r.created_at?.slice(0, 10) || r.referral_date;
    return !d || (d >= range.start && d <= range.end);
  });
  const sess = sessions || [];

  if (refs.length === 0 && sess.length === 0) {
    return {
      category: 'delivery',
      type: 'responsive_services',
      title: 'Responsive Services Evidence',
      sourceLabel: 'Beacon Referrals + Sessions',
      enoughData: false,
      summary: 'No referrals or sessions logged for this school year yet.',
    };
  }

  const byStatus = {};
  for (const r of refs) byStatus[r.status || 'open'] = (byStatus[r.status || 'open'] || 0) + 1;
  const byConcern = {};
  for (const r of refs) {
    const c = r.concern_type || 'Unspecified';
    byConcern[c] = (byConcern[c] || 0) + 1;
  }
  const byUrgency = {};
  for (const r of refs) byUrgency[r.urgency || 'Routine'] = (byUrgency[r.urgency || 'Routine'] || 0) + 1;

  const sessionsCompleted = sess.filter((s) => s.status === 'Completed').length;
  const individualSessions = sess.filter((s) => s.student_id && !s.group_id).length;
  const groupSessions = sess.filter((s) => s.group_id).length;

  const lines = [
    `School Year: ${range.label}`,
    ``,
    `REFERRALS (${refs.length} total this year):`,
    ...Object.entries(byStatus).map(([k, v]) => `  - ${k}: ${v}`),
    ``,
    `By concern type:`,
    ...Object.entries(byConcern).sort(([, a], [, b]) => b - a).map(([k, v]) => `  - ${k}: ${v}`),
    ``,
    `By urgency:`,
    ...Object.entries(byUrgency).map(([k, v]) => `  - ${k}: ${v}`),
    ``,
    `SESSIONS (${sess.length} total, ${sessionsCompleted} completed this year):`,
    `  - Individual sessions: ${individualSessions}`,
    `  - Small-group sessions: ${groupSessions}`,
    ``,
    `Source: Beacon Referrals + Sessions modules.`,
  ];

  return {
    category: 'delivery',
    type: 'responsive_services',
    title: `Responsive Services Evidence (${range.label})`,
    summary: `${refs.length} referrals, ${sess.length} sessions (${sessionsCompleted} completed) logged this school year.`,
    evidence: lines.join('\n'),
    dataPoints: {
      referralCount: refs.length,
      sessionCount: sess.length,
      sessionsCompleted,
      individualSessions,
      groupSessions,
    },
    sourceLabel: 'Beacon Referrals + Sessions',
    enoughData: true,
  };
}

/* ─── Cat 4: Individual Student Planning (planning-domain time + 1:1 sessions) ─── */
async function deriveIndividualPlanning(counselorId, range) {
  const [{ data: entries }, { data: sessions }] = await Promise.all([
    db.select('time_entries', {
      eq: { counselor_id: counselorId, domain: 'planning' },
      gte: { entry_date: range.start },
      lte: { entry_date: range.end },
    }),
    db.select('sessions', {
      eq: { counselor_id: counselorId },
      gte: { session_date: range.start },
      lte: { session_date: range.end },
    }),
  ]);

  const planningMin = (entries || []).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const oneOnOnes = (sessions || []).filter((s) => s.student_id && !s.group_id).length;

  if (planningMin === 0 && oneOnOnes === 0) {
    return {
      category: 'delivery',
      type: 'individual_planning',
      title: 'Individual Student Planning',
      sourceLabel: 'Beacon Time Tracker + Sessions',
      enoughData: false,
      summary: 'No planning-domain time entries or 1:1 sessions logged yet.',
    };
  }

  const planningHrs = Math.round((planningMin / 60) * 10) / 10;
  return {
    category: 'delivery',
    type: 'individual_planning',
    title: `Individual Student Planning (${range.label})`,
    summary: `${planningHrs} hours logged in Individual Planning + ${oneOnOnes} one-on-one sessions this year.`,
    evidence:
      `Individual Student Planning evidence (school year ${range.label}):\n\n` +
      `Time logged in Individual Planning domain: ${planningHrs} hours\n` +
      `Number of one-on-one student sessions: ${oneOnOnes}\n\n` +
      `Use this section in the portfolio to describe specific planning examples ` +
      `(course planning, transition planning, post-secondary advising, goal-setting). ` +
      `The numbers above are the volume; the narrative case studies live alongside.\n\n` +
      `Source: Beacon Time Tracker (planning domain) + Sessions (1:1 records).`,
    dataPoints: { planningHrs, oneOnOneCount: oneOnOnes },
    sourceLabel: 'Beacon Time Tracker + Sessions',
    enoughData: true,
  };
}

/* ─── Cat 4: System Support (system-domain time + communications) ─── */
async function deriveSystemSupport(counselorId, range) {
  const [{ data: entries }, { data: comms }] = await Promise.all([
    db.select('time_entries', {
      eq: { counselor_id: counselorId, domain: 'system' },
      gte: { entry_date: range.start },
      lte: { entry_date: range.end },
    }),
    db.select('communications', { eq: { counselor_id: counselorId } }),
  ]);

  const systemMin = (entries || []).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const yearComms = (comms || []).filter((c) => {
    const d = c.contact_date || c.created_at?.slice(0, 10);
    return !d || (d >= range.start && d <= range.end);
  });

  if (systemMin === 0 && yearComms.length === 0) {
    return {
      category: 'delivery',
      type: 'system_support',
      title: 'System Support Activities',
      sourceLabel: 'Beacon Time Tracker + Communications',
      enoughData: false,
      summary: 'No system-support time or logged communications this year yet.',
    };
  }

  const systemHrs = Math.round((systemMin / 60) * 10) / 10;
  return {
    category: 'delivery',
    type: 'system_support',
    title: `System Support Activities (${range.label})`,
    summary: `${systemHrs} hrs system-support time + ${yearComms.length} logged communications.`,
    evidence:
      `System Support evidence (school year ${range.label}):\n\n` +
      `Time logged in System Support domain: ${systemHrs} hours\n` +
      `Documented parent/faculty communications: ${yearComms.length}\n\n` +
      `Add narrative on the portfolio: faculty PD presentations delivered, parent ` +
      `outreach campaigns, committee/team participation, district-level program coordination.\n\n` +
      `Source: Beacon Time Tracker (system domain) + Communications log.`,
    dataPoints: { systemHrs, communicationCount: yearComms.length },
    sourceLabel: 'Beacon Time Tracker + Communications',
    enoughData: true,
  };
}

/* ─── Cat 5: Guidance Curriculum Lessons (lesson library + delivery records) ─── */
async function deriveGuidanceCurriculum(counselorId, range) {
  const [{ data: lessons }, { data: entries }] = await Promise.all([
    db.select('lesson_library', { eq: { counselor_id: counselorId } }),
    db.select('time_entries', {
      eq: { counselor_id: counselorId, domain: 'guidance' },
      gte: { entry_date: range.start },
      lte: { entry_date: range.end },
    }),
  ]);

  const lessonsList = lessons || [];
  const favorites = lessonsList.filter((l) => l.is_favorite);
  const guidanceMin = (entries || []).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const guidanceHrs = Math.round((guidanceMin / 60) * 10) / 10;

  if (lessonsList.length === 0 && guidanceMin === 0) {
    return {
      category: 'delivery',
      type: 'guidance_lessons',
      title: 'Guidance Curriculum Lessons',
      sourceLabel: 'Beacon Lessons + Time Tracker',
      enoughData: false,
      summary: 'No lessons or guidance-domain time entries this year yet.',
    };
  }

  const byDomainTag = {};
  for (const l of lessonsList) {
    const tag = l.domain_tag || 'Unspecified';
    byDomainTag[tag] = (byDomainTag[tag] || 0) + 1;
  }

  const evidenceLines = [
    `Guidance Curriculum evidence (school year ${range.label}):`,
    ``,
    `Lessons in personal library: ${lessonsList.length} (${favorites.length} favorited as core curriculum)`,
    `Guidance-domain delivery time logged: ${guidanceHrs} hours`,
    ``,
    `Library by ASCA / Texas Model domain:`,
    ...Object.entries(byDomainTag).sort(([, a], [, b]) => b - a).map(([k, v]) => `  - ${k}: ${v}`),
    ``,
    `Top 10 favorited lessons:`,
    ...favorites.slice(0, 10).map((l) => `  - ${l.title || 'Untitled'} (${l.domain_tag || 'general'})`),
    ``,
    `Source: Beacon Lessons module + Time Tracker (guidance domain).`,
  ];

  return {
    category: 'delivery',
    type: 'guidance_lessons',
    title: `Guidance Curriculum Lessons (${range.label})`,
    summary: `${lessonsList.length} lessons in library, ${favorites.length} favorited, ${guidanceHrs} hrs delivered.`,
    evidence: evidenceLines.join('\n'),
    dataPoints: {
      lessonCount: lessonsList.length,
      favoriteCount: favorites.length,
      guidanceHrs,
    },
    sourceLabel: 'Beacon Lessons + Time Tracker',
    enoughData: true,
  };
}

/* ─── Cat 5: Sample Lesson Plans ─── */
async function deriveSampleLessons(counselorId) {
  const { data: lessons } = await db.select('lesson_library', { eq: { counselor_id: counselorId } });
  const list = (lessons || []).filter((l) => l.is_favorite || l.lesson_plan);
  if (list.length === 0) {
    return {
      category: 'curriculum',
      type: 'sample_lesson_plans',
      title: 'Sample Lesson Plans',
      sourceLabel: 'Beacon Lessons',
      enoughData: false,
      summary: 'No favorited lessons yet — favorite lessons in the Lessons module to feature them here.',
    };
  }
  const sample = list.slice(0, 5);
  return {
    category: 'curriculum',
    type: 'sample_lesson_plans',
    title: 'Sample Lesson Plans',
    summary: `${list.length} favorited lessons available — ${sample.length} included as samples.`,
    evidence:
      `Sample lesson plans pulled from Beacon Lessons library:\n\n` +
      sample.map((l, i) => {
        const lines = [`${i + 1}. ${l.title || 'Untitled'}`];
        if (l.domain_tag) lines.push(`   Domain: ${l.domain_tag}`);
        if (l.grade_band) lines.push(`   Grade band: ${l.grade_band}`);
        if (l.objective) lines.push(`   Objective: ${l.objective}`);
        if (l.lesson_plan) lines.push(`   Plan: ${String(l.lesson_plan).slice(0, 200)}${String(l.lesson_plan).length > 200 ? '...' : ''}`);
        return lines.join('\n');
      }).join('\n\n') +
      `\n\nFull lesson plans live in the Beacon Lessons library — open each there to revise before submission.`,
    dataPoints: { totalFavorited: list.length, sampleCount: sample.length },
    sourceLabel: 'Beacon Lessons',
    enoughData: true,
  };
}

/* ─── Cat 1: Counselor Role + Calendar (from counselor profile + schedule blocks) ─── */
async function deriveCounselorRole(counselorId) {
  const [{ data: counselor }, { data: blocks }] = await Promise.all([
    db.selectById('counselor', counselorId),
    db.select('campus_schedule_blocks', { eq: { counselor_id: counselorId } }),
  ]);

  if (!counselor) return null;

  const blockCount = (blocks || []).length;
  const enough = !!(counselor.name && (counselor.school_name || counselor.school) && blockCount > 0);

  return {
    category: 'intro',
    type: 'counselor_calendar',
    title: 'Counselor Calendar / Master Schedule',
    summary: enough
      ? `${blockCount} weekly schedule blocks defined for ${counselor.school_name || counselor.school || 'your campus'}.`
      : `Profile + ${blockCount} schedule blocks. Add more in Settings + Schedule for richer evidence.`,
    evidence:
      `Counselor: ${counselor.name || '(not set)'}\n` +
      `School: ${counselor.school_name || counselor.school || '(not set)'}\n` +
      `District: ${counselor.district || '(not set)'}\n` +
      `Grade levels served: ${counselor.grade_levels || '(not set)'}\n\n` +
      `Weekly schedule blocks defined: ${blockCount}\n\n` +
      `Use the Beacon Schedule view to print a weekly master schedule for the ` +
      `portfolio. The schedule is the easiest way to demonstrate Texas Model ` +
      `service-delivery balance to a CREST reviewer.`,
    dataPoints: { hasProfile: !!counselor.name, scheduleBlocks: blockCount },
    sourceLabel: 'Beacon Settings + Schedule',
    enoughData: enough,
  };
}

/* ─── Top-level: derive all virtual artifacts for a counselor ─── */
export async function deriveAllArtifacts(counselorId, now = new Date()) {
  if (!counselorId) return [];
  const range = currentSchoolYearRange(now);
  const results = await Promise.all([
    deriveCounselorRole(counselorId),
    deriveUseOfTime(counselorId, range),
    deriveResponsiveServices(counselorId, range),
    deriveIndividualPlanning(counselorId, range),
    deriveSystemSupport(counselorId, range),
    deriveGuidanceCurriculum(counselorId, range),
    deriveSampleLessons(counselorId),
  ]);
  return results.filter(Boolean);
}

/**
 * Snapshot a virtual artifact into a saved crest_artifact row.
 * The portfolio export uses the snapshot, so the November 1 export reflects
 * what was true on the day the counselor promoted it.
 */
export function buildSnapshotRecord(virtual, counselorId, schoolYear, uuid) {
  return {
    id: uuid(),
    counselor_id: counselorId,
    category: virtual.category,
    type: virtual.type,
    title: virtual.title,
    description: virtual.summary,
    evidence: virtual.evidence,
    date_collected: new Date().toISOString().slice(0, 10),
    school_year: schoolYear,
    created_at: new Date().toISOString(),
    auto_derived: true,
    source_label: virtual.sourceLabel,
    data_snapshot: virtual.dataPoints || null,
  };
}
