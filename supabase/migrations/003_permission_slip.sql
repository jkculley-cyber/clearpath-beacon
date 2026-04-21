-- ============================================================
-- Beacon Migration 003 — Permission Slip Tracking
-- Adds consent/permission slip fields to students.
-- Apply via Supabase SQL Editor (cloud mode only).
-- Local (IndexedDB) mode is schemaless and needs no migration.
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS permission_slip_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS permission_slip_signed_date DATE;

CREATE INDEX IF NOT EXISTS idx_students_permission_slip
  ON students(counselor_id, permission_slip_on_file);
