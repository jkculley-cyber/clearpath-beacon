/**
 * CrisisModal — multi-step crisis workflow.
 *
 * Stages:
 *   1. picker     — choose student + trigger type
 *   2. workflow   — answer the structured questions for the chosen trigger
 *   3. review     — review answers, see drafted parent + admin notifications,
 *                   confirm save (writes crisis_events + follow_ups, generates PDF)
 *   4. done       — confirmation + "Generate PDF" / "Open student" / "Close"
 */

import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db';
import {
  TRIGGER_TYPES, WORKFLOWS,
  buildFollowUpRecords, draftParentNotification, draftAdminNotification,
} from '../lib/crisisWorkflow';
import { generateCrisisPdf } from '../lib/crisisExport';

export default function CrisisModal({ open, onClose, counselor }) {
  const [stage, setStage] = useState('picker');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [triggerKey, setTriggerKey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedEvent, setSavedEvent] = useState(null);

  // Reset every time the modal opens (CC9 modal-reset rule).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setStage('picker');
      setStudentId('');
      setStudentSearch('');
      setTriggerKey(null);
      setAnswers({});
      setStepIdx(0);
      setSaving(false);
      setSavedEvent(null);
      // Load students
      if (counselor?.id) {
        db.select('students', { eq: { counselor_id: counselor.id, status: 'active' }, order: { column: 'name', ascending: true } })
          .then(({ data }) => setStudents(data || []));
      }
    }
  }, [open, counselor?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null;

  const trigger = TRIGGER_TYPES.find((t) => t.key === triggerKey) || null;
  const workflow = triggerKey ? WORKFLOWS[triggerKey] : null;
  const student = students.find((s) => s.id === studentId);
  const studentName = student ? (student.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : student.name) : '';
  const filteredStudents = studentSearch
    ? students.filter((s) => {
        const n = s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.name;
        return (n || '').toLowerCase().includes(studentSearch.toLowerCase());
      })
    : students;

  const startWorkflow = () => {
    if (!studentId || !triggerKey) return;
    // Pre-fill default values
    const init = {};
    workflow.steps.forEach((s) => {
      if (s.default === 'now') init[s.key] = new Date().toISOString();
    });
    setAnswers(init);
    setStepIdx(0);
    setStage('workflow');
  };

  const nextStep = () => {
    if (stepIdx < workflow.steps.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      setStage('review');
    }
  };

  const prevStep = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else setStage('picker');
  };

  const handleSave = async () => {
    setSaving(true);
    const eventId = crypto.randomUUID();
    const followUps = buildFollowUpRecords({
      counselorId: counselor.id,
      studentId,
      eventId,
      studentName,
      triggerKey,
      hoursList: workflow.followUps,
    });
    const eventRecord = {
      id: eventId,
      counselor_id: counselor.id,
      student_id: studentId,
      trigger_type: triggerKey,
      event_date: (answers.occurred_at || new Date().toISOString()).slice(0, 10),
      occurred_at: answers.occurred_at || new Date().toISOString(),
      status: 'open',
      answers,
      parent_draft: draftParentNotification({
        trigger: triggerKey,
        studentName,
        when: answers.occurred_at,
        counselorName: counselor?.name,
        schoolName: counselor?.school_name || counselor?.school,
      }),
      admin_draft: draftAdminNotification({ trigger: triggerKey, studentName, counselorName: counselor?.name }),
      follow_up_schedule: followUps.map((f) => ({ label: f.title, due_at: f.due_at })),
      created_at: new Date().toISOString(),
    };
    const { error } = await db.insert('crisis_events', eventRecord);
    if (error) {
      alert(`Could not save crisis event: ${error.message || error}`);
      setSaving(false);
      return;
    }
    // Insert follow-ups (non-blocking on individual errors)
    for (const fu of followUps) {
      await db.insert('follow_ups', fu);
    }
    setSavedEvent(eventRecord);
    setStage('done');
    setSaving(false);
  };

  const generatePdfNow = () => {
    if (!savedEvent) return;
    generateCrisisPdf({ event: savedEvent, counselor, student });
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Crisis Workflow
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '2px 0 0' }}>
              {stage === 'picker' && 'Start a crisis event'}
              {stage === 'workflow' && trigger && `${trigger.icon} ${trigger.label}`}
              {stage === 'review' && 'Review and save'}
              {stage === 'done' && 'Saved'}
            </h3>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Close">×</button>
        </div>

        {stage === 'picker' && (
          <PickerStage
            studentId={studentId}
            setStudentId={setStudentId}
            studentSearch={studentSearch}
            setStudentSearch={setStudentSearch}
            students={students}
            filteredStudents={filteredStudents}
            triggerKey={triggerKey}
            setTriggerKey={setTriggerKey}
            startWorkflow={startWorkflow}
          />
        )}

        {stage === 'workflow' && workflow && (
          <WorkflowStage
            studentName={studentName}
            workflow={workflow}
            stepIdx={stepIdx}
            answers={answers}
            setAnswers={setAnswers}
            nextStep={nextStep}
            prevStep={prevStep}
            triggerKey={triggerKey}
          />
        )}

        {stage === 'review' && (
          <ReviewStage
            workflow={workflow}
            answers={answers}
            studentName={studentName}
            counselor={counselor}
            triggerKey={triggerKey}
            onBack={() => setStage('workflow')}
            onSave={handleSave}
            saving={saving}
          />
        )}

        {stage === 'done' && savedEvent && (
          <DoneStage
            event={savedEvent}
            studentName={studentName}
            generatePdfNow={generatePdfNow}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Picker stage ─── */
function PickerStage({ studentId, setStudentId, studentSearch, setStudentSearch, filteredStudents, triggerKey, setTriggerKey, startWorkflow }) {
  return (
    <>
      <p style={muted}>
        Use this when something requires a structured screen + documentation. Beacon will guide you through the questions, save a defensible record, and auto-schedule follow-ups.
      </p>

      <label style={fieldLabel}>Student *</label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          style={fieldInput}
          placeholder="Search by name..."
          value={studentSearch}
          onChange={(e) => { setStudentSearch(e.target.value); setStudentId(''); }}
        />
        {studentSearch && !studentId && filteredStudents.length > 0 && (
          <div style={dropdown}>
            {filteredStudents.slice(0, 8).map((s) => {
              const name = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || '');
              return (
                <div
                  key={s.id}
                  onClick={() => { setStudentId(s.id); setStudentSearch(name); }}
                  style={dropdownItem}
                >
                  {name} <span style={{ color: '#9ca3af', fontSize: 12 }}>{s.grade ? `Grade ${s.grade}` : ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <label style={fieldLabel}>What's happening? *</label>
      <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
        {TRIGGER_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTriggerKey(t.key)}
            style={{
              textAlign: 'left',
              border: triggerKey === t.key ? `2px solid ${t.color}` : '2px solid #e5e7eb',
              background: triggerKey === t.key ? '#fff' : '#fff',
              borderRadius: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: t.color, marginBottom: 2 }}>
              {t.icon} {t.label}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{t.description}</div>
          </button>
        ))}
      </div>

      {triggerKey === 'abuse' && (
        <div style={dfpsCallout}>
          <strong>If the student is in immediate danger, call 911 first.</strong>
          <br />
          <strong>DFPS abuse hotline:</strong> 1-800-252-5400 (24/7)
          <br />
          You are required to make a CPS report personally — Beacon documents that you did, but cannot make the call for you.
        </div>
      )}

      {triggerKey === 'suicide' && (
        <div style={dfpsCallout}>
          <strong>If the student is in immediate danger, call 911 first.</strong>
          <br />
          <strong>988 Suicide and Crisis Lifeline:</strong> call or text 988 (24/7)
        </div>
      )}

      <div style={btnRow}>
        <button
          onClick={startWorkflow}
          disabled={!studentId || !triggerKey}
          style={{
            ...primaryBtn,
            background: studentId && triggerKey ? '#dc2626' : '#9ca3af',
            cursor: studentId && triggerKey ? 'pointer' : 'not-allowed',
          }}
        >
          Begin workflow →
        </button>
      </div>
    </>
  );
}

/* ─── Workflow stage ─── */
function WorkflowStage({ studentName, workflow, stepIdx, answers, setAnswers, nextStep, prevStep, triggerKey }) {
  const step = workflow.steps[stepIdx];
  const setVal = (val) => setAnswers((a) => ({ ...a, [step.key]: val }));
  const val = answers[step.key];

  const isAnswered = () => {
    if (!step.required) return true;
    if (val == null || val === '') return false;
    if (step.type === 'yn_detail') {
      return typeof val === 'object' && val.answer != null;
    }
    return true;
  };

  return (
    <>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#991b1b' }}>
        <strong>Student:</strong> {studentName} &nbsp;·&nbsp; <strong>Step {stepIdx + 1} of {workflow.steps.length}</strong>
      </div>

      {triggerKey === 'abuse' && stepIdx === 0 && (
        <div style={dfpsCallout}>
          <strong>DFPS hotline:</strong> 1-800-252-5400 — make this call personally before completing the workflow.
        </div>
      )}

      <label style={fieldLabel}>{step.label}{step.required ? ' *' : ''}</label>
      <FieldEditor step={step} value={val} setValue={setVal} />

      <div style={{ ...btnRow, justifyContent: 'space-between', marginTop: 18 }}>
        <button onClick={prevStep} style={secondaryBtn}>
          {stepIdx === 0 ? '← Pick different trigger' : '← Back'}
        </button>
        <button
          onClick={nextStep}
          disabled={!isAnswered()}
          style={{ ...primaryBtn, background: isAnswered() ? '#dc2626' : '#9ca3af', cursor: isAnswered() ? 'pointer' : 'not-allowed' }}
        >
          {stepIdx === workflow.steps.length - 1 ? 'Review →' : 'Next →'}
        </button>
      </div>
    </>
  );
}

function FieldEditor({ step, value, setValue }) {
  switch (step.type) {
    case 'short':
      return <input style={fieldInput} value={value || ''} onChange={(e) => setValue(e.target.value)} />;
    case 'long':
      return <textarea style={{ ...fieldInput, minHeight: 90, fontFamily: 'inherit', resize: 'vertical' }} value={value || ''} onChange={(e) => setValue(e.target.value)} />;
    case 'datetime':
      return <input type="datetime-local" style={fieldInput} value={isoToInput(value)} onChange={(e) => setValue(inputToIso(e.target.value))} />;
    case 'select':
      return (
        <select style={fieldInput} value={value || ''} onChange={(e) => setValue(e.target.value)}>
          <option value="">— select —</option>
          {step.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'yn_detail': {
      const v = value || {};
      return (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[true, false].map((b) => (
              <button
                key={String(b)}
                type="button"
                onClick={() => setValue({ ...v, answer: b })}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: `2px solid ${v.answer === b ? '#dc2626' : '#e5e7eb'}`,
                  background: v.answer === b ? '#fef2f2' : '#fff',
                  color: v.answer === b ? '#991b1b' : '#374151',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {b ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          {step.detailLabel && (
            <textarea
              style={{ ...fieldInput, minHeight: 70, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder={step.detailLabel}
              value={v.detail || ''}
              onChange={(e) => setValue({ ...v, detail: e.target.value })}
            />
          )}
        </>
      );
    }
    default:
      return null;
  }
}

function isoToInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
function inputToIso(s) {
  if (!s) return '';
  try { return new Date(s).toISOString(); } catch { return ''; }
}

/* ─── Review stage ─── */
function ReviewStage({ workflow, answers, studentName, counselor, triggerKey, onBack, onSave, saving }) {
  const parentDraft = useMemo(() => draftParentNotification({
    trigger: triggerKey,
    studentName,
    when: answers.occurred_at,
    counselorName: counselor?.name,
    schoolName: counselor?.school_name || counselor?.school,
  }), [triggerKey, studentName, answers.occurred_at, counselor]);

  const adminDraft = useMemo(() => draftAdminNotification({ trigger: triggerKey, studentName, counselorName: counselor?.name }), [triggerKey, studentName, counselor]);

  const copyText = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <p style={muted}>
        Review your answers. When you save, Beacon writes the timestamped event to your device, schedules {workflow.followUps.length} follow-up reminder{workflow.followUps.length === 1 ? '' : 's'}, and you can generate a PDF for the file.
      </p>

      <h4 style={subhead}>Answers</h4>
      <div style={{ marginBottom: 18, fontSize: 13, color: '#1a2332' }}>
        {workflow.steps.map((s) => (
          <div key={s.key} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{s.label}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{renderAnswer(s, answers[s.key])}</div>
          </div>
        ))}
      </div>

      <h4 style={subhead}>
        Parent notification draft
        <button onClick={() => copyText(parentDraft)} style={copyBtn}>Copy</button>
      </h4>
      <pre style={draftBox}>{parentDraft}</pre>

      <h4 style={subhead}>
        Administrator notification draft
        <button onClick={() => copyText(adminDraft)} style={copyBtn}>Copy</button>
      </h4>
      <pre style={draftBox}>{adminDraft}</pre>

      <div style={{ ...btnRow, justifyContent: 'space-between', marginTop: 18 }}>
        <button onClick={onBack} style={secondaryBtn}>← Edit answers</button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{ ...primaryBtn, background: '#dc2626' }}
        >
          {saving ? 'Saving...' : 'Save crisis event + schedule follow-ups'}
        </button>
      </div>
    </>
  );
}

function renderAnswer(step, value) {
  if (value == null || value === '') return <span style={{ color: '#9ca3af' }}>(no answer)</span>;
  if (step.type === 'yn_detail' && typeof value === 'object') {
    const yn = value.answer === true ? 'Yes' : value.answer === false ? 'No' : '(not answered)';
    return value.detail ? `${yn} — ${value.detail}` : yn;
  }
  if (step.type === 'datetime') {
    try { return new Date(value).toLocaleString(); } catch { return String(value); }
  }
  return String(value);
}

/* ─── Done stage ─── */
function DoneStage({ event, studentName, generatePdfNow, onClose }) {
  const followCount = (event.follow_up_schedule || []).length;
  return (
    <>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, marginBottom: 14, color: '#166534', fontSize: 14, lineHeight: 1.5 }}>
        <strong>Saved.</strong> Crisis event for {studentName} is on your device, with {followCount} follow-up reminder{followCount === 1 ? '' : 's'} scheduled.
      </div>
      <h4 style={subhead}>Next steps</h4>
      <ol style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, paddingLeft: 22, marginTop: 0 }}>
        <li>Generate the documentation PDF and place it in the student's confidential file.</li>
        <li>Send the parent + admin notifications you reviewed in the previous step.</li>
        <li>Beacon will surface follow-up reminders in your Morning Brief and (if enabled) browser notifications.</li>
      </ol>
      <div style={{ ...btnRow, justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={generatePdfNow} style={primaryBtn}>📄 Generate documentation PDF</button>
        <button onClick={onClose} style={secondaryBtn}>Close</button>
      </div>
    </>
  );
}

/* ─── Styles ─── */
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 };
const modal = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', borderTop: '6px solid #dc2626' };
const closeBtn = { background: 'none', border: 'none', fontSize: 28, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: 0, width: 32, height: 32 };
const muted = { fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 };
const fieldLabel = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2332', marginBottom: 6 };
const fieldInput = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
const dropdown = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 240, overflowY: 'auto', zIndex: 10 };
const dropdownItem = { padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' };
const dfpsCallout = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16, lineHeight: 1.6 };
const btnRow = { display: 'flex', gap: 10 };
const primaryBtn = { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const secondaryBtn = { background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const subhead = { fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, margin: '8px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const draftBox = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 12, color: '#1a2332', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto', fontFamily: 'inherit', margin: '0 0 14px', lineHeight: 1.5 };
const copyBtn = { background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 };
