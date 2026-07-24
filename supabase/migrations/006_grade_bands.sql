-- ============================================================
-- Beacon Migration 006 — grade bands (Elementary / Middle / High / Combined)
--
-- Brings the cloud schema up to parity with local (IndexedDB) mode, which has
-- supported grade bands since the secondary release. Until this is applied,
-- cloud mode is elementary-only and WILL break for a secondary counselor:
--   1. students.grade rejects grades 6-12 outright (CHECK was 'K'..'5').
--   2. counselors has no grade_band / served_grades, so a counselor's band
--      silently fails to persist.
--   3. ccmr_advising (the Post-Secondary Advising log) has no table at all.
--
-- Idempotent and non-destructive: widens a CHECK, adds columns, creates one
-- table. No existing row is modified and no data is dropped. Safe to re-run.
-- Apply via Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. students.grade — widen K-5 to K-12
-- ============================================================
-- The old constraint is unnamed-by-default ('students_grade_check'). Drop by
-- the conventional name if present, then re-add the widened rule. Existing K-5
-- rows all satisfy the new CHECK, so this validates without a rewrite.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_check;

ALTER TABLE students
  ADD CONSTRAINT students_grade_check
  CHECK (grade IS NULL OR grade IN
    ('K','1','2','3','4','5','6','7','8','9','10','11','12'));

-- ============================================================
-- 2. counselors — grade band + combined-campus served range
-- ============================================================
-- grade_band: 'elementary' | 'middle' | 'high' | 'combined'.
-- NULL is allowed and means elementary — matching the client, where an
-- existing counselor record with no band falls back to elementary. Do NOT
-- backfill a default; NULL-means-elementary keeps upgrades a no-op.
ALTER TABLE counselors
  ADD COLUMN IF NOT EXISTS grade_band TEXT;

ALTER TABLE counselors DROP CONSTRAINT IF EXISTS counselors_grade_band_check;
ALTER TABLE counselors
  ADD CONSTRAINT counselors_grade_band_check
  CHECK (grade_band IS NULL OR grade_band IN
    ('elementary','middle','high','combined'));

-- served_grades: {"min":"6","max":"12"} for combined campuses; NULL otherwise.
-- JSONB (not two columns) mirrors the client shape exactly, so the local<->cloud
-- record round-trips without translation.
ALTER TABLE counselors
  ADD COLUMN IF NOT EXISTS served_grades JSONB;

ALTER TABLE counselors DROP CONSTRAINT IF EXISTS counselors_served_grades_check;
ALTER TABLE counselors
  ADD CONSTRAINT counselors_served_grades_check
  CHECK (
    served_grades IS NULL
    OR (
      jsonb_typeof(served_grades) = 'object'
      -- ->> yields NULL for a missing key, and NULL IN (...) is not TRUE, so
      -- these two tests also enforce that both keys are present. (Deliberately
      -- avoids the jsonb `?` operator, which collides with the parameter
      -- placeholder in some SQL clients.)
      AND served_grades->>'min' IN ('K','1','2','3','4','5','6','7','8','9','10','11','12')
      AND served_grades->>'max' IN ('K','1','2','3','4','5','6','7','8','9','10','11','12')
    )
  );

COMMENT ON COLUMN counselors.grade_band IS
  'Grade band served: elementary | middle | high | combined. NULL = elementary (back-compat).';
COMMENT ON COLUMN counselors.served_grades IS
  'Combined-campus range as {"min":"6","max":"12"}. NULL unless grade_band = combined.';

-- ============================================================
-- 3. ccmr_advising — Post-Secondary (CCMR) Advising log
-- ============================================================
-- Documents college/career/military-readiness advising touches. Mirrors the
-- local IndexedDB store added in DB v8. student_id is intentionally ON DELETE
-- SET NULL with student_name denormalized: an advising record is a record of
-- what the COUNSELOR did and must survive the student leaving the caseload.
CREATE TABLE IF NOT EXISTS ccmr_advising (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name TEXT,
  category TEXT CHECK (category IN (
    'college_app','financial_aid','dual_credit','cte_cert','military',
    'testing','endorsement','scholarship','career','resume','other'
  )),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_progress','complete')),
  advising_date DATE,
  notes TEXT,
  next_step TEXT,
  next_step_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccmr_advising_counselor ON ccmr_advising(counselor_id);
CREATE INDEX IF NOT EXISTS idx_ccmr_advising_student   ON ccmr_advising(student_id);
CREATE INDEX IF NOT EXISTS idx_ccmr_advising_date      ON ccmr_advising(advising_date);

-- --- RLS: same counselor-scoped isolation as every other table ---
ALTER TABLE ccmr_advising ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccmr_advising_select" ON ccmr_advising;
CREATE POLICY "ccmr_advising_select" ON ccmr_advising
  FOR SELECT USING (counselor_id = current_counselor_id());

DROP POLICY IF EXISTS "ccmr_advising_insert" ON ccmr_advising;
CREATE POLICY "ccmr_advising_insert" ON ccmr_advising
  FOR INSERT WITH CHECK (counselor_id = current_counselor_id());

DROP POLICY IF EXISTS "ccmr_advising_update" ON ccmr_advising;
CREATE POLICY "ccmr_advising_update" ON ccmr_advising
  FOR UPDATE USING (counselor_id = current_counselor_id())
  WITH CHECK (counselor_id = current_counselor_id());

DROP POLICY IF EXISTS "ccmr_advising_delete" ON ccmr_advising;
CREATE POLICY "ccmr_advising_delete" ON ccmr_advising
  FOR DELETE USING (counselor_id = current_counselor_id());

-- ============================================================
-- 4. VERIFY (run after applying; every row should report PASS)
-- ============================================================
-- SELECT 'students grade K-12' AS check,
--        CASE WHEN pg_get_constraintdef(oid) LIKE '%''12''%' THEN 'PASS' ELSE 'FAIL' END AS result
--   FROM pg_constraint WHERE conname = 'students_grade_check'
-- UNION ALL
-- SELECT 'counselors.grade_band',
--        CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
--   FROM information_schema.columns
--  WHERE table_name = 'counselors' AND column_name = 'grade_band'
-- UNION ALL
-- SELECT 'counselors.served_grades',
--        CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
--   FROM information_schema.columns
--  WHERE table_name = 'counselors' AND column_name = 'served_grades'
-- UNION ALL
-- SELECT 'ccmr_advising table',
--        CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
--   FROM information_schema.tables
--  WHERE table_name = 'ccmr_advising'
-- UNION ALL
-- SELECT 'ccmr_advising RLS on',
--        CASE WHEN bool_and(relrowsecurity) THEN 'PASS' ELSE 'FAIL' END
--   FROM pg_class WHERE relname = 'ccmr_advising'
-- UNION ALL
-- SELECT 'ccmr_advising 4 policies',
--        CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END
--   FROM pg_policies WHERE tablename = 'ccmr_advising';
