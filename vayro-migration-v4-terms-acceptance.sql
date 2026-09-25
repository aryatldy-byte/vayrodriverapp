-- ============================================
-- Migration: Terms & Conditions acceptance
-- Execute this in Supabase SQL Editor after main schema
--
-- NOTE: vayro-client and vayro-driver-admin share the same Supabase
-- project/database (same NEXT_PUBLIC_SUPABASE_URL), so this migration
-- only needs to be run ONCE — not once per app. An identical copy is
-- kept in vayro-client/vayro-migration-v5-terms-acceptance.sql
-- purely for discoverability from that project folder.
--
-- NOTE: the app's spec referred to a "profiles" table, but this schema's
-- actual user table (see schema.sql) is named "users" — that's the table
-- extended below, and it's the one both apps' auth/profile code reads
-- from (getUserProfile / updateUserProfile in lib/supabase/client.ts).
-- ============================================

-- Add terms_accepted to the users table (covers client, driver and admin
-- accounts alike — the Terms modal is only shown to client/driver apps,
-- but the column lives on the shared users table for all roles).
ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false;

-- Optional but recommended: track *when* terms were accepted, useful for
-- audit/compliance if you ever need to prove consent was given.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Keep terms_accepted_at in sync automatically whenever terms_accepted
-- flips to true, so the frontend only ever has to send
-- { terms_accepted: true } and never worry about the timestamp itself.
CREATE OR REPLACE FUNCTION set_terms_accepted_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.terms_accepted = true AND (OLD.terms_accepted IS DISTINCT FROM true) THEN
    NEW.terms_accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_terms_accepted_at ON users;
CREATE TRIGGER trg_set_terms_accepted_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_terms_accepted_at();

-- No RLS policy changes needed: the existing `users_update_own` policy
-- (auth_id = auth.uid()) already lets a signed-in user update their own
-- row, which is all updateUserProfile()'s { terms_accepted: true } call
-- needs.

-- Backfill note: existing accounts created before this migration will
-- have terms_accepted = false by default, so the Terms & Conditions
-- modal will correctly show once for them on their next login too.
