-- ============================================================
-- EASI RIDE — DRIVER TRACKING RLS POLICIES
-- Run ALL of this in the Supabase SQL editor
-- ============================================================

-- 0. Ensure UNIQUE constraint on driver_locations.driver_id (required for upsert)
DROP INDEX IF EXISTS idx_driver_locations_driver_id;
ALTER TABLE driver_locations DROP CONSTRAINT IF EXISTS driver_locations_driver_id_key;
ALTER TABLE driver_locations
  ADD CONSTRAINT driver_locations_driver_id_key UNIQUE (driver_id);

-- 1. Ensure driver_id column exists on rides (for student app tracking)
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;

-- 2. Allow assigned driver to see their rides (needed for realtime subscription)
DROP POLICY IF EXISTS "Driver reads assigned rides" ON rides;
CREATE POLICY "Driver reads assigned rides"
  ON rides FOR SELECT
  USING (
    driver_id = auth.uid()
  );

-- 3. Allow the ride's student (user_id) to read their assigned driver's location
DROP POLICY IF EXISTS "Ride owner reads driver location" ON driver_locations;
CREATE POLICY "Ride owner reads driver location"
  ON driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.driver_id = driver_locations.driver_id
        AND rides.user_id = auth.uid()
    )
  );

-- 4. Allow students to read their assigned driver's info from the drivers table
DROP POLICY IF EXISTS "Ride owner reads assigned driver" ON drivers;
CREATE POLICY "Ride owner reads assigned driver"
  ON drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.driver_id = drivers.id
        AND rides.user_id = auth.uid()
    )
  );

-- 5. Allow driver to update their assigned rides (accept/decline/geofence)
-- USING checks OLD row (before update), WITH CHECK checks NEW row (after update)
-- This allows: keeping driver_id (accept), setting to null (decline), or status updates
-- Also remove conflicting user policies that might block driver updates
DROP POLICY IF EXISTS "Users can update their own pending rides" ON rides;
DROP POLICY IF EXISTS "Driver updates assigned rides" ON rides;
DROP POLICY IF EXISTS "Driver updates assigned ride status" ON rides;
DROP POLICY IF EXISTS "Driver declines assigned ride" ON rides;
CREATE POLICY "Driver can update assigned rides"
  ON rides FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (true);

-- 6. Allow driver to read the name of students assigned to them
DROP POLICY IF EXISTS "Driver reads assigned student profile" ON profiles;
CREATE POLICY "Driver reads assigned student profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.user_id = profiles.id
        AND rides.driver_id = auth.uid()
    )
  );

-- 7. Ensure realtime is enabled for both tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
  END IF;
END $$;

-- 8. Create a function for drivers to decline rides (bypasses RLS)
CREATE OR REPLACE FUNCTION decline_ride(ride_id uuid, driver_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE rides
  SET 
    status = 'pool_locked_awaiting_driver',
    driver_declined_at = NOW(),
    driver_id = NULL,
    updated_at = NOW()
  WHERE id = ride_id AND driver_id = driver_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION decline_ride(uuid, uuid) TO authenticated;

-- ============================================================
-- END
-- ============================================================
