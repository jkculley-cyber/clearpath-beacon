import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TEAL = [42, 157, 143];

function header(doc, title, subtitle, details) {
  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(title, 14, 22);
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(subtitle, 14, 32);
  doc.setFontSize(10);
  if (details) doc.text(details, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, details ? 44 : 38);
}

function footer(doc) {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Beacon \u2014 Counselor Command Center | Clear Path Education Group', 14, 285);
}

function studentName(s) {
  if (s.first_name) return `${s.first_name} ${s.last_name || ''}`.trim();
  return s.name || 'Unknown';
}

/* ─── Student Progress Report (Feature #4) ─── */
export function generateProgressPDF(student, groups, sessions) {
  const doc = new jsPDF();
  const name = studentName(student);
  header(doc, 'Student Progress Report', name,
    `Grade ${student.grade || '--'} | Teacher: ${student.teacher || '--'} | Tier ${student.tier}`);

  let y = 54;

  // Group memberships
  if (groups.length) {
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text('Group Memberships', 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Group', 'Focus Area', 'Status']],
      body: groups.map(gm => [gm.groups?.name || '--', gm.groups?.focus_area || '--', gm.groups?.status || '--']),
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Session history
  if (sessions.length) {
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text('Session History', 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Duration', 'Status', 'Notes']],
      body: sessions.slice(0, 25).map(s => [
        s.session_date, s.session_type || 'group', `${s.duration_minutes || '--'} min`,
        s.status, (s.notes || '--').slice(0, 50)
      ]),
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
      columnStyles: { 4: { cellWidth: 45 } },
    });
  }

  footer(doc);
  doc.save(`progress-report-${name.replace(/\s+/g, '-')}.pdf`);
}

/* ─── MTSS Documentation Export (Feature #11) ─── */
export function generateMTSSReport(student, groups, sessions, comms) {
  const doc = new jsPDF();
  const name = studentName(student);
  const tierLabel = { 1: 'Tier 1 \u2014 Universal', 2: 'Tier 2 \u2014 Targeted', 3: 'Tier 3 \u2014 Intensive' };

  header(doc, 'MTSS Documentation Summary', `Student: ${name}`,
    `Grade ${student.grade || '--'} | ${tierLabel[student.tier] || 'Tier ' + student.tier} | Teacher: ${student.teacher || '--'}`);

  doc.setFontSize(10);
  doc.text(`Referral Source: ${student.referral_source || '--'} | First Seen: ${student.date_first_seen || student.created_at?.slice(0, 10) || '--'}`, 14, 50);

  let y = 60;

  // Interventions summary
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text('Interventions & Services', 14, y);
  y += 2;
  const rows = [];
  groups.forEach(gm => {
    rows.push(['Group Counseling', gm.groups?.name || '--', gm.groups?.focus_area || '--', gm.groups?.status || '--']);
  });
  const indivCount = sessions.filter(s => s.session_type === 'individual' || !s.group_id).length;
  if (indivCount) rows.push(['Individual Counseling', `${indivCount} sessions`, '--', 'Active']);

  if (rows.length) {
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Name/Count', 'Focus', 'Status']],
      body: rows,
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No interventions recorded.', 14, y + 4);
    y += 14;
  }

  // Attendance summary
  const completed = sessions.filter(s => s.status === 'Completed').length;
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text('Session Attendance', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total Sessions: ${sessions.length} | Completed: ${completed} | Rate: ${sessions.length ? Math.round(completed / sessions.length * 100) : 0}%`, 14, y);
  y += 10;

  // Parent contacts
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text('Parent/Guardian Contacts', 14, y);
  y += 2;
  if (comms.length) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Duration', 'Notes']],
      body: comms.slice(0, 15).map(c => [
        c.contact_date || c.created_at?.slice(0, 10) || '--',
        c.contact_type, `${c.duration_minutes} min`, (c.notes || '--').slice(0, 70)
      ]),
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
      columnStyles: { 3: { cellWidth: 55 } },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No parent contacts logged.', 14, y + 4);
  }

  footer(doc);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('This document is for MTSS team use and should be treated as confidential student information.', 14, 289);

  doc.save(`mtss-report-${name.replace(/\s+/g, '-')}.pdf`);
}

/* ─── Group Progress Report (Feature #4) ─── */
export function generateGroupProgressPDF(group, members, sessions) {
  const doc = new jsPDF();
  header(doc, 'Group Progress Report', group.name,
    `Grades: ${group.grade_band || '--'} | Focus: ${group.focus_area || '--'} | ${group.rotation_type === 'weekly_abc' ? 'Weekly A/B/C' : 'Bi-weekly'}`);

  if (group.start_date) {
    doc.setFontSize(10);
    doc.text(`${group.start_date} \u2014 ${group.end_date || 'ongoing'}`, 14, 50);
  }

  let y = 56;

  // Objectives
  const objs = [group.obj_1, group.obj_2, group.obj_3].filter(Boolean);
  if (objs.length) {
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text('Group Objectives', 14, y);
    y += 2;
    const ascas = [group.asca_1, group.asca_2, group.asca_3];
    autoTable(doc, {
      startY: y,
      head: [['#', 'Objective', 'ASCA Domain']],
      body: objs.map((o, i) => [i + 1, o, ascas[i] || '--']),
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Members
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text(`Members (${members.length})`, 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Student', 'Grade', 'Joined']],
    body: members.map(m => {
      const s = m.students || {};
      const n = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || '--');
      return [n, s.grade || '--', m.joined_date || '--'];
    }),
    headStyles: { fillColor: TEAL },
    margin: { left: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Sessions
  if (sessions.length) {
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text('Sessions', 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Duration', 'Status', 'Notes']],
      body: sessions.map(s => [s.session_date, `${s.duration_minutes || '--'} min`, s.status, (s.notes || '--').slice(0, 50)]),
      headStyles: { fillColor: TEAL },
      margin: { left: 14 },
      columnStyles: { 3: { cellWidth: 45 } },
    });
  }

  footer(doc);
  doc.save(`group-report-${group.name.replace(/\s+/g, '-')}.pdf`);
}
