-- ============================================================
-- EASI RIDE — DRIVER TRACKING RLS POLICIES
-- Run ALL of this in the Supabase SQL editor
-- ============================================================

-- 0. Add UNIQUE constraint on driver_locations.driver_id (required for upsert)
DROP INDEX IF EXISTS idx_driver_locations_driver_id;
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

-- 5. Allow driver to update rides they are assigned to (accept/decline/geofence)
DROP POLICY IF EXISTS "Driver updates assigned rides" ON rides;
CREATE POLICY "Driver updates assigned rides"
  ON rides FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

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

-- 8. SECURITY DEFINER functions to bypass RLS for driver accept/decline/geofence
--    These run with the privileges of the function owner, bypassing RLS.

CREATE OR REPLACE FUNCTION decline_ride(p_ride_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
  SET status = 'pool_locked_awaiting_driver',
      driver_declined_at = now(),
      driver_id = NULL,
      updated_at = now()
  WHERE id = p_ride_id
    AND driver_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION accept_ride(p_ride_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
  SET status = 'driver_assigned',
      driver_accepted_at = now(),
      eta_minutes = 5 + floor(random() * 10)::int,
      updated_at = now()
  WHERE id = p_ride_id
    AND driver_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION transition_ride_to_arrived(p_ride_id uuid, p_arrived_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
  SET status = 'driver_arrived',
      pickup_arrived_at = p_arrived_at,
      updated_at = now()
  WHERE id = p_ride_id AND driver_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION transition_ride_to_in_progress(p_ride_id uuid, p_in_progress_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
  SET status = 'in_progress',
      in_progress_at = p_in_progress_at,
      updated_at = now()
  WHERE id = p_ride_id AND driver_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION transition_ride_to_completed(p_ride_id uuid, p_completed_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
  SET status = 'completed',
      completed_at = p_completed_at,
      updated_at = now()
  WHERE id = p_ride_id AND driver_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- ============================================================
-- END
-- ============================================================
