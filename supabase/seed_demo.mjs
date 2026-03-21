// Beacon Demo Data Seeder
// Run: node supabase/seed_demo.mjs

const BEACON_URL = 'https://cghhabcbgyoqwqjzunfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaGhhYmNiZ3lvcXdxanp1bmZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU3NTg0NCwiZXhwIjoyMDg4MTUxODQ0fQ.Rs_FWEGVM576cWnVDKBkxTP4vbSGP1bHOIuNfLA36lA';
const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function post(table, data) {
  const r = await fetch(`${BEACON_URL}/rest/v1/${table}`, { method: 'POST', headers: hdrs, body: JSON.stringify(data) });
  const d = await r.json();
  if (!r.ok) { console.log(`ERROR ${table}:`, JSON.stringify(d)); return null; }
  return Array.isArray(d) ? d[0] : d;
}

async function main() {
  // Get counselor ID
  const cRes = await fetch(`${BEACON_URL}/rest/v1/counselors?email=eq.kim@clearpathedgroup.com&select=id`, { headers: hdrs });
  const counselors = await cRes.json();
  const cid = counselors[0]?.id;
  if (!cid) { console.log('No counselor found'); return; }
  console.log('Counselor:', cid);

  // Students
  const studentsData = [
    { name: 'Marcus Johnson', grade: '3', teacher: 'Mrs. Rivera', tier: 2, referral_source: 'Teacher' },
    { name: 'Sofia Martinez', grade: '2', teacher: 'Mr. Chen', tier: 1, referral_source: 'Self-Referral' },
    { name: 'Jayden Williams', grade: '4', teacher: 'Mrs. Park', tier: 3, referral_source: 'Teacher' },
    { name: 'Emma Thompson', grade: 'K', teacher: 'Ms. Davis', tier: 1, referral_source: 'Parent' },
    { name: 'Aiden Garcia', grade: '5', teacher: 'Mr. Brooks', tier: 2, referral_source: 'Teacher' },
    { name: 'Olivia Brown', grade: '1', teacher: 'Mrs. Lee', tier: 1, referral_source: 'Teacher' },
    { name: 'Liam Davis', grade: '3', teacher: 'Mrs. Rivera', tier: 2, referral_source: 'Admin' },
    { name: 'Mia Wilson', grade: '4', teacher: 'Mrs. Park', tier: 1, referral_source: 'Self-Referral' },
  ];
  const studentIds = [];
  for (const s of studentsData) {
    const row = await post('students', { ...s, counselor_id: cid });
    if (row) { studentIds.push(row.id); console.log('Student:', row.name); }
  }

  // Groups
  const g1 = await post('groups', {
    counselor_id: cid, name: 'Friendship Builders', grade_band: '2-3', focus_area: 'Social Skills',
    obj_1: 'Identify feelings in self and others', obj_2: 'Use I-statements during conflicts', obj_3: 'Demonstrate cooperative play',
    asca_1: 'Social-Emotional', asca_2: 'Social-Emotional', asca_3: 'Social-Emotional',
    rotation_type: 'weekly_abc', start_date: '2026-01-13', end_date: '2026-05-22', status: 'active'
  });
  const g2 = await post('groups', {
    counselor_id: cid, name: 'Coping Skills', grade_band: '4-5', focus_area: 'Emotional Regulation',
    obj_1: 'Identify 3+ coping strategies', obj_2: 'Recognize triggers for strong emotions', obj_3: 'Practice deep breathing and grounding',
    asca_1: 'Social-Emotional', asca_2: 'Social-Emotional', asca_3: 'Social-Emotional',
    rotation_type: 'weekly_abc', start_date: '2026-01-13', end_date: '2026-05-22', status: 'active'
  });
  const g3 = await post('groups', {
    counselor_id: cid, name: 'Growth Mindset', grade_band: 'K-1', focus_area: 'Academic Motivation',
    obj_1: 'Understand that mistakes help us learn', obj_2: 'Use positive self-talk',
    asca_1: 'Academic', asca_2: 'Social-Emotional',
    rotation_type: 'biweekly', start_date: '2026-02-03', end_date: '2026-05-22', status: 'active'
  });
  console.log('Groups:', g1?.name, g2?.name, g3?.name);

  // Group members
  if (g1 && studentIds.length >= 7) {
    await post('group_members', { group_id: g1.id, student_id: studentIds[0] });
    await post('group_members', { group_id: g1.id, student_id: studentIds[1] });
    await post('group_members', { group_id: g1.id, student_id: studentIds[5] });
    await post('group_members', { group_id: g1.id, student_id: studentIds[6] });
  }
  if (g2 && studentIds.length >= 8) {
    await post('group_members', { group_id: g2.id, student_id: studentIds[2] });
    await post('group_members', { group_id: g2.id, student_id: studentIds[4] });
    await post('group_members', { group_id: g2.id, student_id: studentIds[7] });
  }
  if (g3 && studentIds.length >= 6) {
    await post('group_members', { group_id: g3.id, student_id: studentIds[3] });
    await post('group_members', { group_id: g3.id, student_id: studentIds[5] });
  }
  console.log('Group members assigned');

  // Sessions (past week + today)
  const today = new Date();
  const sessions = [];
  for (let i = 5; i >= 1; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (g1) sessions.push({ counselor_id: cid, group_id: g1.id, session_date: dateStr, start_time: '09:00', end_time: '09:45', duration_minutes: 45, status: 'Completed', session_type: 'group', notes: 'Friendship skills practice with role play scenarios' });
    if (g2 && i <= 3) sessions.push({ counselor_id: cid, group_id: g2.id, session_date: dateStr, start_time: '10:30', end_time: '11:15', duration_minutes: 45, status: 'Completed', session_type: 'group', notes: 'Coping strategies — breathing exercises and journaling' });
  }
  const todayStr = today.toISOString().slice(0, 10);
  if (g1) sessions.push({ counselor_id: cid, group_id: g1.id, session_date: todayStr, start_time: '09:00', end_time: '09:45', duration_minutes: 45, status: 'Scheduled', session_type: 'group' });
  if (g3) sessions.push({ counselor_id: cid, group_id: g3.id, session_date: todayStr, start_time: '13:00', end_time: '13:30', duration_minutes: 30, status: 'Scheduled', session_type: 'group' });
  // Individual session
  if (studentIds[2]) sessions.push({ counselor_id: cid, student_id: studentIds[2], session_date: todayStr, start_time: '11:00', end_time: '11:30', duration_minutes: 30, status: 'Scheduled', session_type: 'individual', notes: 'Check-in with Jayden re: behavior plan' });
  for (const s of sessions) { await post('sessions', s); }
  console.log('Sessions:', sessions.length);

  // Time entries (past 2 weeks of realistic data)
  const domainWeights = ['responsive', 'responsive', 'guidance', 'guidance', 'planning', 'system', 'non_counseling'];
  const activityMap = {
    responsive: ['Group counseling session', 'Individual student counseling', 'Crisis response follow-up', 'Referral intake and assessment'],
    guidance: ['Classroom guidance lesson', 'Character education presentation', 'Career awareness activity'],
    planning: ['Individual student planning meeting', 'Academic goal-setting session', 'Student schedule review'],
    system: ['MTSS team meeting', 'Consultation with teacher', 'Professional development', 'Program planning and evaluation'],
    non_counseling: ['Testing duty', 'Lunch duty', 'Clerical tasks', 'Bus duty'],
  };
  for (let i = 14; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const numEntries = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numEntries; j++) {
      const domain = domainWeights[Math.floor(Math.random() * domainWeights.length)];
      const acts = activityMap[domain];
      await post('time_entries', {
        counselor_id: cid, entry_date: dateStr, domain,
        activity_description: acts[Math.floor(Math.random() * acts.length)],
        duration_minutes: 15 + Math.floor(Math.random() * 46),
        source: 'manual'
      });
    }
  }
  console.log('Time entries seeded');

  // Referrals
  await post('referrals', {
    counselor_id: cid, submitted_by: 'Mrs. Rivera', student_name: 'Carlos Reyes', grade: '3',
    concern_type: 'Social-Emotional', urgency: 'Soon',
    notes: 'Student has been withdrawn and sitting alone at lunch for the past two weeks.',
    status: 'open', campus: 'Demo Elementary'
  });
  await post('referrals', {
    counselor_id: cid, submitted_by: 'Mr. Brooks', student_name: 'Taylor Smith', grade: '5',
    concern_type: 'Behavioral', urgency: 'Urgent',
    notes: 'Multiple outbursts in class this week. Student expressed frustration about home situation.',
    status: 'open', campus: 'Demo Elementary'
  });
  await post('referrals', {
    counselor_id: cid, submitted_by: 'Ms. Davis', student_name: 'Emma Thompson', grade: 'K',
    concern_type: 'Family Situation', urgency: 'Routine',
    notes: 'Parents recently separated. Student seems okay but teacher wants counselor aware.',
    status: 'in_progress', student_id: studentIds[3], campus: 'Demo Elementary'
  });
  console.log('Referrals seeded');

  // Communications
  await post('communications', {
    counselor_id: cid, student_id: studentIds[0], contact_type: 'Phone call', duration_minutes: 15,
    notes: "Spoke with Marcus's mom about friendship group progress. She reported improvement at home.", language: 'en'
  });
  await post('communications', {
    counselor_id: cid, student_id: studentIds[2], contact_type: 'Parent conference', duration_minutes: 30,
    notes: "Met with Jayden's parents to discuss coping skills group and behavior plan alignment.", language: 'en'
  });
  await post('communications', {
    counselor_id: cid, student_id: studentIds[1], contact_type: 'Email', duration_minutes: 10,
    notes: "Sent progress update to Sofia's mother in Spanish.", language: 'es'
  });
  console.log('Communications seeded');

  // Campus schedule blocks
  const blocks = [
    { block_name: 'Lunch - K/1', day_of_week: 1, start_time: '11:00', end_time: '11:30' },
    { block_name: 'Lunch - K/1', day_of_week: 2, start_time: '11:00', end_time: '11:30' },
    { block_name: 'Lunch - K/1', day_of_week: 3, start_time: '11:00', end_time: '11:30' },
    { block_name: 'Lunch - K/1', day_of_week: 4, start_time: '11:00', end_time: '11:30' },
    { block_name: 'Lunch - K/1', day_of_week: 5, start_time: '11:00', end_time: '11:30' },
    { block_name: 'Specials Block', day_of_week: 2, start_time: '14:00', end_time: '14:45' },
    { block_name: 'Specials Block', day_of_week: 4, start_time: '14:00', end_time: '14:45' },
    { block_name: 'Staff Meeting', day_of_week: 1, start_time: '15:15', end_time: '16:00' },
  ];
  for (const b of blocks) { await post('campus_schedule_blocks', { ...b, counselor_id: cid }); }
  console.log('Schedule blocks seeded');

  console.log('\nDONE — all demo data seeded for Beacon');
}

main().catch(e => console.error(e));
