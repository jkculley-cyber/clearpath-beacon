# Cloud Mode — Schema Parity Debt

> **Status: PARKED (decision 2026-07-22). Fix before cloud is ever re-enabled.**
> Tracked as risk **B-8** in the Waypoint repo's `docs/risk-register.md` (reviewed at every session opening).

## The short version

Beacon has been **local-only** since CC30/CC31 (`CLOUD_MODE_ENABLED = false` in `src/lib/db.js`). Features kept shipping. **The cloud schema did not follow.**

Local (IndexedDB) has **25** object stores. Cloud (Supabase) has **18** tables.

Flipping `CLOUD_MODE_ENABLED = true` today would **silently destroy counselor data** — `db.js` writes to `supabase.from(<store name>)`, so a store with no matching table just fails, and the counselor loses that feature's records with no error surfaced to them.

This is a *separate* problem from B-7 (RLS / tenant isolation). Even with perfect RLS, cloud is structurally incomplete.

## Missing cloud tables (9)

Every one is a feature shipped **while cloud was disabled**, which is exactly why the gap went unnoticed:

| Store | Feature it powers | Shipped |
|---|---|---|
| `crest_artifacts` | CREST award portfolio (TSCA) | pre-CC34 |
| `crisis_events` | Crisis workflow + attested crisis PDFs | CC35 |
| `parent_contacts` | Parent-contact log (due-process defense) | CC35 |
| `follow_ups` | Scheduled follow-up reminders (24h/72h/1wk) | CC34–35 |
| `needs_assessments` | Needs-assessment surveys | pre-CC34 |
| `student_goals` | Per-student counseling goals | pre-CC34 |
| `session_note_templates` | SOAP-format note templates | pre-CC34 |
| `record_history` | Field-level change log (v7) | CC38 |
| `settings` | Key-value app config | — |

## What IS done

- **`006_grade_bands.sql`** (PR [#15](https://github.com/jkculley-cyber/clearpath-beacon/pull/15)) closes the *grade-band* half:
  - `students.grade` CHECK widened `K-5` → `K-12`
  - `counselors.grade_band` + `counselors.served_grades` added (CHECK-constrained; `NULL` band = elementary, matching the client fallback, so no backfill)
  - **`ccmr_advising`** table created — it had existed *only* in IndexedDB
  - Idempotent, non-destructive, ships with a PASS/FAIL verify block
- **`CLOUD_TABLE_NAMES`** in `db.js` maps the singular local store `counselor` → the plural cloud table `counselors`. Without it *every* cloud profile write (including the band setting) targeted a nonexistent table.

⚠️ **006 is written and structurally validated but has NEVER been executed.** Cloud is disabled and there's no Postgres in the dev environment. Run the verify block at the bottom of the file the first time it's applied.

## Why this is parked, not fixed

Building 9 speculative schemas for a disabled feature would violate **B-3** (*don't chase district plumbing without a signed LOI/DPA* — DECISIONS 2026-05-07). Guessing at column shapes now would likely be wrong by the time a district actually needs cloud, and would read as "done" when it isn't.

Naming the gap precisely beats half-building it.

## Definition of done (when a district conversation makes cloud real)

1. Apply `006_grade_bands.sql`; run its verify block — all PASS.
2. Write migrations for the 9 tables above, each with counselor-scoped RLS matching the `current_counselor_id()` pattern in `001_foundation.sql`.
3. **Automate the check:** diff local `STORES` (`src/lib/localDb.js`) against `CREATE TABLE` statements in `supabase/migrations/` and fail CI on any gap. This gap existed precisely because nothing enforced parity.
4. Satisfy **B-7** independently: written RLS audit + tenant-isolation sign-off.
5. Only then flip `CLOUD_MODE_ENABLED`.

Do **not** treat re-enabling cloud as a one-migration job.
