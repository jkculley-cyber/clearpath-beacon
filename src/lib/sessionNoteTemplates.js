/**
 * Session Note Templates — local-mode SOAP-format expansion.
 *
 * Each template has 4-6 prompted fields that turn into a full Subjective /
 * Objective / Assessment / Plan note when stitched together. The output reads
 * like a real counselor wrote it (not a Mad Libs).
 *
 * Tokens in template strings are replaced with field values:
 *   {{trigger}}, {{strategy}}, {{response}}, {{plan}}, etc.
 *
 * Empty / unanswered fields collapse cleanly — no awkward "[blank]" leftovers.
 *
 * The bundled templates here are starter content. The session_note_templates
 * IndexedDB store also lets a counselor save her own customized versions.
 */

export const SESSION_NOTE_TEMPLATES = [
  {
    id: 'tmpl-regulation',
    category: 'Behavior / Regulation',
    title: 'Emotional Regulation Incident',
    fields: [
      { key: 'trigger',     label: 'What set the student off?',                placeholder: 'e.g., peer conflict, transition, family stressor', rows: 2 },
      { key: 'observed',    label: 'What did you observe?',                    placeholder: 'e.g., crying, fists clenched, refusing to speak', rows: 2 },
      { key: 'strategy',    label: 'What strategy did you use?',               placeholder: 'e.g., calm corner, deep breathing, I-statement modeling', rows: 2 },
      { key: 'response',    label: 'How did the student respond?',             placeholder: 'e.g., regulated within 8 min, returned to class', rows: 2 },
      { key: 'plan',        label: 'Follow-up / next steps',                   placeholder: 'e.g., weekly check-in for 4 weeks, coordinate with teacher', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.trigger
        ? `Student reported being upset following: ${f.trigger}.`
        : `Student presented in emotional distress; precipitating event not yet clarified.`,
      objective: [
        f.observed ? `Observed: ${f.observed}.` : null,
        f.strategy ? `Counselor used ${lower(f.strategy)} as the regulation strategy.` : null,
        f.response ? `Student response: ${lower(f.response)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Student presented with acute emotional dysregulation, responsive to in-session intervention. No safety concerns identified.',
      plan: f.plan ? f.plan : 'Continue Tier 2 monitoring; revisit at next scheduled session.',
      ctx,
    }),
  },
  {
    id: 'tmpl-grief',
    category: 'Grief / Loss',
    title: 'Grief Check-In',
    fields: [
      { key: 'loss',        label: 'Nature of the loss',                       placeholder: 'e.g., death of grandmother 3 weeks ago, family pet, parent deployment', rows: 2 },
      { key: 'symptoms',    label: 'How is the student presenting today?',     placeholder: 'e.g., tearful, withdrawn, asked questions about death', rows: 2 },
      { key: 'support',     label: 'Support strategies used',                  placeholder: 'e.g., normalized grief, drawing activity, memory book', rows: 2 },
      { key: 'family',      label: 'Family context',                           placeholder: 'e.g., mother coordinating funeral, sibling also affected', rows: 2 },
      { key: 'plan',        label: 'Follow-up',                                placeholder: 'e.g., re-screen at 4 weeks, check on sleep/appetite', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.loss
        ? `Student is grieving following ${lower(f.loss)}.`
        : `Student presented for grief support.`,
      objective: [
        f.symptoms ? `Today: ${lower(f.symptoms)}.` : null,
        f.support ? `In-session support: ${lower(f.support)}.` : null,
        f.family ? `Family context: ${lower(f.family)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Student is processing loss within developmentally appropriate range. No acute safety concerns at this time.',
      plan: f.plan ? f.plan : 'Continue weekly grief support sessions; coordinate with family as needed.',
      ctx,
    }),
  },
  {
    id: 'tmpl-academic',
    category: 'Academic Concern',
    title: 'Academic Performance Concern',
    fields: [
      { key: 'referrer',    label: 'Who referred / what triggered?',           placeholder: 'e.g., teacher noted declining grades, student self-referred', rows: 2 },
      { key: 'concerns',    label: 'Specific academic concerns',               placeholder: 'e.g., not turning in homework, missing reading benchmarks', rows: 2 },
      { key: 'student_view',label: "Student's perspective",                   placeholder: `e.g., "the work is too hard", "I do not understand math"`, rows: 2 },
      { key: 'barriers',    label: 'Identified barriers',                      placeholder: 'e.g., learning gap, attendance, home environment, undiagnosed concern', rows: 2 },
      { key: 'plan',        label: 'Action plan',                              placeholder: 'e.g., 504 referral, MTSS Tier 2, parent meeting, study-skills group', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: [
        f.referrer ? `Referral context: ${lower(f.referrer)}.` : null,
        f.student_view ? `Student's self-report: "${stripQuotes(f.student_view)}".` : null,
      ].filter(Boolean).join(' '),
      objective: [
        f.concerns ? `Concerns documented: ${lower(f.concerns)}.` : null,
        f.barriers ? `Identified barriers: ${lower(f.barriers)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Academic concerns warrant continued monitoring with appropriate tier of support. No social-emotional crisis identified at this time.',
      plan: f.plan ? f.plan : 'Coordinate with classroom teacher; revisit in 2 weeks.',
      ctx,
    }),
  },
  {
    id: 'tmpl-family',
    category: 'Family Stressor',
    title: 'Family Stressor',
    fields: [
      { key: 'stressor',    label: 'What is happening at home?',               placeholder: 'e.g., parents separating, new sibling, financial strain', rows: 2 },
      { key: 'impact',      label: 'How is it affecting the student?',         placeholder: 'e.g., tired in class, emotional outbursts, withdrawn', rows: 2 },
      { key: 'support',     label: 'Counseling support provided',              placeholder: 'e.g., normalized feelings, coping skills, safe-adult identification', rows: 2 },
      { key: 'parents',     label: 'Parent contact / coordination',            placeholder: 'e.g., called Mom, mailed resource list, no contact yet', rows: 2 },
      { key: 'plan',        label: 'Follow-up',                                placeholder: 'e.g., weekly check-ins, refer to community resource', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.stressor ? `Student is navigating: ${lower(f.stressor)}.` : `Student presented with family-related stressor.`,
      objective: [
        f.impact ? `Observed impact: ${lower(f.impact)}.` : null,
        f.support ? `Support provided: ${lower(f.support)}.` : null,
        f.parents ? `Parent coordination: ${lower(f.parents)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Student is responding to a temporary family stressor. No abuse / neglect indicators identified. Continued counseling support indicated.',
      plan: f.plan ? f.plan : 'Continue Tier 2 weekly support; maintain parent communication.',
      ctx,
    }),
  },
  {
    id: 'tmpl-bullying',
    category: 'Bullying / Conflict',
    title: 'Bullying / Peer Conflict',
    fields: [
      { key: 'incident',    label: 'What was reported / observed?',            placeholder: 'e.g., name-calling at recess, exclusion in cafeteria, online harassment', rows: 3 },
      { key: 'pattern',     label: 'One-time or pattern?',                     placeholder: 'e.g., third report this month, isolated incident' },
      { key: 'support',     label: 'Counseling support',                       placeholder: 'e.g., assertiveness skills, trusted-adult plan, safety mapping', rows: 2 },
      { key: 'admin',       label: 'Admin / teacher coordination',             placeholder: 'e.g., reported to AP per District Bullying Policy, classroom seating change', rows: 2 },
      { key: 'plan',        label: 'Follow-up + safety plan',                  placeholder: 'e.g., daily check-ins x 1 week, recess monitor alert, parent notified', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.incident ? `Student reported: ${lower(f.incident)}.` : `Student reported peer conflict / bullying concern.`,
      objective: [
        f.pattern ? `Pattern: ${lower(f.pattern)}.` : null,
        f.support ? `In-session support: ${lower(f.support)}.` : null,
        f.admin ? `Coordination: ${lower(f.admin)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Concern aligns with district bullying / harassment policy procedures. Documented per state reporting requirements (TEC §37.0832 / district policy FFI). No imminent safety threat identified at this time.',
      plan: f.plan ? f.plan : 'Daily check-ins for one week; coordinate with administration on disciplinary follow-up; parent notification as required.',
      ctx,
    }),
  },
  {
    id: 'tmpl-friendship',
    category: 'Social-Emotional',
    title: 'Friendship / Social Skills',
    fields: [
      { key: 'concern',     label: 'Social concern',                           placeholder: 'e.g., struggles to join groups, frequent disagreements with friends, isolation', rows: 2 },
      { key: 'context',     label: 'When does it show up?',                    placeholder: 'e.g., recess, group projects, lunchroom', rows: 2 },
      { key: 'skills',      label: 'Skills practiced this session',            placeholder: 'e.g., conversation starters, listening behaviors, conflict-resolution steps', rows: 2 },
      { key: 'response',    label: 'Student engagement',                       placeholder: 'e.g., role-played, asked questions, hesitant', rows: 2 },
      { key: 'plan',        label: 'Plan',                                     placeholder: 'e.g., add to friendship group, generalize at recess, parent home practice', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.concern
        ? `Student presents with social-skill concern: ${lower(f.concern)}${f.context ? ', most evident during ' + lower(f.context) : ''}.`
        : `Student presents with social-skill concern.`,
      objective: [
        f.skills ? `Session focus: ${lower(f.skills)}.` : null,
        f.response ? `Engagement: ${lower(f.response)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Social-skill development on track for short-term Tier 2 small-group placement. Generalization to natural peer settings is the next growth edge.',
      plan: f.plan ? f.plan : 'Continue weekly small-group friendship sessions; collect post-session generalization data from classroom teacher.',
      ctx,
    }),
  },
  {
    id: 'tmpl-trauma',
    category: 'Trauma Response',
    title: 'Trauma Response Check-In',
    fields: [
      { key: 'trauma',      label: 'Known trauma context (no detail required)', placeholder: 'e.g., previously disclosed family domestic incident, foster placement transition', rows: 2 },
      { key: 'today',       label: 'How is the student today?',                placeholder: 'e.g., dissociative at start, hyper-vigilant in hallway, fine then escalated', rows: 2 },
      { key: 'grounding',   label: 'Grounding / coping strategy used',         placeholder: 'e.g., 5-4-3-2-1 sensory grounding, sand tray, breathing exercises', rows: 2 },
      { key: 'safety',      label: 'Safety check',                             placeholder: 'e.g., verbalized safe adult, denied SI, reviewed safety plan' },
      { key: 'plan',        label: 'Follow-up',                                placeholder: 'e.g., consult with outside therapist, weekly counseling, safety-plan refresh', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.trauma
        ? `Trauma history: ${lower(f.trauma)}.`
        : `Student presented for trauma-informed check-in.`,
      objective: [
        f.today ? `Presentation today: ${lower(f.today)}.` : null,
        f.grounding ? `Grounding strategy: ${lower(f.grounding)}.` : null,
        f.safety ? `Safety check: ${lower(f.safety)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Trauma response symptoms within range responsive to in-session grounding. Coordination with outside provider remains in place.',
      plan: f.plan ? f.plan : 'Weekly trauma-informed sessions; coordinate with outside therapist; refresh safety plan monthly.',
      ctx,
    }),
  },
  {
    id: 'tmpl-mood',
    category: 'Anxiety / Mood',
    title: 'Anxiety / Mood Check-In',
    fields: [
      { key: 'symptoms',    label: 'Reported symptoms',                        placeholder: 'e.g., worry about tests, stomach aches before school, low mood, sleep issues', rows: 2 },
      { key: 'duration',    label: 'How long?',                                placeholder: 'e.g., 2 weeks, since the start of school year' },
      { key: 'severity',    label: 'Functional impact',                        placeholder: 'e.g., missing class, avoiding cafeteria, refusing to attend' },
      { key: 'safety',      label: 'Safety check',                             placeholder: 'Required: explicit denial of SI/HI; if any concern, escalate to crisis workflow' },
      { key: 'plan',        label: 'Plan',                                     placeholder: 'e.g., CBT-skill teaching, parent referral to PCP, weekly counseling', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.symptoms ? `Student reports: ${lower(f.symptoms)}${f.duration ? ' for ' + lower(f.duration) : ''}.` : `Student presented for anxiety / mood concern.`,
      objective: [
        f.severity ? `Functional impact: ${lower(f.severity)}.` : null,
        f.safety ? `Safety: ${lower(f.safety)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Symptoms within scope of school-based counseling support. No immediate safety concerns. Recommend continued monitoring + skill-building.',
      plan: f.plan ? f.plan : 'Weekly counseling sessions; CBT-skills work; coordinate with parent on PCP consultation.',
      ctx,
    }),
  },
  {
    id: 'tmpl-goal',
    category: 'Planning',
    title: 'Goal-Setting Session',
    fields: [
      { key: 'context',     label: 'Why are we goal-setting?',                 placeholder: 'e.g., transitioning out of Tier 2 group, parent request, student request', rows: 2 },
      { key: 'goals',       label: 'Goals identified',                         placeholder: 'e.g., raise hand 3x per day, ask for help when stuck, finish morning work', rows: 3 },
      { key: 'measure',     label: 'How will we measure?',                     placeholder: 'e.g., teacher daily checklist, weekly self-rating, observation at recess', rows: 2 },
      { key: 'review',      label: 'When do we review?',                       placeholder: 'e.g., next session, in 2 weeks, end of grading period' },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.context ? `Goal-setting initiated because: ${lower(f.context)}.` : `Goal-setting session.`,
      objective: [
        f.goals ? `Student-identified goals: ${lower(f.goals)}.` : null,
        f.measure ? `Measurement plan: ${lower(f.measure)}.` : null,
      ].filter(Boolean).join(' '),
      assessment: 'Student demonstrated readiness to engage in self-directed goal-setting. Goals are specific, measurable, and developmentally appropriate.',
      plan: f.review ? `Review goals on ${f.review}; adjust as needed.` : 'Review goals at next scheduled session.',
      ctx,
    }),
  },
  {
    id: 'tmpl-closure',
    category: 'Closure',
    title: 'Closure / Termination',
    fields: [
      { key: 'reason',      label: 'Why is service ending?',                   placeholder: 'e.g., goals met, end of school year, transferring schools', rows: 2 },
      { key: 'progress',    label: 'Progress summary',                         placeholder: 'e.g., reduced classroom disruptions from 4-5/week to <1/week, generalized coping skills', rows: 3 },
      { key: 'maintenance', label: 'Maintenance plan',                         placeholder: 'e.g., monthly check-ins, teacher-monitored, parent home strategies', rows: 2 },
      { key: 'rescreen',    label: 'Re-engagement criteria',                   placeholder: 'e.g., teacher referral, behavior return, end-of-year screen', rows: 2 },
    ],
    build: (f, ctx) => buildSoap({
      subjective: f.reason ? `Service is ending because: ${lower(f.reason)}.` : `Final / closure session.`,
      objective: f.progress ? `Progress: ${lower(f.progress)}.` : `Student demonstrated growth across counseling goals.`,
      assessment: 'Student met closure criteria. No ongoing acute concerns at this time.',
      plan: [
        f.maintenance ? `Maintenance: ${lower(f.maintenance)}.` : null,
        f.rescreen ? `Re-engage if: ${lower(f.rescreen)}.` : null,
      ].filter(Boolean).join(' ') || 'Discharge from active counseling caseload; available on referral basis.',
      ctx,
    }),
  },
];

/* ─── Helpers ─── */

function lower(s) {
  if (!s) return '';
  // Don't lowercase the first character if it looks like a proper noun or sentence
  const trimmed = s.trim().replace(/[.!?]+$/, '');
  return trimmed;
}

function stripQuotes(s) {
  return (s || '').replace(/^["“”']+|["“”']+$/g, '').trim();
}

function buildSoap({ subjective, objective, assessment, plan, ctx }) {
  const lines = [];
  lines.push(`Subjective: ${subjective || 'Not documented at this time.'}`);
  lines.push('');
  lines.push(`Objective: ${objective || 'No additional observations recorded.'}`);
  lines.push('');
  lines.push(`Assessment: ${assessment}`);
  lines.push('');
  lines.push(`Plan: ${plan}`);
  if (ctx?.counselorName || ctx?.sessionDate) {
    lines.push('');
    const meta = [
      ctx.counselorName ? `Counselor: ${ctx.counselorName}` : null,
      ctx.sessionDate ? `Date: ${ctx.sessionDate}` : null,
    ].filter(Boolean).join(' | ');
    lines.push(meta);
  }
  return lines.join('\n');
}

export function getTemplateById(id) {
  return SESSION_NOTE_TEMPLATES.find((t) => t.id === id) || null;
}
