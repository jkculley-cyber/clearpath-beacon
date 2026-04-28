-- Ops Supabase (xbpuqaqpcbixxodblaes) — PDF attestation log
--
-- Apply once via the SQL Editor at:
--   https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes/sql/new
--
-- Beacon (and any future Clear Path product that generates legal PDFs) POSTs
-- a row here every time a defensible-documentation PDF is generated. The row
-- is server-set, immutable to anon clients, and serves as the third-party
-- timestamp witness lawyers ask about.
--
-- Sized as a write-mostly log: SELECT is restricted to service-role only.
-- Reviewers (lawyers, OCR, district admins) verify a hash by calling Clear
-- Path's /verify-attestation endpoint, which uses service-role to look up
-- the row by content_hash.

CREATE TABLE IF NOT EXISTS pdf_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'beacon',
  document_kind TEXT NOT NULL CHECK (document_kind IN ('crisis', 'parent_contact', 'sb179')),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_pdf_att_hash ON pdf_attestations(content_hash);
CREATE INDEX IF NOT EXISTS idx_pdf_att_counselor ON pdf_attestations(counselor_id, generated_at DESC);

-- Lawyer Q29c (Round 4): even with anon-INSERT-only RLS, a service-role-key
-- holder can override the DEFAULT now() and insert a row with a fabricated
-- past timestamp. This CHECK forces every inserted timestamp to be within
-- ~5 minutes of server time, blocking backdated forgery from any role.
ALTER TABLE pdf_attestations
  DROP CONSTRAINT IF EXISTS pdf_attestations_generated_at_recent;
ALTER TABLE pdf_attestations
  ADD CONSTRAINT pdf_attestations_generated_at_recent
  CHECK (
    generated_at >= (now() - interval '5 minutes')
    AND generated_at <= (now() + interval '5 minutes')
  );

ALTER TABLE pdf_attestations ENABLE ROW LEVEL SECURITY;

-- Anon may INSERT only. No SELECT, no UPDATE, no DELETE for anon.
DROP POLICY IF EXISTS "anon insert pdf_attestations" ON pdf_attestations;
CREATE POLICY "anon insert pdf_attestations" ON pdf_attestations
  FOR INSERT TO anon
  WITH CHECK (true);

-- Service role gets full access (reviewer endpoint will use service role).
-- This is the default behavior; documenting for clarity.
