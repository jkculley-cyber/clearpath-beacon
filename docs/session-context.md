# Beacon — Session Context

> Last updated: 2026-03-21

## Product
**Beacon** — Elementary school counselor command center
- **Price:** TBD — waiting on counselor feedback before pricing. Initial thinking: $19-29/mo direct-to-counselor tiers
- **Sales model:** Direct-to-counselor (like Apex for principals). No signup/Stripe build yet — counselor review first
- **Stack:** React 19 + Vite 7 + Supabase + Cloudflare Pages
- **Repo:** `jkculley-cyber/clearpath-beacon` (branch: main)
- **Supabase ref:** `cghhabcbgyoqwqjzunfo`
- **Live URL:** beacon.clearpathedgroup.com (custom domain — preferred for all customer-facing links; school firewalls frequently block *.pages.dev)
- **Cloudflare Pages alias:** clearpath-beacon.pages.dev (internal / dev only)

## Current State
- **Migrations applied:** 001 (foundation), 002 (schema additions)
- **Build:** passing, auto-deploys via Cloudflare GitHub integration on push to main
- **All 11 counselor experience features shipped**
- **All 7 Priority 1 simulation fixes shipped**
- **Analytics reports page live** with 7 chart/table sections + PDF export
- **CSV bulk import** on Students page
- **Lesson library seed** (32 lessons) + **communication template seed** (14 templates) scripts ready
- **500-user simulation report** completed (docs/simulation-500-users.md)

## Active Work
- None — waiting on real counselor review before next development phase

## Schema Notes
- Tenant unit = `counselor_id` (not district_id)
- RLS helper: `current_counselor_id()` SECURITY DEFINER function
- `students.name` is the canonical name column; `first_name`/`last_name` added in migration 002
- Group objectives stored directly on `groups` table as `obj_1/obj_2/obj_3` + `asca_1/asca_2/asca_3`

## Known Issues
- AI edge functions (generate-parent-update, generate-session-plan) not deployed — features fall back to templates
- No signup flow or payment integration yet (by design — waiting for counselor feedback)
- No email/SMS send integration (contacts are logged but not sent)

## Next Session Priorities
- Get real counselor feedback on product
- Price based on counselor input
- Build signup flow + Stripe when pricing is decided
- Deploy AI edge functions
- Priority 2 items from simulation: duplicate referral detection, file upload for lessons, session quick-add from schedule, onboarding tutorial
