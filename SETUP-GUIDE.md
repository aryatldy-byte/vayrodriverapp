# Vayro Driver App — Setup Guide

This app covers **drivers** (OTP login) and **admins** (email + password
login at `/admin/login`). There's a separate `vayro-client` app for
riders — both share the same Supabase backend, already filled in for you
in `.env.local`.

## 1. If you already ran the old schema.sql before

Run, in this order, in Supabase's SQL Editor **once each**:
1. `vayro-migration.sql` — adds hire-pricing support.
2. `vayro-migration-v3-driver-allocation.sql` — required for admin document
   approval and driver ride allocation to actually work (see below); safe
   to run even if you're not sure whether you need it.

Both are additive and don't touch existing data. Skip both only on a
brand-new Supabase project that's never had a schema applied (in that
case just run the current `schema.sql` directly — it already includes
everything).

### What `vayro-migration-v3-driver-allocation.sql` fixes

- **Admin driver approval was previously a dead end.** The "Approve
  Driver" button calls an API that requires every uploaded document to
  already have an "approved" row in `ride_documents_reviews` — but there
  was no UI or endpoint to create that row, so no driver could ever
  actually be approved. The admin dashboard's document list now has its
  own **Approve doc / Reject doc** buttons (calling the new
  `/api/admin/documents/review` route) — once license, police clearance,
  and address proof are all approved there, "Approve Driver" unlocks.
- **Drivers couldn't see ride requests.** Row Level Security only let a
  driver see bookings already assigned to them, so an unassigned
  ("searching") booking was invisible and there was nothing to accept.
  Approved + online drivers now see a live **Ride Requests** list on
  their dashboard and can tap **Accept**; once accepted, a **Current
  Ride** card lets them progress it (on my way → start trip → complete).

## 2. Storage bucket

If you haven't already, create a Storage bucket named exactly
`driver-documents`, set to **Public** (for license/ID uploads).

## 3. Create your admin account

Admins don't self-signup. In Supabase:
1. Authentication → Users → Add User → set email + password, toggle **Auto Confirm User**
2. Copy the new user's **User UID**
3. Run in SQL Editor:

```sql
INSERT INTO users (auth_id, email, first_name, last_name, role, status)
VALUES ('PASTE-USER-UID-HERE', 'admin@yourcompany.com', 'Admin', 'User', 'admin', 'active');
```

4. Log in at `/admin/login`

To reset a forgotten admin password, either use the "Forgot password?" link
(needs Supabase SMTP configured) or reset it directly from Supabase's
Authentication → Users panel.

## 4. Enable OTP for drivers

Email OTP works out of the box. Phone OTP needs an SMS provider (Twilio,
etc.) connected under Authentication → Providers → Phone in Supabase.

**Email template tip:** by default Supabase's OTP email only shows a
clickable magic link, not a typed code — but this app's login screen
expects a code. Go to Authentication → Email Templates → Magic Link (and
also check Confirm Signup, used for brand-new accounts) and make sure the
body includes `{{ .Token }}` so users see an actual code to type in.

## 5. Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` → driver login. Admin is at `/admin/login`.

## 6. Environment variables

Already filled in: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Still need to fill in yourself:
- `SUPABASE_SERVICE_KEY` — Supabase Settings → API → `service_role` key
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Google Cloud Console → enable "Maps JavaScript API" → Credentials

## 7. Deploy to Vercel

Same as the client app — push to GitHub, import into Vercel, add the same
env vars, set `NEXT_PUBLIC_APP_URL` to the deployed URL, and add that URL
to Supabase's Redirect URLs allow-list.

## 8. Turning this into an Android APK later

Same approach as the client app — deploy to a real HTTPS URL, then wrap it
with a TWA (Bubblewrap) or Capacitor. Keep the client and driver APKs as
two separate builds pointing at their two separate deployed URLs.
