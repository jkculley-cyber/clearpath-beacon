# Beacon Secondary — Audit & Implementation Plan

**Created:** 2026-07-22
**Trigger:** Nicole (Magnolia ISD) presented Beacon to her district; interest surfaced in a **secondary** version.
**Decision owner:** Kim / product.

---

## TL;DR

Beacon does **not** need a separate secondary product. Its "elementary" identity lives in ~5 hardcoded spots, not in the architecture. The plan is **one product with a grade-band setting** the counselor chooses at setup:

- **Elementary (K-5)** · **Middle (6-8)** · **High (9-12)** — "split secondary" per decision 2026-07-22.

Marketed as *"Beacon — now for elementary, middle, and high school counselors."* Configuration/label names: **Beacon Elementary / Beacon Middle / Beacon High** (same product, same license, one deploy).

**No legal blocker:** SB 179 / TEC §33.006's 80% rule applies to **all Texas public-school counselors** (confirmed by Kim, 2026-07-22), so Beacon's flagship 80/20 compliance ring + attested PDF port to secondary **unchanged** — it's a selling point for secondary, not a risk.

---

## Audit findings (read-only, 2026-07-22)

Three parallel audits of `clearpath-beacon` (product surface, compliance/legal, data-model/setup). Verdict: **the codebase is structured for a grade-band toggle.**

### Why a separate build is the wrong call
A separate secondary app would duplicate all 25 IndexedDB stores, the license/trial/gate stack, backup crypto, and setup — to swap ~5 constants and a seed file. High duplication, zero architectural payoff.

### The entire "elementary" surface (this is the whole work list)
- **Four hardcoded `GRADES = ['K','1','2','3','4','5']` arrays** (no shared constant yet):
  - `src/pages/StudentsPage.jsx:7`
  - `src/pages/StudentDetailPage.jsx:412`
  - `src/pages/LessonsPage.jsx:6`
  - `src/pages/ReferralFormPage.jsx:19`
  - (+ `ReferralsPage.jsx:676` inline, and `ResourcesPage.jsx:58` `GRADE_FILTERS`)
- **Ordinal-suffix logic** assumes K-5: `ReferralFormPage.jsx:326`.
- **`GRADE_PROMOTIONS` ladder** K→5→Graduated: `SettingsPage.jsx:22-29` (+ "graduate the 5th graders" copy at `:1135,1151`).
- **Sample-data seed** is all K-5 students + `K-2`/`3-5` groups: `seedSampleData.js:11-15,29,37`.
- **Cloud-only** SQL CHECK `grade IN ('K'..'5')`: `supabase/migrations/001_foundation.sql:34` (irrelevant in local mode — IndexedDB is schemaless).
- **"Elementary" copy strings:** `LandingPage.jsx:30`, `RequestAccessPage.jsx:29,88,127`, `LocalSetupPage.jsx:283`, `SettingsPage.jsx:1525-1526` (license label), `TemplatesPage.jsx:212-213,823`.
- **K-5 content:** session prompts (`sessionPrompts.js`), group kits (`groupStarterKits.js`), lessons (`seedLessonData.js`), visuals (`visualResources.js`) — all tagged K-5; SEL source platforms are elementary (`LessonsPage.jsx:7`).

### Data layer is ready (cheap toggle confirmed)
- **No migration needed.** IndexedDB stores are schemaless blobs; `counselor` and `students` records take new fields via `put` with no `DB_VERSION` bump (`localDb.js:272`, current `DB_VERSION = 7` at `localDb.js:10`). Existing users default cleanly (`undefined` → Elementary).
- **`grade` is already an index** on `students` (`localDb.js:60`).
- **`grade_band` is already a first-class concept on `groups`** and flows through UI + PDF export (`001_foundation.sql:47`, `GroupsPage.jsx:85`, `pdfExports.js:173`) — vocabulary + plumbing partly exist.
- **License = one flat product**, keyed only by `license_key` → `{status, expires_at}` (`license.js:64-66`); `BCN-` prefix is cosmetic, never validated. A local band toggle touches licensing **zero**.
- **Setup** collects only Name/Email/Campus/District (`LocalSetupPage.jsx:258-292`) → natural spot for a band selector after District (~line 292), passed into `createLocalCounselor` (`AuthContext.jsx:64`). Editable later via the existing Settings save path (`SettingsPage.jsx:436`).

### Compliance layer (the sensitive part) — resolved
- **80/20 ring is grade-agnostic in the math** — pure domain-minute ratio, no grade input (`TimeTrackerPage.jsx:47,235`, `morningBrief.js:18` `SB179_TARGET_PCT = 80`). Applied unconditionally with no grade gate.
- Statute cited as **"SB 179 (86th Leg., 2019, TEC §33.006)"** (`crestAutoDerive.js:86`, `DistrictPreviewPage.jsx:551`) — **applies to all public-school counselors** → ring stays ON for all bands.
- **PDF attestation "moat" is fully generic** (`document_kind` string-parameterized: `'crisis'|'parent_contact'|'sb179'`), zero grade coupling — ports as-is (`pdfIntegrity.js`, `pdfAttestation.js`, `docs/ops-pdf-attestations-schema.sql:20`).
- Other statutes are grade-agnostic too and arguably **higher-value at secondary**: SB 11 / 19 TAC Ch. 103 threat assessment + suicide prevention (`crisisWorkflow.js:9,82,119`), TEC §37.0832 bullying (`sessionNoteTemplates.js:134`), FERPA, ASCA.

### Pre-existing bugs to fix while in the compliance code (independent of secondary)
1. **Statute wording inconsistent across surfaces:** attested SB-179 PDF says *"direct counseling services"* (`TimeTrackerPage.jsx:303`); CREST/District say *"direct **or** indirect"* (`crestAutoDerive.js:86`, `DistrictPreviewPage.jsx:551,1122`). The math credits `guidance/planning/responsive` but treats `system` (System Support) as non-counseling (`TimeTrackerPage.jsx:267`) — matches neither phrasing. Pick one legally-correct wording and unify.
2. **Threshold mismatch:** `Scorecard.jsx:108` uses **82%** as the cutoff; everything else uses **80%**. Align to 80.
3. **`COUNSELING_DOMAINS` list duplicated** in `TimeTrackerPage.jsx:15` and `crestAutoDerive.js:36` — centralize.

### Secondary-counselor gaps (Beacon has no surface for these)
Course/credit tracking, graduation/4-year plans, CCMR (TSI/dual-credit/AP-IB/industry certs/CTE), transcripts/GPA/class-rank, scheduling/course-selection, endorsement/pathway (TX Foundation + endorsement), testing coordination (SAT/ACT/TSI/STAAR-EOC), post-secondary advising (FAFSA/college apps/scholarships/rec letters). **Most are SIS territory — see Non-Goals.** The counseling-documentation subset is Phase 3.

---

## Grade-band model

Counselor picks a **band preset** at setup (editable in Settings). Preset drives the grade list, the promotion ladder, and default content set.

| Band | Grades | Promotion ladder |
|------|--------|------------------|
| Elementary | K,1,2,3,4,5 | K→…→5→(handoff to Middle) |
| Middle | 6,7,8 | 6→7→8→(handoff to High) |
| High | 9,10,11,12 | 9→10→11→12→Graduated |

- Store as `grade_band: 'elementary' | 'middle' | 'high'` on the counselor record (+ optional `served_grades: {min,max}` for combined campuses like 6-12 or K-8).
- Centralize a `GRADES_BY_BAND` map + a `getGrades(counselor)` helper in `src/lib/constants.js`; every dropdown derives from it.
- Existing (elementary) users with no `grade_band` default to `'elementary'` — zero disruption.

---

## Implementation plan (phased)

**Phase 0 — Legal ✅ RESOLVED.** SB 179 applies to all TX public-school counselors (Kim, 2026-07-22). No blocker. (Fold the wording/threshold cleanups from "Pre-existing bugs" into Phase 1.)

**Phase 1 — Grade-band foundation (small; days, not weeks). Ships a Beacon that is correct for 6-12.**
1. `constants.js`: add `GRADES_BY_BAND` + `getGrades()` + `getPromotionLadder()`.
2. `grade_band` on `createLocalCounselor` (`AuthContext.jsx:64`); default `'elementary'`.
3. Band selector in setup (`LocalSetupPage.jsx` after District) + Settings (existing save path).
4. Replace the 4 `GRADES` arrays + `ReferralsPage.jsx:676` + `ResourcesPage.jsx:58` + ordinal logic (`ReferralFormPage.jsx:326`) to derive from band.
5. Extend `GRADE_PROMOTIONS` per the table (`SettingsPage.jsx:22`) + grade-band-aware EOY copy.
6. Band-appropriate sample seed (`seedSampleData.js`) — parallel Middle/High student + group sets.
7. De-elementary the copy + license label + landing/request-access; unify the SB-179 statute wording + 80% threshold.

**Phase 2 — Secondary content (authoring, not engineering).**
- Middle/High session prompts, group starter-kits, guidance lessons, templates, resource filters (currently all K-5). Secondary-appropriate SEL + advising topics.

**Phase 3 — Secondary differentiator features (optional, incremental; stays in the counseling-documentation lane).**
- **CCMR advising log** — documents college/career/military-readiness advising touches; credits the SB-179 "planning" domain + feeds CREST. On-brand, high value.
- **Graduation-readiness / 4-year-plan checklist** — documentation, not a scheduler.
- **Caseload-by-alpha** model to replace the single-`teacher` elementary homeroom assumption (`students.teacher`).

---

## Non-Goals (what Beacon Secondary must NOT become)
Transcripts, GPA/class-rank, master scheduling, course requests/section balancing, endorsement selection, testing registration, financial-aid processing. **These are SIS territory** (Skyward/Frontline/PowerSchool own them). Beacon documents *what the counselor does* and proves it with attested records — it does not become a system-of-record it can't win, and it keeps the local-first single-counselor model intact.

---

## Open items (product decisions) — RESOLVED 2026-07-22
1. **Pricing:** ✅ **Same $79/yr ($8/mo) across all bands** — reinforces "same product."
2. **Combined campuses (6-12, K-8):** support a `served_grades` range in addition to the three presets. Implement presets first; range is an additive follow-on within Phase 1.
3. **Rollout scope:** ✅ **Full plan (Phases 1+2+3).**
