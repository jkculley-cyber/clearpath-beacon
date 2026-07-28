/**
 * Crisis Quick-Launch — workflow definitions for the four trigger types.
 *
 * Design notes:
 *   - Each workflow is a sequence of step objects: { key, label, type, options?, required? }
 *   - Suicide-risk screen is INSPIRED BY the Columbia Protocol (a public-domain
 *     instrument) but uses original wording. Districts that want the literal
 *     C-SSRS should use the C-SSRS form directly.
 *   - SB 11 / 19 TAC Chapter 103 threat assessment uses the Texas-mandated
 *     decision points (substantive vs. transient threat indicators).
 *   - Mandated-reporter decision tree references DFPS hotline 1-800-252-5400
 *     (24/7) and Texas Family Code Sec. 261.101.
 *   - De-escalation + safety plan covers acute emotional distress that doesn't
 *     fit the other three.
 *
 * The flow is intentionally not gated: counselor can answer "no" to every
 * question and still complete the workflow. The point is forced documentation
 * with timestamped answers, not algorithmic case management.
 */

export const TRIGGER_TYPES = [
  {
    key: 'suicide',
    label: 'Suicide ideation / self-harm',
    color: '#dc2626',
    icon: '🔴',
    description: 'Student expressed thoughts of suicide, self-harm, or you observed warning signs.',
  },
  {
    key: 'threat',
    label: 'Threat to others',
    color: '#dc2626',
    icon: '🔴',
    description: 'Student made a verbal, written, or symbolic threat. Triggers SB 11 / 19 TAC Chapter 103 threat assessment.',
  },
  {
    key: 'abuse',
    label: 'Abuse / neglect disclosure',
    color: '#b45309',
    icon: '🟡',
    description: 'Student disclosed (or you have reasonable cause to suspect) abuse or neglect. Mandated-reporter workflow.',
  },
  {
    key: 'distress',
    label: 'Acute emotional distress',
    color: '#b45309',
    icon: '🟡',
    description: 'Student in significant distress not covered above (panic, dissociation, severe anger). De-escalation + safety plan.',
  },
];

/* ─── Step definitions per trigger ─── */

const SUICIDE_STEPS = [
  { key: 'occurred_at',  label: 'When did this happen?',                                    type: 'datetime', required: true, default: 'now' },
  { key: 'who_present',  label: 'Who was present? (counselor, teacher, parent, peer, etc.)', type: 'short' },
  { key: 'q1_thoughts',  label: '1. Has the student had thoughts of being better off dead, or wishing they were dead, or thoughts of killing themselves?', type: 'yn_detail', required: true, detailLabel: 'If yes, what did the student say (in their words)?' },
  { key: 'q2_method',    label: '2. Has the student thought about how they might do this — even if they don\'t plan to?', type: 'yn_detail', detailLabel: 'If yes, what method?' },
  { key: 'q3_intent',    label: '3. Has the student had any intention of acting on these thoughts?',                       type: 'yn_detail', detailLabel: 'If yes, describe.' },
  { key: 'q4_plan',      label: '4. Has the student worked out (or started to work out) the details of how to do it?',     type: 'yn_detail', detailLabel: 'If yes, describe the level of plan.' },
  { key: 'q5_behavior',  label: '5. Has the student done anything, started to do anything, or prepared to do anything to end their life? (e.g., collected pills, written a note, gave away things, accessed a weapon)', type: 'yn_detail', detailLabel: 'If yes, describe.' },
  { key: 'access',       label: 'Does the student have access to lethal means at home / school? (firearms, medications, etc.)', type: 'long' },
  { key: 'protective',   label: 'Protective factors (reasons for living the student named, support people, prior treatment, etc.)', type: 'long' },
  { key: 'risk_level',   label: 'Counselor-determined risk level',                          type: 'select', required: true, options: ['Low', 'Moderate', 'High', 'Imminent danger'] },
  { key: 'parent_notified', label: 'Parent/guardian notified?',                              type: 'yn_detail', required: true, detailLabel: 'When + how + who you spoke to' },
  { key: 'admin_notified',  label: 'Administrator notified?',                                type: 'yn_detail', required: true, detailLabel: 'Who + when' },
  { key: 'other_actions', label: 'Other actions (mobile crisis dispatched, transported, law enforcement, hospital, etc.) — leave blank if none', type: 'long' },
  { key: 'safety_plan_completed', label: 'Safety plan completed with student?',              type: 'yn_detail', detailLabel: 'Summary of safety plan' },
  { key: 'disposition',  label: 'Where did the student go after the screen? (class, home with parent, hospital, etc.)', type: 'short' },
];

const THREAT_STEPS = [
  { key: 'occurred_at', label: 'When did the threat occur?',                                 type: 'datetime', required: true, default: 'now' },
  { key: 'how_reported', label: 'How was the threat reported / observed?',                   type: 'short' },
  { key: 'threat_text', label: 'Verbatim threat (quote what was said / written / drawn)',    type: 'long', required: true },
  { key: 'target',      label: 'Target(s) of the threat',                                    type: 'short', required: true },
  { key: 'method',      label: 'Specific method / weapon described',                         type: 'short' },
  { key: 'specificity', label: 'Threat specificity (vague / general / specific / detailed plan)', type: 'select', required: true, options: ['Vague', 'General', 'Specific', 'Detailed plan'] },
  { key: 'access',      label: 'Does the student have access to the means described?',       type: 'select', options: ['No', 'Possibly', 'Yes'] },
  { key: 'history',     label: 'Prior threats or behavioral history',                        type: 'long' },
  { key: 'admission',   label: 'Did the student admit / deny when confronted?',              type: 'long' },
  { key: 'classification', label: 'Threat classification (per SB 11 / 19 TAC §103)',         type: 'select', required: true, options: ['Transient (no intent, retracted)', 'Substantive – Serious', 'Substantive – Very Serious', 'Substantive – Imminent'] },
  { key: 'team_members', label: 'Threat-assessment team members consulted',                  type: 'long' },
  { key: 'protective_actions', label: 'Protective actions taken (separation, supervision, removal of access, law enforcement notified, etc.)', type: 'long', required: true },
  { key: 'parent_notified', label: 'Parent of student making threat — notified?',             type: 'yn_detail', required: true },
  { key: 'target_parent', label: 'Parent of target student(s) — notified?',                   type: 'yn_detail' },
  { key: 'admin_notified', label: 'Administrator + Threat Assessment Team notified?',         type: 'yn_detail', required: true },
];

const ABUSE_STEPS = [
  { key: 'occurred_at',     label: 'When did the disclosure occur?',                         type: 'datetime', required: true, default: 'now' },
  { key: 'disclosure_text', label: 'Disclosure (paraphrase or exact words — minimal questioning per CPS guidance)', type: 'long', required: true },
  { key: 'observable',      label: 'Observable evidence (marks, behavior changes, statements from others)', type: 'long' },
  { key: 'alleged_perp',    label: 'Alleged perpetrator (relationship to child)',             type: 'short' },
  { key: 'category',        label: 'Type of suspected abuse / neglect',                       type: 'select', required: true, options: ['Physical abuse', 'Sexual abuse', 'Emotional abuse', 'Neglect (physical)', 'Neglect (medical)', 'Neglect (supervision)', 'Other / multiple'] },
  { key: 'prior_reports',   label: 'Have you (or anyone known to you) made prior CPS reports for this student?', type: 'yn_detail' },
  { key: 'imminent_danger', label: 'Is the student in immediate danger if returned home?',    type: 'select', required: true, options: ['No', 'Possibly', 'Yes'] },
  { key: 'cps_called',      label: 'DFPS hotline called (1-800-252-5400)?',                   type: 'yn_detail', required: true, detailLabel: 'Time of call + intake worker name + case/intake # if issued' },
  { key: 'le_called',       label: 'Law enforcement agency called (DPS, municipal police, sheriff, or constable — a district PD/SRO does NOT count, per SB 571/TEA guidance)?', type: 'yn_detail', required: true, detailLabel: 'Agency + time of call + officer/report # if issued' },
  { key: 'cps_outcome',     label: 'DFPS intake outcome (accepted for investigation, screened out, etc.)', type: 'long' },
  { key: 'admin_notified',  label: 'Administrator notified?',                                  type: 'yn_detail', required: true, detailLabel: 'Who + when' },
  { key: 'parent_notified', label: 'Parent notification status',                                type: 'select', options: ['Not contacted (per CPS guidance — would compromise investigation)', 'Contacted', 'Will be contacted by CPS', 'Other'] },
];

const DISTRESS_STEPS = [
  { key: 'occurred_at', label: 'When did the incident begin?',                                type: 'datetime', required: true, default: 'now' },
  { key: 'precipitating', label: 'Precipitating event / trigger',                              type: 'long' },
  { key: 'presentation', label: 'Student presentation (behaviors, statements, physical signs)', type: 'long', required: true },
  { key: 'duration', label: 'Approximate duration of acute distress',                           type: 'short' },
  { key: 'de_escalation', label: 'De-escalation strategies used',                              type: 'long', required: true },
  { key: 'response', label: 'Student response to de-escalation',                                type: 'long' },
  { key: 'safety_check', label: 'Safety check (any SI/HI thoughts? Y/N)',                      type: 'yn_detail', required: true, detailLabel: 'If yes, escalate to suicide screen — close this and start a new Crisis event.' },
  { key: 'return', label: 'Where did the student go after stabilization? (class, home, nurse, etc.)', type: 'long' },
  { key: 'parent_notified', label: 'Parent notified?',                                          type: 'yn_detail', required: true },
  { key: 'admin_notified',  label: 'Administrator notified?',                                   type: 'yn_detail' },
];

export const WORKFLOWS = {
  suicide:  { steps: SUICIDE_STEPS,  followUps: [24, 72, 168],  title: 'Suicide / Self-Harm Risk Screen' },
  threat:   { steps: THREAT_STEPS,   followUps: [24, 72, 168],  title: 'Threat Assessment (SB 11 / 19 TAC Ch. 103)' },
  abuse:    { steps: ABUSE_STEPS,    followUps: [24, 168],      title: 'Mandated Reporter — Abuse / Neglect' },
  distress: { steps: DISTRESS_STEPS, followUps: [24, 72],       title: 'Acute Distress / De-escalation' },
};

/* ─── Follow-up generation ─── */

export function buildFollowUpRecords({ counselorId, studentId, eventId, studentName, triggerKey, hoursList }) {
  const now = new Date();
  const triggerLabel = TRIGGER_TYPES.find((t) => t.key === triggerKey)?.label || 'crisis event';
  return hoursList.map((hours) => {
    const due = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return {
      counselor_id: counselorId,
      student_id: studentId,
      title: hourLabel(hours, studentName),
      body: `${triggerLabel} on ${now.toLocaleDateString()}. Required follow-up: confirm safety, review safety plan, document parent contact.`,
      due_at: due.toISOString(),
      source_type: 'crisis_event',
      source_id: eventId,
      target_url: `/students/${studentId}`,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  });
}

function hourLabel(hours, studentName) {
  const subject = studentName || 'student';
  if (hours === 24) return `24-hour follow-up: ${subject}`;
  if (hours === 72) return `72-hour follow-up: ${subject}`;
  if (hours === 168) return `1-week follow-up: ${subject}`;
  if (hours < 24) return `${hours}-hour follow-up: ${subject}`;
  return `${Math.round(hours / 24)}-day follow-up: ${subject}`;
}

/* ─── Parent + Admin notification drafts ─── */

export function draftParentNotification({ trigger, studentName, when, counselorName, schoolName }) {
  // The time the counselor SUBMITTED the form is not the time the incident
  // occurred. We deliberately avoid printing a minute-level time-of-day on
  // the parent email — it would misrepresent the incident time when the
  // counselor logs after the fact, and parents don't need clinical-precision
  // timestamps in a 'please call me' note. Precise timestamps are captured
  // in the structured PDF documentation.
  const incidentDt = when ? new Date(when) : null;
  const validIncidentDt = incidentDt && !Number.isNaN(incidentDt.getTime()) ? incidentDt : null;
  const now = new Date();
  const sameDay = validIncidentDt
    && validIncidentDt.getFullYear() === now.getFullYear()
    && validIncidentDt.getMonth() === now.getMonth()
    && validIncidentDt.getDate() === now.getDate();
  // 'today' if the incident was today (which is the common case); a date if
  // the counselor set 'Earlier than now' and the incident was on a previous
  // school day.
  const whenPhrase = sameDay || !validIncidentDt
    ? 'today'
    : `on ${validIncidentDt.toLocaleDateString()}`;
  const opener = `Hello,\n\nI'm reaching out about ${studentName} regarding something that came up at school ${whenPhrase}.`;
  let body = '';
  if (trigger === 'suicide') {
    body = `\n\nDuring our conversation, ${studentName} shared concerns related to safety that I want to make sure you are aware of right away. I have completed a structured safety screening and worked with ${studentName} on a safety plan. I would like to schedule a brief phone call with you today or tomorrow at the latest to share details and discuss next steps, including connection to outside mental-health support.`;
  } else if (trigger === 'threat') {
    body = `\n\nThe school is following our threat-assessment process per state requirements. I would like to speak with you as soon as possible about what happened and the next steps the campus team is taking.`;
  } else if (trigger === 'abuse') {
    body = `\n\nA situation came to my attention that I am required by law to address. I will be in touch directly to discuss appropriate next steps.`;
  } else {
    body = `\n\n${studentName} experienced a difficult moment today. We worked through it together using calming strategies and ${studentName} returned to a regulated state before leaving my office. I want to keep you informed and partner on next steps.`;
  }
  const closer = `\n\nPlease call me at the school as soon as you are able. My direct line is below.\n\nThank you,\n${counselorName || 'Your school counselor'}\n${schoolName || ''}`.trimEnd();
  return opener + body + closer;
}

export function draftAdminNotification({ trigger, studentName, counselorName, when }) {
  const triggerLabel = TRIGGER_TYPES.find((t) => t.key === trigger)?.label || 'crisis event';
  const incidentDt = when ? new Date(when) : null;
  const validIncident = incidentDt && !Number.isNaN(incidentDt.getTime());
  // Two distinct timestamps in the admin note. Documented-at = right now (when
  // the counselor sat down to log it). Incident-occurred = when the student
  // event actually happened (from the workflow's "occurred_at" field). Mixing
  // them caused parents/admins to read the documentation time as the incident
  // time. Print both, labeled.
  const incidentLine = validIncident
    ? `Incident occurred: ${incidentDt.toLocaleString()}\n`
    : '';
  return `${triggerLabel.toUpperCase()} — student notification\n\n` +
    `Student: ${studentName}\n` +
    `Counselor of record: ${counselorName || ''}\n` +
    incidentLine +
    `Documented: ${new Date().toLocaleString()}\n\n` +
    `Per campus protocol, a structured ${triggerLabel.toLowerCase()} workflow has been completed and documented in Beacon. Documentation PDF available on request.\n\n` +
    `Action items:\n` +
    `- Parent contact: see crisis log\n` +
    `- Follow-ups scheduled: see Beacon\n` +
    `- Recommended next steps: confirm coverage during high-risk windows; loop in counselor for next 5 school days.`;
}
