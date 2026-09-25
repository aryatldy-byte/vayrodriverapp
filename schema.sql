-- ============================================
-- RideHail MVP - Database Schema
-- Execute this in Supabase SQL Editor
-- ============================================

-- 1. USERS TABLE (Core user data for all roles)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  profile_photo_url TEXT,
  role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  has_password BOOLEAN DEFAULT false,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. DRIVERS TABLE (Driver-specific information)
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  license_expiry DATE,
  vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('manual', 'automatic', 'luxury', 'electric')),
  vehicle_registration VARCHAR(50) UNIQUE,
  vehicle_color VARCHAR(50),
  vehicle_model VARCHAR(100),
  is_available BOOLEAN DEFAULT false,
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  rating DECIMAL(3, 2) DEFAULT 0,
  total_rides INT DEFAULT 0,
  total_earnings DECIMAL(12, 2) DEFAULT 0,
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  documents_submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. RIDE DOCUMENTS TABLE
CREATE TABLE ride_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('license', 'police_clearance', 'address_proof')),
  document_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(50),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. RIDE DOCUMENTS REVIEWS TABLE (Admin approval tracking)
-- document_id is UNIQUE so a re-review (driver re-uploads, or an admin
-- changes their mind) overwrites the previous verdict via upsert instead
-- of leaving stale rows that would otherwise confuse the "are all
-- documents approved?" check in /api/admin/drivers/approve.
CREATE TABLE ride_documents_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL UNIQUE REFERENCES ride_documents(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('approved', 'rejected')),
  comments TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. BOOKINGS TABLE (Ride bookings)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_latitude DECIMAL(10, 8) NOT NULL,
  pickup_longitude DECIMAL(11, 8) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_latitude DECIMAL(10, 8),
  dropoff_longitude DECIMAL(11, 8),
  dropoff_address TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  booking_type VARCHAR(50) DEFAULT 'instant' CHECK (booking_type IN ('instant', 'scheduled')),
  service_type VARCHAR(20) DEFAULT 'hire' CHECK (service_type IN ('ride', 'hire')),
  vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('manual', 'automatic', 'luxury', 'electric')),
  hire_type VARCHAR(20) CHECK (hire_type IN ('hourly', 'daily')),
  hire_duration_hours DECIMAL(6, 2) CHECK (hire_duration_hours IS NULL OR hire_duration_hours >= 4),
  night_booking BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'searching' CHECK (status IN ('searching', 'accepted', 'driver_arriving', 'started', 'completed', 'cancelled')),
  distance_km DECIMAL(8, 2),
  estimated_fare DECIMAL(12, 2),
  actual_fare DECIMAL(12, 2),
  payment_method VARCHAR(50) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'wallet')),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  special_notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_by VARCHAR(50) CHECK (cancelled_by IN ('client', 'driver', 'admin')),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  client_rating INT CHECK (client_rating >= 1 AND client_rating <= 5),
  client_review TEXT,
  driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
  driver_review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. RIDE UPDATES TABLE (Real-time location & status updates)
CREATE TABLE ride_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_latitude DECIMAL(10, 8) NOT NULL,
  driver_longitude DECIMAL(11, 8) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('accepted', 'driver_arriving', 'arrived', 'started', 'completed')),
  eta_seconds INT,
  distance_from_pickup_meters INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7b. HIRE PRICING TABLE (Hourly/daily driver-hire rates — "Vayro, your driver on demand")
CREATE TABLE hire_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate DECIMAL(10, 2) NOT NULL,
  minimum_charge DECIMAL(10, 2) NOT NULL,
  daily_charge DECIMAL(10, 2) NOT NULL,
  night_allowance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. PRICING TABLE (Base pricing rules)
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type VARCHAR(50) NOT NULL,
  base_fare DECIMAL(12, 2) NOT NULL,
  per_km_fare DECIMAL(10, 2) NOT NULL,
  per_minute_fare DECIMAL(10, 2) NOT NULL,
  minimum_fare DECIMAL(12, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- INDEXES (Performance optimization)
-- ============================================

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_approval_status ON drivers(approval_status);
CREATE INDEX idx_drivers_is_available ON drivers(is_available);
CREATE INDEX idx_ride_documents_driver_id ON ride_documents(driver_id);
CREATE INDEX idx_ride_documents_reviews_admin_id ON ride_documents_reviews(admin_id);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_driver_id ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE INDEX idx_ride_updates_booking_id ON ride_updates(booking_id);
CREATE INDEX idx_ride_updates_created_at ON ride_updates(created_at);
CREATE INDEX idx_pricing_vehicle_type ON pricing_rules(vehicle_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_documents_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hire_pricing_rules ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
CREATE POLICY users_select_own ON users FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY users_select_public ON users FOR SELECT
  USING (users.role = 'driver' AND users.status = 'active');

CREATE POLICY users_update_own ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Allow a newly authenticated person (post OTP/signup) to create their own profile row
CREATE POLICY users_insert_own ON users FOR INSERT
  WITH CHECK (auth_id = auth.uid());


-- Helper function to safely check admin role without RLS recursion
-- (querying "users" from within a policy ON "users" causes infinite recursion)
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

CREATE POLICY users_admin_all ON users FOR ALL
  USING (is_admin());

-- DRIVERS POLICIES
CREATE POLICY drivers_select_own ON drivers FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY drivers_select_public ON drivers FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = drivers.user_id) = 'driver' 
    AND (SELECT status FROM users WHERE id = drivers.user_id) = 'active'
    AND approval_status = 'approved'
  );

CREATE POLICY drivers_update_own ON drivers FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY drivers_admin_all ON drivers FOR ALL
  USING (is_admin());

-- Allow a driver to create their own driver record (first-time signup,
-- or backfilling a driver whose row was wiped by a reset)
CREATE POLICY drivers_insert_own ON drivers FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- RIDE_DOCUMENTS POLICIES
CREATE POLICY ride_documents_select_own ON ride_documents FOR SELECT
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

CREATE POLICY ride_documents_insert_own ON ride_documents FOR INSERT
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

CREATE POLICY ride_documents_admin_all ON ride_documents FOR ALL
  USING (is_admin());

-- RIDE_DOCUMENTS_REVIEWS POLICIES
CREATE POLICY ride_documents_reviews_select_own ON ride_documents_reviews FOR SELECT
  USING (
    admin_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY ride_documents_reviews_admin_all ON ride_documents_reviews FOR ALL
  USING (is_admin());

-- BOOKINGS POLICIES
CREATE POLICY bookings_select_own ON bookings FOR SELECT
  USING (
    client_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR 
    driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

CREATE POLICY bookings_insert_own ON bookings FOR INSERT
  WITH CHECK (
    client_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY bookings_update_own ON bookings FOR UPDATE
  USING (
    client_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR 
    driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  )
  WITH CHECK (
    client_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR 
    driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

CREATE POLICY bookings_admin_all ON bookings FOR ALL
  USING (is_admin());

-- Lets an approved, currently-online driver see unassigned ride requests
-- ("searching" bookings with no driver yet) so they have something to
-- accept in the first place. Without this, bookings_select_own above
-- would hide every booking from a driver until after it's already been
-- assigned to them, making /api/drivers/rides/accept unreachable from
-- the UI. Drivers still can't see who accepted what beyond their own
-- rides — this only exposes not-yet-claimed requests.
CREATE POLICY bookings_select_searching_for_available_drivers ON bookings FOR SELECT
  USING (
    status = 'searching'
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        AND d.approval_status = 'approved'
        AND d.is_available = true
    )
  );

-- RIDE_UPDATES POLICIES
CREATE POLICY ride_updates_select_own ON ride_updates FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE 
      client_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      OR 
      driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

CREATE POLICY ride_updates_insert_driver ON ride_updates FOR INSERT
  WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings WHERE 
      driver_id IN (SELECT id FROM drivers WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

-- PRICING_RULES POLICIES
CREATE POLICY pricing_rules_select_public ON pricing_rules FOR SELECT
  USING (active = true);

CREATE POLICY pricing_rules_admin_all ON pricing_rules FOR ALL
  USING (is_admin());

-- HIRE_PRICING_RULES POLICIES
CREATE POLICY hire_pricing_rules_select_public ON hire_pricing_rules FOR SELECT
  USING (active = true);

CREATE POLICY hire_pricing_rules_admin_all ON hire_pricing_rules FOR ALL
  USING (is_admin());

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER users_updated_at_trigger BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER drivers_updated_at_trigger BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER bookings_updated_at_trigger BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER pricing_rules_updated_at_trigger BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER hire_pricing_rules_updated_at_trigger BEFORE UPDATE ON hire_pricing_rules
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Stamp terms_accepted_at automatically the moment terms_accepted flips
-- to true, so the app only ever has to send { terms_accepted: true }.
CREATE OR REPLACE FUNCTION set_terms_accepted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.terms_accepted = true AND (OLD.terms_accepted IS DISTINCT FROM true) THEN
    NEW.terms_accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER users_terms_accepted_at_trigger BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_terms_accepted_at();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- NOTE: Replace these UUIDs with actual auth.users IDs from Supabase Auth

-- INSERT INTO pricing_rules (vehicle_type, base_fare, per_km_fare, per_minute_fare, minimum_fare) VALUES
-- ('manual', 50, 8, 1, 50),
-- ('automatic', 75, 12, 1.5, 75),
-- ('luxury', 150, 20, 2.5, 150),
-- ('electric', 100, 15, 2, 100);

-- Default hire pricing (from your rate card: ₹120/hr, ₹480 min, ₹1700/day, ₹250 night)
INSERT INTO hire_pricing_rules (hourly_rate, minimum_charge, daily_charge, night_allowance, active)
VALUES (120, 480, 1700, 250, true);
