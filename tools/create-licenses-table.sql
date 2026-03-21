-- ============================================================
-- Product Licenses Table — Ops Supabase (xbpuqaqpcbixxodblaes)
-- Shared license authority for Beacon + Investigator Toolkit
-- Apply via SQL Editor: https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS product_licenses (
  id BIGSERIAL PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('beacon', 'investigator')),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  district_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_license_key ON product_licenses(license_key);

-- RLS: anon can only SELECT (read-only license check from apps)
ALTER TABLE product_licenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_read_licenses" ON product_licenses
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No INSERT/UPDATE/DELETE policies for anon — Kim manages via SQL Editor or Table Editor

-- ============================================================
-- Insert test licenses (one per product)
-- ============================================================

INSERT INTO product_licenses (license_key, product, customer_name, customer_email, status, expires_at)
VALUES
  ('BCN-TEST01-0001', 'beacon', 'Test Counselor', 'test@example.com', 'active', '2027-06-01T00:00:00Z'),
  ('INV-TEST01-0001', 'investigator', 'Test Admin', 'test@example.com', 'active', '2027-06-01T00:00:00Z')
ON CONFLICT (license_key) DO NOTHING;
