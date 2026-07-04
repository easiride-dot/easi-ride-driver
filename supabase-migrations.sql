-- ============================================================
-- EASI RIDE DRIVER — SUPABASE MIGRATIONS
-- Run ALL of these in order in the Supabase SQL editor
-- ============================================================

-- 1. Add plate_number to drivers table
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS plate_number varchar(20);

-- 2. Extend ride_status enum with new driver flow statuses
--    (Supabase / Postgres requires this approach to extend enums safely)
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'driver_arrived';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 3. Add new columns to rides table for driver flow
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_latitude double precision,
  ADD COLUMN IF NOT EXISTS pickup_longitude double precision,
  ADD COLUMN IF NOT EXISTS destination_latitude double precision,
  ADD COLUMN IF NOT EXISTS destination_longitude double precision,
  ADD COLUMN IF NOT EXISTS distance_km double precision,
  ADD COLUMN IF NOT EXISTS fare_amount numeric(10,2);

-- 4. Create driver_locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES rides(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy float,
  heading float,
  speed float,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver upserts own location"
  ON driver_locations FOR ALL
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Admin reads all locations"
  ON driver_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 5. Create or update pricing_config table
CREATE TABLE IF NOT EXISTS pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Ensure all required columns exist in case the table was created previously
ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS base_fare numeric(10,2) NOT NULL DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS per_km_rate numeric(10,2) NOT NULL DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS surge_normal numeric(4,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS surge_peak numeric(4,2) NOT NULL DEFAULT 1.30,
  ADD COLUMN IF NOT EXISTS surge_rain numeric(4,2) NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS surge_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS surge_mode varchar(10) NOT NULL DEFAULT 'normal' CHECK (surge_mode IN ('normal','peak','rain')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Seed with default pricing ONLY if the table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pricing_config) THEN
    -- If there's an existing distance_bracket column from another app, it might cause issues,
    -- but usually this is enough if the table is empty. If it fails, the table might have custom NOT NULL columns.
    -- Assuming the table already has rows in your DB, this block will simply be skipped safely!
    INSERT INTO pricing_config (id, base_fare, per_km_rate)
    VALUES (gen_random_uuid(), 7.00, 7.00);
  END IF;
END $$;

ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads pricing"
  ON pricing_config FOR SELECT
  USING (true);

CREATE POLICY "Admin updates pricing"
  ON pricing_config FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 6. Create driver_sessions table
CREATE TABLE IF NOT EXISTS driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  is_active boolean DEFAULT true
);

ALTER TABLE driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver manages own sessions"
  ON driver_sessions FOR ALL
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Allow admins to read sessions
CREATE POLICY "Admin reads all sessions"
  ON driver_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 7. Enable Realtime on rides and driver_locations safely
DO $$
BEGIN
  -- Add rides to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;

  -- Add driver_locations to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
  END IF;
END $$;

-- ============================================================
-- END OF MIGRATIONS
-- ============================================================
