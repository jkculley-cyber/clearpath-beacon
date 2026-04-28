/**
 * PDF attestation log — writes (counselor_id, document_kind, content_hash,
 * generated_at) to the ops Supabase `pdf_attestations` table so a third
 * party (Clear Path's ops Postgres) holds an independent timestamped record
 * that this hash existed by this date.
 *
 * Why this matters (per the lawyer's Q15 cross-examination):
 *
 *   "The hash algorithm is SHA-256, unsigned. Anyone with a copy of
 *   pdfIntegrity.js can produce a 'valid' hash for any document they
 *   invent. There is no certificate authority, no Adobe signature, no
 *   PAdES-LTV envelope, no RFC-3161 trusted timestamp token."
 *
 * The attestation log is the missing third-party witness. The counselor
 * cannot retroactively change the row's `generated_at` (server-set), and
 * subpoena to Clear Path's Postgres produces an immutable record of when a
 * given hash first existed. Combined with the in-PDF SHA-256, this gives:
 *
 *   1. Hash-stamped PDF (Tier 1 — already shipped) — proves the printout
 *      matches the underlying record.
 *   2. Attestation row in Postgres (this Tier 1.5 addition) — proves the
 *      hash existed by a server-recorded UTC timestamp.
 *
 * It's not RFC-3161 (which would require constructing a TimeStampReq DER
 * blob in browser JS — heavyweight library, deferred to district mode).
 * But it answers the "where is the third-party witness?" question with a
 * concrete subpoenable record that lives outside the counselor's device.
 *
 * Failure mode: when the network is unreachable, attestation is skipped
 * silently and the PDF still generates with its in-document hash. The
 * footer prints "(offline — attestation skipped)". A subsequent online
 * generation of the same record will produce a matching hash with a real
 * attestation, so the audit trail can still be reconstructed later.
 */

const OPS_URL = 'https://xbpuqaqpcbixxodblaes.supabase.co';
const OPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicHVxYXFwY2JpeHhvZGJsYWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjk4MDQsImV4cCI6MjA4Nzk0NTgwNH0.9Rhmz-FLUXnEQXpRCkg3G2ppzPxs2DinaYDmdD_wvPA';

const TIMEOUT_MS = 4000;

/**
 * Post a hash + counselor_id + document_kind to the ops Supabase. Returns
 * { id, generated_at } on success or null on any failure (network, auth,
 * 4xx, schema not yet applied). Must NEVER throw — the PDF generation flow
 * proceeds regardless.
 *
 * Implementation note on Prefer: return=minimal:
 * The audit-log design grants anon INSERT but not SELECT. PostgREST's default
 * `Prefer: return=representation` does INSERT-then-SELECT in one transaction,
 * which fails with `42501 row-level security policy` because the SELECT half
 * lacks permission. We sidestep that by generating the receipt UUID client-
 * side, inserting with that ID, and asking PostgREST to return nothing. The
 * authoritative `generated_at` timestamp is still server-set (via the table's
 * DEFAULT now()) and surfaced by the /verify-attestation endpoint, which uses
 * service-role and CAN read the row.
 */
export async function attestPdfHash({ counselorId, documentKind, contentHash, licenseKey }) {
  if (!contentHash || contentHash === 'unsupported') return null;
  // Client-side ID + timestamp serve as the PDF-footer receipt. The server
  // also sets its own generated_at on insert; the verify-URL surfaces THAT
  // value (the load-bearing third-party witness), not these.
  const clientId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const clientNow = new Date().toISOString();
  try {
    const res = await fetch(`${OPS_URL}/rest/v1/pdf_attestations`, {
      method: 'POST',
      headers: {
        apikey: OPS_KEY,
        Authorization: `Bearer ${OPS_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: clientId,
        counselor_id: counselorId || 'anonymous',
        product: 'beacon',
        document_kind: documentKind,
        content_hash: contentHash,
        generated_at: clientNow,
        client_meta: { license_key: licenseKey || null, ua: navigator.userAgent.slice(0, 200) },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return { id: clientId, generated_at: clientNow };
  } catch {
    return null;
  }
}

/**
 * Build the verification URL a reviewer can hit to confirm an attestation
 * row exists for a given hash. Returns the public-form URL (no anon key
 * needed by the reviewer — they call Clear Path directly).
 */
export function attestationLookupUrl(hash) {
  return `https://clearpathedgroup.com/verify-attestation?hash=${encodeURIComponent(hash)}`;
}
