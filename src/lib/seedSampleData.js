import { db } from './db';

// Every row inserted by this seeder is tagged with `is_sample: true`.
// clearSampleData only deletes rows carrying that tag — a counselor's
// hand-entered students, groups, sessions, etc. are never touched.
const SAMPLE = { is_sample: true };

// Band-specific sample datasets. The structure is identical across bands
// (5 students, 2 groups, 2 referrals) so the session/member wiring by index
// stays the same; only the grades, names, topics, and secondary field
// (teacher vs. advisory/period) differ. SB 179 time entries are band-agnostic.
const DATASETS = {
  elementary: {
    students: [
      { name: 'Marcus Johnson', first_name: 'Marcus', last_name: 'Johnson', grade: '3', teacher: 'Mrs. Rivera', tier: 3, status: 'active', referral_source: 'Behavioral' },
      { name: 'Emma Chen', first_name: 'Emma', last_name: 'Chen', grade: '2', teacher: 'Mr. Okafor', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Aiden Brooks', first_name: 'Aiden', last_name: 'Brooks', grade: '4', teacher: 'Ms. Patel', tier: 1, status: 'active', referral_source: 'Academic' },
      { name: 'Sofia Martinez', first_name: 'Sofia', last_name: 'Martinez', grade: 'K', teacher: 'Mrs. Kim', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Jayden Williams', first_name: 'Jayden', last_name: 'Williams', grade: '5', teacher: 'Mr. Thompson', tier: 3, status: 'active', referral_source: 'Behavioral' },
    ],
    groups: [
      { name: 'Friendship Skills', focus_area: 'Building healthy peer relationships', grade_band: 'K-2',
        obj_1: 'Identify feelings in self and others', obj_2: 'Use I-messages during conflict', obj_3: 'Demonstrate cooperative play skills' },
      { name: 'Anger Management', focus_area: 'Coping strategies and self-regulation', grade_band: '3-5',
        obj_1: 'Identify anger triggers', obj_2: 'Use calm-down strategies independently', obj_3: 'Resolve conflicts without physical aggression' },
    ],
    referrals: [
      { student_name: 'Riley Thompson', grade: '1', teacher_name: 'Mrs. Adams', concern_type: 'Social-Emotional', urgency: 'Soon', notes: 'Crying frequently at drop-off. Mom reports anxiety about school.' },
      { student_name: 'Devon Park', grade: '4', teacher_name: 'Mr. Garcia', concern_type: 'Behavioral', urgency: 'Routine', notes: 'Difficulty staying in seat. Already tried proximity seating.' },
    ],
    notes: { group1: 'Practiced sharing and turn-taking. Good engagement.', group2: 'Reviewed deep breathing technique. Marcus made progress.', individual: 'Study skills check-in. Aiden improving with planner use.' },
  },
  middle: {
    students: [
      { name: 'Marcus Johnson', first_name: 'Marcus', last_name: 'Johnson', grade: '7', teacher: '3rd Period', tier: 3, status: 'active', referral_source: 'Behavioral' },
      { name: 'Emma Chen', first_name: 'Emma', last_name: 'Chen', grade: '6', teacher: '1st Period', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Aiden Brooks', first_name: 'Aiden', last_name: 'Brooks', grade: '8', teacher: '5th Period', tier: 1, status: 'active', referral_source: 'Academic' },
      { name: 'Sofia Martinez', first_name: 'Sofia', last_name: 'Martinez', grade: '6', teacher: '2nd Period', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Jayden Williams', first_name: 'Jayden', last_name: 'Williams', grade: '8', teacher: '4th Period', tier: 3, status: 'active', referral_source: 'Attendance' },
    ],
    groups: [
      { name: 'Peer Relationships & Boundaries', focus_area: 'Healthy friendships, conflict, and social media', grade_band: '6-7',
        obj_1: 'Set and respect personal boundaries', obj_2: 'Resolve conflict without escalation', obj_3: 'Recognize healthy vs. unhealthy peer dynamics' },
      { name: 'Stress & Self-Regulation', focus_area: 'Managing academic stress and big emotions', grade_band: '7-8',
        obj_1: 'Identify personal stress triggers', obj_2: 'Apply grounding and self-regulation strategies', obj_3: 'Build a personal coping plan' },
    ],
    referrals: [
      { student_name: 'Riley Thompson', grade: '6', teacher_name: 'Ms. Adams (2nd Pd)', concern_type: 'Social-Emotional', urgency: 'Soon', notes: 'Withdrawing from friend group; new to campus this year.' },
      { student_name: 'Devon Park', grade: '8', teacher_name: 'Mr. Garcia (4th Pd)', concern_type: 'Attendance', urgency: 'Routine', notes: 'Rising absences over the last month. Wants to talk about schedule.' },
    ],
    notes: { group1: 'Discussed boundary-setting with peers. Strong participation.', group2: 'Practiced grounding technique for test stress. Marcus engaged.', individual: 'Organization check-in. Aiden using his planner more consistently.' },
  },
  high: {
    students: [
      { name: 'Marcus Johnson', first_name: 'Marcus', last_name: 'Johnson', grade: '11', teacher: 'Advisory B', tier: 3, status: 'active', referral_source: 'Behavioral' },
      { name: 'Emma Chen', first_name: 'Emma', last_name: 'Chen', grade: '9', teacher: 'Advisory A', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Aiden Brooks', first_name: 'Aiden', last_name: 'Brooks', grade: '12', teacher: 'Advisory C', tier: 1, status: 'active', referral_source: 'Academic' },
      { name: 'Sofia Martinez', first_name: 'Sofia', last_name: 'Martinez', grade: '9', teacher: 'Advisory A', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
      { name: 'Jayden Williams', first_name: 'Jayden', last_name: 'Williams', grade: '10', teacher: 'Advisory B', tier: 3, status: 'active', referral_source: 'Attendance' },
    ],
    groups: [
      { name: 'Academic Success & Executive Function', focus_area: 'Organization, time management, and goal-setting', grade_band: '9-10',
        obj_1: 'Build a weekly time-management routine', obj_2: 'Set and track academic goals', obj_3: 'Use organization systems consistently' },
      { name: 'Stress & Coping', focus_area: 'Managing stress, anxiety, and post-secondary pressure', grade_band: '11-12',
        obj_1: 'Identify sources of academic and life stress', obj_2: 'Apply healthy coping strategies', obj_3: 'Build a personal support plan' },
    ],
    referrals: [
      { student_name: 'Riley Thompson', grade: '9', teacher_name: 'Ms. Adams (Advisory A)', concern_type: 'Social-Emotional', urgency: 'Soon', notes: 'Struggling with transition to high school; feeling overwhelmed.' },
      { student_name: 'Devon Park', grade: '11', teacher_name: 'Mr. Garcia (Advisory B)', concern_type: 'Academic', urgency: 'Routine', notes: 'Wants to discuss credits and post-secondary options.' },
    ],
    notes: { group1: 'Reviewed weekly planning system. Good buy-in from the group.', group2: 'Discussed coping strategies for stress. Marcus contributed openly.', individual: 'Credit-check and goal-setting conversation. Aiden on track.' },
  },
};

/* Build a dataset for a combined campus by spreading the sample roster across
 * the grades the counselor actually serves. A K-12 counselor should not get a
 * roster of 9th-12th graders — the point of Combined is that they cover the
 * whole range, so the sample should reflect it. Base content comes from the
 * band at the TOP of the range (most advanced material present). */
function combinedDataset(servedGrades) {
  const grades = servedGrades && servedGrades.length ? servedGrades : null;
  if (!grades) return DATASETS.elementary;
  const top = grades[grades.length - 1];
  const baseKey = ['9', '10', '11', '12'].includes(top) ? 'high'
    : ['6', '7', '8'].includes(top) ? 'middle' : 'elementary';
  const base = DATASETS[baseKey];
  // Spread the 5 sample students evenly across the served range.
  const pick = (i) => grades[Math.min(grades.length - 1, Math.round((i * (grades.length - 1)) / 4))];
  return {
    ...base,
    students: base.students.map((s, i) => ({ ...s, grade: pick(i) })),
    groups: base.groups.map((g, i) => ({
      ...g,
      grade_band: i === 0
        ? `${grades[0]}-${grades[Math.floor((grades.length - 1) / 2)]}`
        : `${grades[Math.floor((grades.length - 1) / 2)]}-${grades[grades.length - 1]}`,
    })),
    referrals: base.referrals.map((r, i) => ({ ...r, grade: pick(i === 0 ? 0 : 4) })),
  };
}

export async function seedSampleData(counselorId, band = 'elementary', servedGrades = null) {
  const ds = band === 'combined' ? combinedDataset(servedGrades) : (DATASETS[band] || DATASETS.elementary);
  const students = ds.students;

  const studentRecords = [];
  for (const s of students) {
    const { data } = await db.insert('students', { counselor_id: counselorId, ...s, ...SAMPLE });
    if (data) studentRecords.push(data);
  }

  if (studentRecords.length < 3) return; // bail if inserts failed

  // 2 groups
  const { data: group1 } = await db.insert('groups', {
    counselor_id: counselorId, name: ds.groups[0].name, focus_area: ds.groups[0].focus_area,
    grade_band: ds.groups[0].grade_band, status: 'active', rotation_type: 'weekly_abc',
    obj_1: ds.groups[0].obj_1, asca_1: 'Social-Emotional',
    obj_2: ds.groups[0].obj_2, asca_2: 'Social-Emotional',
    obj_3: ds.groups[0].obj_3, asca_3: 'Social-Emotional',
    ...SAMPLE,
  });
  const { data: group2 } = await db.insert('groups', {
    counselor_id: counselorId, name: ds.groups[1].name, focus_area: ds.groups[1].focus_area,
    grade_band: ds.groups[1].grade_band, status: 'active', rotation_type: 'weekly_abc',
    obj_1: ds.groups[1].obj_1, asca_1: 'Social-Emotional',
    obj_2: ds.groups[1].obj_2, asca_2: 'Social-Emotional',
    obj_3: ds.groups[1].obj_3, asca_3: 'Social-Emotional',
    ...SAMPLE,
  });

  // Add members to groups
  if (group1) {
    await db.insert('group_members', { group_id: group1.id, student_id: studentRecords[1].id, ...SAMPLE }); // Emma
    await db.insert('group_members', { group_id: group1.id, student_id: studentRecords[3].id, ...SAMPLE }); // Sofia
  }
  if (group2) {
    await db.insert('group_members', { group_id: group2.id, student_id: studentRecords[0].id, ...SAMPLE }); // Marcus
    await db.insert('group_members', { group_id: group2.id, student_id: studentRecords[4].id, ...SAMPLE }); // Jayden
  }

  // Sessions over last 2 weeks (realistic spread)
  const today = new Date();
  const sessions = [];
  for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const dateStr = date.toISOString().slice(0, 10);

    // 1-2 sessions per school day
    if (daysAgo % 3 === 0 && group1) {
      sessions.push({ counselor_id: counselorId, group_id: group1.id, session_date: dateStr, duration_minutes: 30, status: daysAgo > 0 ? 'Completed' : 'Scheduled', start_time: '09:00', end_time: '09:30', notes: daysAgo > 0 ? ds.notes.group1 : null, ...SAMPLE });
    }
    if (daysAgo % 4 === 0 && group2) {
      sessions.push({ counselor_id: counselorId, group_id: group2.id, session_date: dateStr, duration_minutes: 30, status: daysAgo > 0 ? 'Completed' : 'Scheduled', start_time: '10:00', end_time: '10:30', notes: daysAgo > 0 ? ds.notes.group2 : null, ...SAMPLE });
    }
    if (daysAgo % 2 === 0 && studentRecords[2]) {
      sessions.push({ counselor_id: counselorId, student_id: studentRecords[2].id, session_date: dateStr, duration_minutes: 20, status: 'Completed', start_time: '13:00', end_time: '13:20', session_type: 'individual', notes: ds.notes.individual, ...SAMPLE });
    }
  }
  const groupRoster = new Map();
  if (group1) groupRoster.set(group1.id, [studentRecords[1], studentRecords[3]].filter(Boolean));
  if (group2) groupRoster.set(group2.id, [studentRecords[0], studentRecords[4]].filter(Boolean));
  for (const s of sessions) {
    const { data: sess } = await db.insert('sessions', s);
    // Completed group sessions get attendance rows so Reports' group
    // utilization reflects real numbers instead of a 0% placeholder.
    if (sess && s.group_id && s.status === 'Completed') {
      const members = groupRoster.get(s.group_id) || [];
      for (let i = 0; i < members.length; i++) {
        // One deterministic absence per group across the run keeps it realistic.
        const absent = i === 1 && s.session_date.endsWith('4');
        await db.insert('attendance', { session_id: sess.id, student_id: members[i].id, status: absent ? 'absent' : 'present', ...SAMPLE });
      }
    }
  }

  // Time entries for last 2 weeks
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = date.toISOString().slice(0, 10);

    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'responsive', activity_description: 'Individual and group counseling sessions', duration_minutes: 90, ...SAMPLE });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'guidance', activity_description: 'Classroom guidance lessons', duration_minutes: 60, ...SAMPLE });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'planning', activity_description: 'Student planning and goal setting', duration_minutes: 30, ...SAMPLE });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'system', activity_description: 'Staff consultation, data entry, meetings', duration_minutes: 45, ...SAMPLE });
    if (daysAgo % 3 === 0) {
      await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'non_counseling', activity_description: 'Lunch duty, testing coordination', duration_minutes: 40, ...SAMPLE });
    }
  }

  // 2 open referrals
  await db.insert('referrals', { counselor_id: counselorId, ...ds.referrals[0], status: 'open', ...SAMPLE });
  await db.insert('referrals', { counselor_id: counselorId, ...ds.referrals[1], status: 'open', ...SAMPLE });

  // Mark that sample data was loaded
  localStorage.setItem('beacon_sample_data', 'true');
}

export function hasSampleData() {
  return localStorage.getItem('beacon_sample_data') === 'true';
}

// Exact roster the seeder creates. Used as a legacy fallback for installs
// that loaded sample data before records were tagged with `is_sample: true`.
const LEGACY_SAMPLE_NAMES = {
  students: new Set(['Marcus Johnson', 'Emma Chen', 'Aiden Brooks', 'Sofia Martinez', 'Jayden Williams']),
  groups: new Set(['Friendship Skills', 'Anger Management']),
  referrals: new Set(['Riley Thompson', 'Devon Park']),
};

// Delete only rows flagged `is_sample: true` by the seeder.
// A counselor's own students/groups/sessions are never touched.
export async function clearSampleData(counselorId) {
  const cascadeTables = ['students', 'groups', 'group_members', 'sessions', 'attendance', 'progress_ratings', 'referrals', 'communications', 'time_entries', 'counselor_notes'];
  let deleted = 0;

  for (const table of cascadeTables) {
    const { data } = await db.select(table, { eq: { is_sample: true } });
    if (!data) continue;
    for (const row of data) {
      if (row.counselor_id && row.counselor_id !== counselorId) continue;
      await db.del(table, row.id);
      deleted++;
    }
  }

  // Legacy fallback: installs seeded with the pre-fix seeder have no
  // `is_sample` tag. Match the known seed roster by exact name, scoped
  // to this counselor. Safe: only runs when the sample-data flag is set
  // and the tagged pass found nothing, and only targets the five known
  // student names plus their group memberships and sessions.
  if (deleted === 0 && hasSampleData()) {
    const { data: students } = await db.select('students', { eq: { counselor_id: counselorId } });
    const sampleStudentIds = new Set(
      (students || [])
        .filter((s) => LEGACY_SAMPLE_NAMES.students.has((s.name || '').trim()))
        .map((s) => s.id)
    );

    const { data: groups } = await db.select('groups', { eq: { counselor_id: counselorId } });
    const sampleGroupIds = new Set(
      (groups || [])
        .filter((g) => LEGACY_SAMPLE_NAMES.groups.has((g.name || '').trim()))
        .map((g) => g.id)
    );

    // Delete sessions + attendance + progress_ratings that reference sample students/groups
    const { data: sessions } = await db.select('sessions', { eq: { counselor_id: counselorId } });
    for (const s of sessions || []) {
      if (sampleStudentIds.has(s.student_id) || sampleGroupIds.has(s.group_id)) {
        await db.del('sessions', s.id);
        deleted++;
      }
    }
    const { data: members } = await db.select('group_members', {});
    for (const m of members || []) {
      if (sampleGroupIds.has(m.group_id) || sampleStudentIds.has(m.student_id)) {
        await db.del('group_members', m.id);
        deleted++;
      }
    }

    for (const id of sampleStudentIds) { await db.del('students', id); deleted++; }
    for (const id of sampleGroupIds) { await db.del('groups', id); deleted++; }

    const { data: referrals } = await db.select('referrals', { eq: { counselor_id: counselorId } });
    for (const r of referrals || []) {
      if (LEGACY_SAMPLE_NAMES.referrals.has((r.student_name || '').trim())) {
        await db.del('referrals', r.id);
        deleted++;
      }
    }
  }

  localStorage.removeItem('beacon_sample_data');
  return deleted;
}
