-- ============================================================
-- EASI RIDE — ENABLE REALTIME FOR ONLINE/OFFLINE SYNC
-- Run this in the Supabase SQL editor.
--
-- The driver mobile app and driver PWA keep drivers.driver_status
-- and driver_sessions in sync. Realtime subscriptions on those two
-- tables (so toggles in one app reflect in the other) require both
-- tables to be part of the supabase_realtime publication.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_sessions;
  END IF;
END $$;
