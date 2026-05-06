-- ============================================================
-- Beacon Migration 005 — schedule_events.series_id
-- Recurring events (weekly meetings, duty rotations, etc.)
-- materialize one row per occurrence, all sharing a series_id.
-- "Delete this and future" / "Delete entire series" use this column.
-- Apply via Supabase SQL Editor.
-- ============================================================

ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS series_id UUID;

CREATE INDEX IF NOT EXISTS idx_schedule_events_series
  ON schedule_events(series_id);
