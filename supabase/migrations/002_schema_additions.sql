-- ============================================================
-- Beacon Migration 002 — Schema Additions
-- Adds missing columns/tables needed by frontend features
-- Apply via Supabase SQL Editor
-- ============================================================

-- 1. Add first_name/last_name to students (populate from existing name column)
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name TEXT;
UPDATE students SET
  first_name = split_part(name, ' ', 1),
  last_name = CASE WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1) ELSE '' END
WHERE first_name IS NULL;

-- 2. Add resolution fields to referrals
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS teacher_name TEXT;
UPDATE referrals SET teacher_name = submitted_by WHERE teacher_name IS NULL AND submitted_by IS NOT NULL;

-- 3. Add contact_date to communications
ALTER TABLE communications ADD COLUMN IF NOT EXISTS contact_date DATE DEFAULT CURRENT_DATE;
UPDATE communications SET contact_date = created_at::date WHERE contact_date IS NULL;

-- 4. Add last_seen_date to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_date DATE;

-- 5. Counselor notes table
CREATE TABLE IF NOT EXISTS counselor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE counselor_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "counselor_notes_select" ON counselor_notes FOR SELECT USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "counselor_notes_insert" ON counselor_notes FOR INSERT WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "counselor_notes_update" ON counselor_notes FOR UPDATE USING (counselor_id = current_counselor_id()) WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "counselor_notes_delete" ON counselor_notes FOR DELETE USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Communication templates table
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "comm_templates_select" ON communication_templates FOR SELECT USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "comm_templates_insert" ON communication_templates FOR INSERT WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "comm_templates_update" ON communication_templates FOR UPDATE USING (counselor_id = current_counselor_id()) WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "comm_templates_delete" ON communication_templates FOR DELETE USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_counselor_notes_student ON counselor_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_progress_ratings_session ON progress_ratings(session_id);
