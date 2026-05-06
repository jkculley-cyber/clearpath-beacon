-- ============================================================
-- Beacon Migration 004 — schedule_events
-- One-off non-counseling events on the counselor's schedule
-- (faculty meetings, duty assignments, ARDs, training, planning).
-- Counseling sessions stay in `sessions`; recurring weekly blocks
-- (lunch/duty patterns) stay in `campus_schedule_blocks`.
-- Apply via Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting','duty','planning','training','ard','504','admin','other')),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_counselor_date
  ON schedule_events(counselor_id, event_date);

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "schedule_events_select" ON schedule_events
    FOR SELECT USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "schedule_events_insert" ON schedule_events
    FOR INSERT WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "schedule_events_update" ON schedule_events
    FOR UPDATE USING (counselor_id = current_counselor_id())
    WITH CHECK (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "schedule_events_delete" ON schedule_events
    FOR DELETE USING (counselor_id = current_counselor_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
