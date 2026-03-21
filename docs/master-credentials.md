# Clear Path Education Group — Master Credentials & Access

> **CONFIDENTIAL — Internal use only. For Kim Culley and Melissa only.**
> Do not share this document outside of Clear Path Education Group, LLC.
>
> Last updated: 2026-03-21

---

## WAYPOINT (DAEP Management)

- **Live URL:** https://waypoint.clearpathedgroup.com
- **Supabase Dashboard:** https://supabase.com/dashboard/project/kvxecksvkimcgwhxxyhw

### Demo Accounts (Lone Star ISD — demo district)

| Role | Email | Password |
|------|-------|----------|
| Waypoint Admin (Owner Panel) | admin@waypoint.internal | Waypoint2025! |
| District Admin | admin@lonestar-isd.org | Password123! |
| DAEP Staff (AP) | daep-staff@lonestar-isd.org | Password123! |
| Principal | hs-principal@lonestar-isd.org | Password123! |
| Assistant Principal | hs-ap@lonestar-isd.org | Password123! |
| Counselor | ms-counselor@lonestar-isd.org | Password123! |
| Teacher | el-teacher@lonestar-isd.org | Password123! |
| SPED Coordinator | sped-coord@lonestar-isd.org | Password123! |
| Parent | parent@lonestar-isd.org | Password123! |

### Notes

- Waypoint Admin panel at `/waypoint-admin` — manages districts, contracts, business dashboard, partner chat
- Navigator module accessible by toggling product in admin panel (blue sidebar)
- Meridian (SPED) and Origins (Family Portal) modules also available but not yet launched publicly
- Demo district has full seed data: 12 incidents, 6 transition plans, 57 days behavior tracking

---

## NAVIGATOR (ISS/OSS Management)

- **Same app as Waypoint** — accessed via sidebar when Navigator product is enabled
- **URL:** https://waypoint.clearpathedgroup.com (same login, Navigator section in sidebar)
- **Demo:** Log in as admin@lonestar-isd.org — Navigator is enabled for Lone Star ISD
- **Seed data:** 13 referrals, 28 placements, 6 supports, 3 campus goals

---

## APEX (Principal Observation & Coaching)

- **Live URL:** https://clearpath-apex.pages.dev
- **Supabase Dashboard:** https://supabase.com/dashboard/project/jvjsotlyvrzhsbgcsdfw
- **Auth:** Magic link (OTP code sent to email) — no password login
- **Kim's admin panel:** Log into Waypoint as admin@waypoint.internal, then go to Apex tab
- **Trial:** 14-day free trial, then soft-gated. Kim activates after Zelle payment via Apex tab in Waypoint admin.
- **Pricing:** $10/mo or $100/school year

---

## BEACON (Elementary Counselor Command Center)

- **Live URL:** https://clearpath-beacon.pages.dev
- **Supabase Dashboard:** https://supabase.com/dashboard/project/cghhabcbgyoqwqjzunfo
- **Default mode:** Local (on-device, no login needed)
- **License required:** Enter key during setup or in Settings
- **Kim's test key:** BCN-YNJRVF-KRC3 (active until 2027-06-01)
- **Pricing:** $8/mo or $79/school year
- **License management:** ops Supabase Table Editor → product_licenses table

---

## INVESTIGATOR TOOLKIT (Campus Investigation PWA)

- **Distribution:** Download from clearpathedgroup.com or hosted PWA (pending Cloudflare setup)
- **Planned URL:** investigatortoolkit.clearpathedgroup.com
- **License required:** Enter key on first launch
- **Kim's test key:** INV-E5KZ2X-RNCP (active until 2027-06-01)
- **Pricing:** $5/mo or $49/school year
- **100% on-device** — no cloud, no login, just license key

---

## OPS COMMAND CENTER (Internal)

- **URL:** https://clearpath-ops.pages.dev
- **No login** — gate uses partner name (Kim or Melissa)
- **Partner Chat:** Kim ↔ Melissa messaging
- **Manages:** Handoffs, decisions, license keys
- **Supabase Dashboard:** https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes

---

## LICENSE MANAGEMENT (Shared)

- **Dashboard:** https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes → Table Editor → product_licenses
- **Key formats:** BCN-XXXXXX-XXXX (Beacon), INV-XXXXXX-XXXX (Toolkit)
- **Test keys (already in DB):** BCN-TEST01-0001, INV-TEST01-0001
- **Kim's keys:** BCN-YNJRVF-KRC3, INV-E5KZ2X-RNCP
- **To revoke:** Change status from `active` to `revoked` in Table Editor
- **To renew:** Update `expires_at` to new date

---

## MERIDIAN (SPED Compliance) — NOT LAUNCHED

- Same app as Waypoint, purple sidebar section
- **Demo:** Enable via Waypoint admin panel for Lone Star ISD
- **Seed data:** 9 SPED students, 4 IEPs, 2 504 plans

---

## ORIGINS (Family Portal) — NOT LAUNCHED

- Family portal at `/family` (no auth required)
- Staff routes at `/origins/*` in Waypoint
- **Demo:** Enable via Waypoint admin panel

---

## INFRASTRUCTURE QUICK REFERENCE

| Item | Value |
|------|-------|
| Company domain | clearpathedgroup.com |
| Zelle tag | clearpathedgroup |
| GitHub org | jkculley-cyber |
| Cloudflare Account ID | 05ff8f94d82a54168e183bd8e0614b70 |
