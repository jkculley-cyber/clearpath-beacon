-- ============================================================
-- Beacon Foundation Migration 001
-- School counselor command center
-- Tenant unit: counselors (RLS isolates each counselor's data)
-- ============================================================
--
-- !! BEFORE RE-ENABLING CLOUD MODE (db.js CLOUD_MODE_ENABLED) !!
-- Grade bands: FIXED by migration 006 (widens students.grade to K-12, adds
-- counselors.grade_band + served_grades, creates ccmr_advising). Apply it.
--
-- STILL OUTSTANDING — cloud has no tables for features shipped while cloud was
-- disabled. Local (IndexedDB) has 25 stores; cloud has 18. Missing entirely:
--   crest_artifacts, crisis_events, follow_ups, needs_assessments,
--   parent_contacts, record_history, session_note_templates, student_goals,
--   settings
-- Any counselor switched to cloud loses CREST, the crisis workflow, follow-up
-- reminders, needs assessments, parent-contact logs, record history, note
-- templates, and student goals. Cloud mode must NOT be re-enabled until this
-- parity gap is closed and tenant-isolation RLS is verified (see B4 note in
-- db.js). Local mode is schemaless and unaffected.
-- ============================================================

-- ============================================================
-- 1. TABLES (dependency order)
-- ============================================================

CREATE TABLE counselors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  campus TEXT,
  district TEXT,
  school_year_start DATE,
  school_year_end DATE,
  alert_threshold INTEGER DEFAULT 82,
  subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','extended','expired')),
  paid_through DATE,
  trial_started_at TIMESTAMPTZ,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT CHECK (grade IN ('K','1','2','3','4','5')),
  teacher TEXT,
  referral_source TEXT,
  tier INTEGER DEFAULT 1 CHECK (tier IN (1,2,3)),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','transferred')),
  date_first_seen DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_band TEXT,
  focus_area TEXT,
  obj_1 TEXT,
  obj_2 TEXT,
  obj_3 TEXT,
  asca_1 TEXT,
  asca_2 TEXT,
  asca_3 TEXT,
  rotation_type TEXT DEFAULT 'weekly_abc'
    CHECK (rotation_type IN ('weekly_abc','biweekly')),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_date DATE DEFAULT CURRENT_DATE,
  exit_date DATE,
  UNIQUE(group_id, student_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  week_label TEXT,
  duration_minutes INTEGER,
  objectives_covered INTEGER[] DEFAULT '{}',
  lesson_ids UUID[] DEFAULT '{}',
  notes TEXT,
  status TEXT DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled','Completed','Cancelled','Make-up Needed')),
  session_type TEXT DEFAULT 'group'
    CHECK (session_type IN ('group','individual')),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('present','absent','makeup_needed','makeup_complete')),
  makeup_session_id UUID REFERENCES sessions(id),
  notes TEXT,
  UNIQUE(session_id, student_id)
);

CREATE TABLE progress_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_index INTEGER NOT NULL CHECK (objective_index IN (1,2,3)),
  rating INTEGER NOT NULL CHECK (rating IN (1,2,3)),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID REFERENCES counselors(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  submitted_by TEXT NOT NULL,
  student_name TEXT NOT NULL,
  grade TEXT,
  concern_type TEXT NOT NULL,
  urgency TEXT DEFAULT 'Routine'
    CHECK (urgency IN ('Routine','Soon','Urgent')),
  notes TEXT,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','closed')),
  response_date DATE,
  campus TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  duration_minutes INTEGER,
  notes TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  domain TEXT NOT NULL
    CHECK (domain IN ('guidance','planning','responsive','system','non_counseling')),
  activity_description TEXT,
  duration_minutes INTEGER NOT NULL,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('auto_session','auto_contact','manual')),
  source_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lesson_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('file','link','text')),
  file_url TEXT,
  link_url TEXT,
  content_text TEXT,
  source_platform TEXT,
  grade_tags TEXT[] DEFAULT '{}',
  domain_tag TEXT,
  topic_tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campus_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  block_name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  campus TEXT,
  district TEXT,
  title TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. HELPER FUNCTION (must come after counselors table)
-- ============================================================

CREATE OR REPLACE FUNCTION current_counselor_id() RETURNS UUID AS $$
  SELECT id FROM counselors WHERE supabase_auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

-- --- counselors ---
ALTER TABLE counselors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counselors_select_own" ON counselors
  FOR SELECT USING (supabase_auth_id = auth.uid());

CREATE POLICY "counselors_update_own" ON counselors
  FOR UPDATE USING (supabase_auth_id = auth.uid())
  WITH CHECK (supabase_auth_id = auth.uid());

-- --- students ---
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select" ON students
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "students_insert" ON students
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "students_update" ON students
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "students_delete" ON students
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- groups ---
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select" ON groups
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "groups_insert" ON groups
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "groups_update" ON groups
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "groups_delete" ON groups
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- group_members (join through groups) ---
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select" ON group_members
  FOR SELECT USING (
    group_id IN (SELECT id FROM groups WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "group_members_insert" ON group_members
  FOR INSERT WITH CHECK (
    group_id IN (SELECT id FROM groups WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "group_members_update" ON group_members
  FOR UPDATE USING (
    group_id IN (SELECT id FROM groups WHERE counselor_id = current_counselor_id())
  ) WITH CHECK (
    group_id IN (SELECT id FROM groups WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "group_members_delete" ON group_members
  FOR DELETE USING (
    group_id IN (SELECT id FROM groups WHERE counselor_id = current_counselor_id())
  );

-- --- sessions ---
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON sessions
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- attendance (join through sessions) ---
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON attendance
  FOR SELECT USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "attendance_insert" ON attendance
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "attendance_update" ON attendance
  FOR UPDATE USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  ) WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "attendance_delete" ON attendance
  FOR DELETE USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

-- --- progress_ratings (join through sessions) ---
ALTER TABLE progress_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_ratings_select" ON progress_ratings
  FOR SELECT USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "progress_ratings_insert" ON progress_ratings
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "progress_ratings_update" ON progress_ratings
  FOR UPDATE USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  ) WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

CREATE POLICY "progress_ratings_delete" ON progress_ratings
  FOR DELETE USING (
    session_id IN (SELECT id FROM sessions WHERE counselor_id = current_counselor_id())
  );

-- --- referrals (special: anon INSERT allowed) ---
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_anon_insert" ON referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "referrals_select" ON referrals
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "referrals_update" ON referrals
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "referrals_delete" ON referrals
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- communications ---
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communications_select" ON communications
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "communications_insert" ON communications
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "communications_update" ON communications
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "communications_delete" ON communications
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- time_entries ---
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- lesson_library ---
ALTER TABLE lesson_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_library_select" ON lesson_library
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "lesson_library_insert" ON lesson_library
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "lesson_library_update" ON lesson_library
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "lesson_library_delete" ON lesson_library
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- campus_schedule_blocks ---
ALTER TABLE campus_schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campus_schedule_blocks_select" ON campus_schedule_blocks
  FOR SELECT USING (counselor_id = current_counselor_id());

CREATE POLICY "campus_schedule_blocks_insert" ON campus_schedule_blocks
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "campus_schedule_blocks_update" ON campus_schedule_blocks
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

CREATE POLICY "campus_schedule_blocks_delete" ON campus_schedule_blocks
  FOR DELETE USING (counselor_id = current_counselor_id());

-- --- access_requests (anon INSERT only, no SELECT for regular users) ---
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_requests_anon_insert" ON access_requests
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 4. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('beacon-lessons', 'beacon-lessons', false);

-- Storage policies: counselor can CRUD files under their own counselor_id prefix
CREATE POLICY "beacon_lessons_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'beacon-lessons'
    AND (storage.foldername(name))[1] = current_counselor_id()::text
  );

CREATE POLICY "beacon_lessons_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'beacon-lessons'
    AND (storage.foldername(name))[1] = current_counselor_id()::text
  );

CREATE POLICY "beacon_lessons_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'beacon-lessons'
    AND (storage.foldername(name))[1] = current_counselor_id()::text
  );

CREATE POLICY "beacon_lessons_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'beacon-lessons'
    AND (storage.foldername(name))[1] = current_counselor_id()::text
  );

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX idx_students_counselor ON students(counselor_id);
CREATE INDEX idx_groups_counselor ON groups(counselor_id);
CREATE INDEX idx_sessions_counselor_date ON sessions(counselor_id, session_date);
CREATE INDEX idx_time_entries_counselor_date ON time_entries(counselor_id, entry_date);
CREATE INDEX idx_referrals_counselor_status ON referrals(counselor_id, status);
CREATE INDEX idx_communications_counselor_student ON communications(counselor_id, student_id);
