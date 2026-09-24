-- ============================================
-- Vayro Migration: add hire/hourly-daily driver support
-- Run this ONCE in Supabase SQL Editor against your EXISTING database
-- (the one that already has the original schema.sql applied).
-- This does NOT delete any existing data.
-- ============================================

-- 0. Make sure the is_admin() helper exists (safe to re-run if it already does)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$;

-- 1. Make dropoff fields optional (hire bookings have no fixed destination)
ALTER TABLE bookings ALTER COLUMN dropoff_latitude DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN dropoff_longitude DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN dropoff_address DROP NOT NULL;

-- 2. Add new columns to bookings for hire-type bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'ride'
  CHECK (service_type IN ('ride', 'hire'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hire_type VARCHAR(20)
  CHECK (hire_type IN ('hourly', 'daily'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hire_duration_hours DECIMAL(6, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS night_booking BOOLEAN DEFAULT false;

-- 3. Create the new hire pricing table
CREATE TABLE IF NOT EXISTS hire_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate DECIMAL(10, 2) NOT NULL,
  minimum_charge DECIMAL(10, 2) NOT NULL,
  daily_charge DECIMAL(10, 2) NOT NULL,
  night_allowance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE hire_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hire_pricing_rules_select_public ON hire_pricing_rules;
CREATE POLICY hire_pricing_rules_select_public ON hire_pricing_rules FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS hire_pricing_rules_admin_all ON hire_pricing_rules;
CREATE POLICY hire_pricing_rules_admin_all ON hire_pricing_rules FOR ALL
  USING (is_admin());

DROP TRIGGER IF EXISTS hire_pricing_rules_updated_at_trigger ON hire_pricing_rules;
CREATE TRIGGER hire_pricing_rules_updated_at_trigger BEFORE UPDATE ON hire_pricing_rules
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Seed your rate card (only runs if the table is currently empty)
INSERT INTO hire_pricing_rules (hourly_rate, minimum_charge, daily_charge, night_allowance, active)
SELECT 120, 480, 1700, 250, true
WHERE NOT EXISTS (SELECT 1 FROM hire_pricing_rules);

-- Done. Your existing data (users, drivers, bookings, etc.) is untouched.

-- ============================================
-- Migration 2: track whether a user has set a password
-- Safe to run even if you already ran the first migration block above.
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false;
