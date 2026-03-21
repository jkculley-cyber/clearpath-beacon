# Beacon — Session Context

> Last updated: 2026-03-20

## Product
**Beacon** — Elementary school counselor command center
- **Price:** $999/yr per counselor
- **Stack:** React 19 + Vite 7 + Supabase + Cloudflare Pages
- **Repo:** `jkculley-cyber/clearpath-beacon` (branch: main)
- **Supabase ref:** `cghhabcbgyoqwqjzunfo`
- **Live URL:** clearpath-beacon.pages.dev

## Current State
- **Migrations applied:** 001 (foundation schema — 14 tables), 002 (schema additions — first_name/last_name, counselor_notes, communication_templates)
- **Build:** passing, auto-deploys via Cloudflare GitHub integration on push to main
- **All 11 counselor experience features shipped** (see handover for list)

## Active Work
- None — all planned features shipped and pushed

## Schema Notes
- Tenant unit = `counselor_id` (not district_id)
- RLS helper: `current_counselor_id()` SECURITY DEFINER function
- `students.name` is the canonical name column; `first_name`/`last_name` added in migration 002
- Group objectives stored directly on `groups` table as `obj_1/obj_2/obj_3` + `asca_1/asca_2/asca_3`
- No `group_objectives`, `session_attendance`, or `session_objectives` tables — these were phantom references fixed in this session

## Known Issues
- None currently blocking

## Next Session Priorities
- End-to-end testing of all 11 features with live data
- Consider: parent communication templates, lesson library content seeding, reporting/analytics dashboard
