import { db } from './db';

export async function seedSampleData(counselorId) {
  // 5 students across tiers
  const students = [
    { name: 'Marcus Johnson', first_name: 'Marcus', last_name: 'Johnson', grade: '3', teacher: 'Mrs. Rivera', tier: 3, status: 'active', referral_source: 'Behavioral' },
    { name: 'Emma Chen', first_name: 'Emma', last_name: 'Chen', grade: '2', teacher: 'Mr. Okafor', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
    { name: 'Aiden Brooks', first_name: 'Aiden', last_name: 'Brooks', grade: '4', teacher: 'Ms. Patel', tier: 1, status: 'active', referral_source: 'Academic' },
    { name: 'Sofia Martinez', first_name: 'Sofia', last_name: 'Martinez', grade: 'K', teacher: 'Mrs. Kim', tier: 2, status: 'active', referral_source: 'Social-Emotional' },
    { name: 'Jayden Williams', first_name: 'Jayden', last_name: 'Williams', grade: '5', teacher: 'Mr. Thompson', tier: 3, status: 'active', referral_source: 'Behavioral' },
  ];

  const studentRecords = [];
  for (const s of students) {
    const { data } = await db.insert('students', { counselor_id: counselorId, ...s });
    if (data) studentRecords.push(data);
  }

  if (studentRecords.length < 3) return; // bail if inserts failed

  // 2 groups
  const { data: group1 } = await db.insert('groups', {
    counselor_id: counselorId, name: 'Friendship Skills', focus_area: 'Building healthy peer relationships',
    grade_band: 'K-2', status: 'active', rotation_type: 'weekly_abc',
    obj_1: 'Identify feelings in self and others', asca_1: 'Social-Emotional',
    obj_2: 'Use I-messages during conflict', asca_2: 'Social-Emotional',
    obj_3: 'Demonstrate cooperative play skills', asca_3: 'Social-Emotional',
  });
  const { data: group2 } = await db.insert('groups', {
    counselor_id: counselorId, name: 'Anger Management', focus_area: 'Coping strategies and self-regulation',
    grade_band: '3-5', status: 'active', rotation_type: 'weekly_abc',
    obj_1: 'Identify anger triggers', asca_1: 'Social-Emotional',
    obj_2: 'Use calm-down strategies independently', asca_2: 'Social-Emotional',
    obj_3: 'Resolve conflicts without physical aggression', asca_3: 'Social-Emotional',
  });

  // Add members to groups
  if (group1) {
    await db.insert('group_members', { group_id: group1.id, student_id: studentRecords[1].id }); // Emma
    await db.insert('group_members', { group_id: group1.id, student_id: studentRecords[3].id }); // Sofia
  }
  if (group2) {
    await db.insert('group_members', { group_id: group2.id, student_id: studentRecords[0].id }); // Marcus
    await db.insert('group_members', { group_id: group2.id, student_id: studentRecords[4].id }); // Jayden
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
      sessions.push({ counselor_id: counselorId, group_id: group1.id, session_date: dateStr, duration_minutes: 30, status: daysAgo > 0 ? 'Completed' : 'Scheduled', start_time: '09:00', end_time: '09:30', notes: daysAgo > 0 ? 'Practiced sharing and turn-taking. Good engagement.' : null });
    }
    if (daysAgo % 4 === 0 && group2) {
      sessions.push({ counselor_id: counselorId, group_id: group2.id, session_date: dateStr, duration_minutes: 30, status: daysAgo > 0 ? 'Completed' : 'Scheduled', start_time: '10:00', end_time: '10:30', notes: daysAgo > 0 ? 'Reviewed deep breathing technique. Marcus made progress.' : null });
    }
    if (daysAgo % 2 === 0 && studentRecords[2]) {
      sessions.push({ counselor_id: counselorId, student_id: studentRecords[2].id, session_date: dateStr, duration_minutes: 20, status: 'Completed', start_time: '13:00', end_time: '13:20', session_type: 'individual', notes: 'Study skills check-in. Aiden improving with planner use.' });
    }
  }
  for (const s of sessions) {
    await db.insert('sessions', s);
  }

  // Time entries for last 2 weeks
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = date.toISOString().slice(0, 10);

    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'responsive', activity_description: 'Individual and group counseling sessions', duration_minutes: 90 });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'guidance', activity_description: 'Classroom guidance lessons', duration_minutes: 60 });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'planning', activity_description: 'Student planning and goal setting', duration_minutes: 30 });
    await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'system', activity_description: 'Staff consultation, data entry, meetings', duration_minutes: 45 });
    if (daysAgo % 3 === 0) {
      await db.insert('time_entries', { counselor_id: counselorId, entry_date: dateStr, domain: 'non_counseling', activity_description: 'Lunch duty, testing coordination', duration_minutes: 40 });
    }
  }

  // 2 open referrals
  await db.insert('referrals', { counselor_id: counselorId, student_name: 'Riley Thompson', grade: '1', teacher_name: 'Mrs. Adams', concern_type: 'Social-Emotional', urgency: 'Soon', notes: 'Crying frequently at drop-off. Mom reports anxiety about school.', status: 'open' });
  await db.insert('referrals', { counselor_id: counselorId, student_name: 'Devon Park', grade: '4', teacher_name: 'Mr. Garcia', concern_type: 'Behavioral', urgency: 'Routine', notes: 'Difficulty staying in seat. Already tried proximity seating.', status: 'open' });

  // Mark that sample data was loaded
  localStorage.setItem('beacon_sample_data', 'true');
}

export function hasSampleData() {
  return localStorage.getItem('beacon_sample_data') === 'true';
}

export async function clearSampleData(counselorId) {
  // Delete all data for this counselor except profile, lessons, and templates
  const tables = ['students', 'groups', 'group_members', 'sessions', 'attendance', 'progress_ratings', 'referrals', 'communications', 'time_entries', 'counselor_notes'];
  for (const table of tables) {
    const { data } = await db.select(table, { eq: { counselor_id: counselorId } });
    if (data) {
      for (const row of data) {
        await db.del(table, row.id);
      }
    }
  }
  // Also clear group_members and attendance that reference by other FKs
  for (const table of ['group_members', 'attendance', 'progress_ratings']) {
    const { data } = await db.select(table);
    if (data) {
      for (const row of data) {
        await db.del(table, row.id);
      }
    }
  }
  localStorage.removeItem('beacon_sample_data');
}
