-- ============================================
-- Vayro Migration v3: driver document review + ride allocation
-- Run this ONCE in Supabase SQL Editor against your EXISTING database
-- (the one that already has schema.sql, and optionally vayro-migration.sql
-- / vayro-migration-v2.sql, applied). This does NOT delete any data.
--
-- What this fixes:
--   1. Admin could not actually approve a driver in practice: the approve
--      API requires every uploaded document to have an "approved" row in
--      ride_documents_reviews, but there was no way to create one. This
--      adds a UNIQUE constraint on document_id so the new
--      /api/admin/documents/review route can upsert one review per
--      document (re-reviewing overwrites the old verdict instead of
--      leaving stale rows behind).
--   2. Drivers had no way to see unassigned ride requests at all: the
--      only bookings policy let a driver see bookings already assigned
--      to them, so an unassigned "searching" booking was invisible and
--      /api/drivers/rides/accept was unreachable from the UI. This adds
--      a policy letting an approved, online driver see (only) unassigned
--      "searching" bookings.
-- ============================================

-- 1. One review per document (safe to re-run: only adds the constraint
--    if it isn't already there, and only if there are no existing
--    duplicate document_id rows — if you get a "could not create unique
--    index" error here, first deduplicate ride_documents_reviews keeping
--    the most recent row per document_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ride_documents_reviews_document_id_key'
  ) THEN
    ALTER TABLE ride_documents_reviews
      ADD CONSTRAINT ride_documents_reviews_document_id_key UNIQUE (document_id);
  END IF;
END $$;

-- 2. Let an approved, available driver see not-yet-claimed ride requests.
DROP POLICY IF EXISTS bookings_select_searching_for_available_drivers ON bookings;
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
