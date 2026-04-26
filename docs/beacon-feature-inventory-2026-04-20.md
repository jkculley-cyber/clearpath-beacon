# Beacon — Feature Inventory
**Snapshot date:** 2026-04-20
**Verified against:** `clearpath-beacon/src` on commit at time of snapshot
**Owner:** Archer (CTO) — the source of truth for what Vera documents

> This is the feature inventory Vera writes her user guide against. If a
> feature isn't marked **Shipped** here, it doesn't go in the guide.
> If Vera believes something ought to be added or removed from this list,
> she asks Archer, not the running app. The app has feature-flagged code
> paths that are invisible to the user but visible to a developer exploring
> the codebase — that's why this list exists.

---

## Status legend

- **Shipped** — Fully working in Local mode (the only mode a counselor can actually use today). Safe to document.
- **Hidden** — Code exists but is feature-flagged off or gated behind Cloud mode. The user cannot reach it. Do not document.
- **Aspirational** — Referenced in old docs or old marketing but has no working code path. Do not document. Remove from any copy that still mentions it.

---

## Feature table

### Authentication and mode

| Feature | Status | Note |
|---|---|---|
| Local Mode setup (name, campus, district, school year) | Shipped | Default mode for every buyer |
| 14-day free trial (no key required) | Shipped | Starts on first setup |
| License key activation (BCN-XXXXXX-XXXX) | Shipped | Ops Supabase check, 5-min interval, 7-day offline grace |
| Soft gate on expired/invalid license | Shipped | View + edit existing, cannot create new |
| Cloud Mode signup / auth | Aspirational | `LoginPage` and storage toggle exist, but no working Cloud signup path — the toggle in Settings lets a counselor switch, but Cloud mode has no schema-backed usable state. Treat as not-existing. |

### Dashboard and SB 179

| Feature | Status | Note |
|---|---|---|
| Dashboard home (overview cards) | Shipped | |
| SB 179 real-time 80/20 compliance meter | Shipped | Direct % recalculates on every session/time-entry save |
| Today's Schedule widget | Shipped | Reads schedule blocks + scheduled sessions for today |
| Action Items (overdue logs, pending referrals) | Shipped | |
| Domain breakdown chart (5 time domains) | Shipped | |

### Students / caseload

| Feature | Status | Note |
|---|---|---|
| Add / edit students individually | Shipped | |
| CSV bulk import of students | Shipped | Column-mapping UI |
| MTSS tier tagging (1 / 2 / 3) | Shipped | Filterable in reports |
| Student profile with timeline view | Shipped | Sessions + referrals + communications + notes in chronological order |
| Counselor notes per student | Shipped | Free-form, not tied to sessions |
| Student goals (ASCA-aligned) | Shipped | Status tracking |
| Needs assessment page | Shipped | Per-student |
| Grade promotion (batch K→1, 1→2, etc.) | Shipped | End-of-year transition tool in Settings |

### Referrals

| Feature | Status | Note |
|---|---|---|
| Manual referral entry | Shipped | |
| CSV referral import | Shipped | |
| Public-facing referral form page | Shipped | `ReferralFormPage` — direct link the counselor can share with teachers |
| Referral workflow Open → In Progress → Closed | Shipped | |
| Google Forms → Beacon live pipeline | Aspirational | No Apps Script, no OAuth, no Sheets sync. CSV is the only integration path. |

### Groups

| Feature | Status | Note |
|---|---|---|
| Create / edit groups | Shipped | Name, focus area, members, frequency, start date |
| Group session logging with attendance per student | Shipped | |
| Progress ratings 1–3 per student per session | Shipped | |
| Group Starter Kits (5 pre-made: anxiety, friendship, grief, behavior, social skills) | Shipped | Each kit generates a lesson sequence |
| Lesson linking to group sessions | Shipped | Attaches lesson from the 35-lesson library |
| Completion tracking (% of planned sessions done) | Shipped | |
| Group archiving (summer transition) | Shipped | |

### Sessions and time logging

| Feature | Status | Note |
|---|---|---|
| Individual session logging | Shipped | Student, date, duration, domain, notes, progress rating |
| Quick Log modal from Dashboard | Shipped | |
| Calendar import (.ics → time entries) | Shipped | Keyword-based domain inference, no AI |
| Schedule blocks (recurring weekly direct/indirect tagged blocks) | Shipped | Shows on Dashboard |
| Session status (scheduled / completed / cancelled / make-up) | Shipped | |

### Lessons library

| Feature | Status | Note |
|---|---|---|
| 35 bundled lessons | Shipped | Academic / social-emotional / career, K–5 |
| Favorite / unfavorite lessons | Shipped | |
| Search and filter by domain, grade, topic | Shipped | |
| Attach lesson to a session log | Shipped | |
| SB 179 documentation template | Shipped | Time-tracking wrapper around any lesson |

### Communication templates

| Feature | Status | Note |
|---|---|---|
| 28 total templates (14 scenarios × English + Spanish) | Shipped | Mustache placeholders: `{{student_name}}`, `{{progress_notes}}`, etc. |
| Edit template inline | Shipped | |
| Copy to clipboard | Shipped | |
| **AI-Generate button** | **Removed** | Dead code deleted from `CommunicationsPage.jsx` (CC9, 2026-04-26). The `generate-parent-update` edge function was never deployed. Re-add cleanly if/when the edge function ships. **Do not document.** |
| Scheduled email delivery | Aspirational | Templates are copy/paste only. No send path. |
| Auto-fill placeholders from student data | Aspirational | Placeholders render as tokens; counselor fills them manually. |

### Reports and exports

| Feature | Status | Note |
|---|---|---|
| Reports page with 7 data sections (key metrics, tier distribution, sessions over time, domain breakdown, referral pipeline, group utilization, compliance %) | Shipped | |
| Date range presets (month / semester / year / custom) | Shipped | |
| PDF export (all sections, branded) | Shipped | jsPDF + autoTable |
| Email delivery of reports | Aspirational | No send path |

### Settings

| Feature | Status | Note |
|---|---|---|
| Profile (name, campus, district) | Shipped | |
| School year start/end dates | Shipped | Scopes compliance period |
| Alert threshold (default 80%) | Shipped | SB 179 target |
| Schedule blocks editor | Shipped | |
| Calendar import UI | Shipped | |
| Backup / restore (JSON file download + upload) | Shipped | Local mode only |
| License entry + status display | Shipped | |
| Share Beacon (shareable text with compliance %) | Shipped | |
| Impact Summary PDF (for principal) | Shipped | |
| Grade promotion (batch) | Shipped | |
| Storage mode toggle (Local ↔ Cloud) | **Hidden in code** | Wrapped in `{false && (...)}` in `SettingsPage.jsx` (CC9, 2026-04-26). Cloud target is still Aspirational — restore the toggle when the LoginPage cloud flow is wired end-to-end. The dual-path `db.js` layer is unchanged. **Vera should not document the toggle.** |
| Password change | Aspirational | Cloud-mode-only feature; no auth path to change a password against |

### Data portability

| Feature | Status | Note |
|---|---|---|
| Export all data as JSON | Shipped | |
| Import JSON backup | Shipped | Overwrites current local data |
| No SaaS lock-in / data-is-yours | Shipped | Real claim, real file, real transfer |

### Platform

| Feature | Status | Note |
|---|---|---|
| Progressive Web App (installable on iOS / Android / desktop) | Shipped | |
| Offline operation | Shipped | Service worker handles static assets; IndexedDB for data |
| Mobile-native app (iOS / Android store) | Aspirational | Not on the roadmap. Don't imply one is coming. |

---

## Archer's follow-ups tracked separately from Vera's guide

- Hide the storage-mode toggle in Settings until Cloud mode is actually implemented (or render it disabled with a "coming soon" note). Currently a curious user can flip it and end up in a broken Cloud state.
- Decide whether to keep the feature-flagged AI generate code in the file or delete it entirely. Currently retained so the pattern is obvious when the edge function ships.
- The `LoginPage` route is still wired in `App.jsx`. If we're pre-Cloud-mode, we may want to short-circuit `/login` to redirect to `/setup` (there's already logic for this when `isLocalMode` — double-check).

---

## Revision policy

- When a feature moves from Aspirational or Hidden to Shipped, Archer updates this file and notifies Vera.
- When the user guide is written against this file, Vera cites the snapshot date at the top of the guide.
- If Vera finds a feature in the running app that isn't on this list, she files a question to Archer before writing. The list is the source of truth, not the app.
