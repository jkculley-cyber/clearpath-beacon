# Beacon — Welcome / License Delivery Email

> Sent to every new Beacon customer after Zelle payment is confirmed and a
> license key has been issued. Paste into your mail client, fill the four
> `{{placeholders}}`, send. Works for monthly or annual.

---

## Placeholders

| Token | Example |
|-------|---------|
| `{{first_name}}` | Nicole |
| `{{license_key}}` | BCN-KQKG2Y-N668 |
| `{{plan_line}}` | `Monthly ($8) — one month of access, no auto-renewal` **or** `Annual ($79) — full school year, no auto-renewal` |
| `{{active_until}}` | May 20, 2026 |

## Plan-line variants

- **Monthly:** `Monthly ($8) — one month of access, no auto-renewal`
- **Annual:** `Annual ($79) — full school year, no auto-renewal`

## Extension language (include only for monthly)

> When you're ready for another month, just send another $8 via Zelle to
> "clearpathedgroup" with "Beacon" in the memo, and I'll extend your
> license. No card on file, no surprise charges.

For annual customers, replace that paragraph with:

> Your license covers the full school year. I'll send a reminder before
> it expires so you have time to renew if you'd like another year.

---

## Subject

```
Your Beacon license — {{license_key}}
```

## Body

```
Hi {{first_name}},

Thanks for subscribing to Beacon! Your Zelle payment has been received
and your license is active.

  License key:   {{license_key}}
  Plan:          {{plan_line}}
  Active until:  {{active_until}}

When you're ready for another month, just send another $8 via Zelle to
"clearpathedgroup" with "Beacon" in the memo, and I'll extend your
license. No card on file, no surprise charges.

─── Getting started ──────────────────────────────────────────

1. Open Beacon:  https://beacon.clearpathedgroup.com/setup?key={{license_key}}

2. Enter your info on the Local Mode Setup screen (your name,
   campus, district).

3. Paste your license key: {{license_key}}

4. Click Start Using Beacon — you're in.

Everything runs on your device. Student data never leaves your computer,
so you're FERPA-safe by design.

─── First 30 seconds ─────────────────────────────────────────

Pick ONE student you saw today. Open Beacon, tap Students → Add Student,
enter their name and referral reason. Then on their profile, tap
"Add Note" and write one sentence about what you talked about.

That's it — you now have a timestamped, searchable record. Everything
else in Beacon builds from that one habit.

─── Need anything? ───────────────────────────────────────────

Reply here or email support@clearpathedgroup.com. I read every message
myself.

Welcome aboard!

Kim Culley
Clear Path Education Group
```
