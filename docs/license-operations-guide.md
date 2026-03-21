# License Operations Guide — Beacon & Investigator Toolkit

> **Audience:** Kim + Melissa (internal operations)
> **Last updated:** 2026-03-21

---

## How Licensing Works

Each product (Beacon and Investigator Toolkit) requires a unique license key to unlock full functionality. Keys are stored in a shared database (ops Supabase) and verified by the app on launch and periodically during use.

- **Without a key:** Users can set up the app and view data, but cannot create new records (soft gate).
- **With a valid key:** Full access to all features.
- **Revoked/expired key:** Same as no key — view only, no new records. Takes effect within 5 minutes (or up to 7 days if user is offline).

---

## Product Pricing

| Product | Monthly | Annual (School Year) |
|---------|---------|----------------------|
| Beacon | $8/mo | $79/yr |
| Investigator Toolkit | $5/mo | $49/yr |

Payment via Zelle to `clearpathedgroup`.

---

## New Customer Workflow

### 1. Customer Purchases via Zelle

Customer pays on clearpathedgroup.com store. Confirm payment in Zelle.

### 2. Generate a License Key

**Option A — SQL Editor (recommended)**

Go to: https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes/sql/new

Paste and run (replace the values in ALL CAPS):

```sql
INSERT INTO product_licenses (license_key, product, customer_name, customer_email, status, expires_at)
VALUES (
  'PREFIX-XXXXXX-XXXX',
  'PRODUCT',
  'CUSTOMER NAME',
  'CUSTOMER EMAIL',
  'active',
  'EXPIRY DATE'
);
```

Key format:
- Beacon keys start with `BCN-` (e.g., `BCN-7KHR3M-QW42`)
- Toolkit keys start with `INV-` (e.g., `INV-9PLN5T-DX83`)

Make up a random key using letters and numbers (avoid I, O, 0, 1 to prevent confusion). Or use the generator script:

```bash
node /c/Users/jkcul/investigator-toolkit/scripts/generate-license-key.mjs --product beacon --customer "Jane Smith" --email jane@school.edu --dry-run
```

This prints a random key. Copy it into the SQL above.

**Option B — Table Editor (visual)**

1. Go to: https://supabase.com/dashboard/project/xbpuqaqpcbixxodblaes
2. Click **Table Editor** in the left sidebar
3. Select `product_licenses`
4. Click **+ Insert Row**
5. Fill in:
   - `license_key`: The key you're giving the customer
   - `product`: `beacon` or `investigator`
   - `customer_name`: Their name
   - `customer_email`: Their email
   - `status`: `active`
   - `expires_at`: Expiry date (e.g., `2027-06-01`)
6. Click **Save**

### 3. Send the Key to the Customer

Email the customer their license key and the getting started instructions (see Customer Guide section below).

---

## Renewals

When a customer renews (annual payment confirmed):

1. Go to Table Editor → `product_licenses`
2. Find their row by name or key
3. Update `expires_at` to the new expiry date (e.g., one year from now)
4. That's it — no new key needed, their existing key keeps working

---

## Revoking Access

If a customer cancels, requests a refund, or doesn't renew:

**Option A — Table Editor**
1. Find their row in `product_licenses`
2. Change `status` from `active` to `revoked`
3. Save

**Option B — SQL Editor**
```sql
UPDATE product_licenses SET status = 'revoked' WHERE license_key = 'BCN-XXXXXX-XXXX';
```

The customer's app will show the soft gate:
- **Within 5 minutes** if they're online
- **Within 7 days** if they're offline (grace period)

They can still **view** all their existing data — they just can't create anything new.

---

## Checking License Status

Go to Table Editor → `product_licenses` to see all issued keys, their status, and expiry dates.

| Column | Meaning |
|--------|---------|
| `license_key` | The key given to the customer |
| `product` | `beacon` or `investigator` |
| `customer_name` | Who it was issued to |
| `status` | `active`, `expired`, or `revoked` |
| `expires_at` | When the subscription ends |
| `activated_at` | When the key was created |

---

## Troubleshooting

| Customer says... | What to check |
|------------------|---------------|
| "My key doesn't work" | Verify the key matches exactly in the table (case-sensitive, no spaces). Check `status` is `active` and `expires_at` is in the future. |
| "I was locked out suddenly" | Check if the key was accidentally revoked or expired. Update `status` to `active` and/or extend `expires_at`. |
| "I can see my data but can't add anything" | This is the soft gate — their license is invalid. Verify status and expiry. |
| "I'm offline and got locked out" | The 7-day offline grace period may have expired. They need to connect to the internet so the app can re-verify. |
| "I lost my key" | Look up their name/email in the table and resend the key. |

---

---

# Customer Getting Started Guide

> **This section is for customers.** Vera and Nova — format this for the store/email templates.

---

## Beacon — Getting Started

Welcome to Beacon! Here's how to activate your license and start using the app.

### Step 1: Open Beacon

Go to your Beacon link in your browser. If this is your first time, you'll see the Local Mode Setup screen.

### Step 2: Enter Your Information

- **Your Name** (required)
- **Campus** (optional)
- **District** (optional)

### Step 3: Enter Your License Key

In the **License Key** field, enter the key from your purchase confirmation email. It looks like this:

```
BCN-XXXXXX-XXXX
```

Click **Start Using Beacon**. The app will verify your key and you're in!

### Step 4: Start Counseling

You're ready to go. All your data is stored locally on your device — nothing is sent to any server.

### Managing Your License

Go to **Settings** to see your license status or enter a new key. You'll also find options to export a backup of your data.

### What Happens If My License Expires?

You can still **view** all your existing data (students, sessions, referrals, etc.). You just won't be able to create new records until you renew. Your data is never deleted.

### Need Help?

Contact us at support@clearpathedgroup.com.

---

## Investigator Toolkit — Getting Started

Welcome to the Campus Investigation Toolkit! Here's how to get started.

### Step 1: Open the Toolkit

Go to your Toolkit link in your browser. You'll see the license activation screen.

### Step 2: Enter Your License Key

Enter the key from your purchase confirmation email. It looks like this:

```
INV-XXXXXX-XXXX
```

Click **Activate License**. The app will verify your key.

### Step 3: Set Up Your Campus

On the setup screen, enter:
- **District Name**
- **Campus Name**
- **Your Name** (Administrator)
- **School Year**

Click **Get Started**.

### Step 4: Start Investigating

You're ready to go. Create your first case from the **New Intake** page. All data is stored locally on your device.

### Managing Your License

Go to **Settings** to view your license status or update your key.

### What Happens If My License Expires?

You can still **view** all your existing cases and data. You just won't be able to create new cases until you renew. Your data is never deleted.

### Offline Use

The app works offline! If you lose internet, you can keep working for up to 7 days. After that, you'll need to reconnect so the app can verify your license.

### Need Help?

Contact us at support@clearpathedgroup.com.
