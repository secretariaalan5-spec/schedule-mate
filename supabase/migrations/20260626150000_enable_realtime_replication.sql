-- Enable Realtime replication for system tables if not already enabled
DO $$
BEGIN
  -- Add appointments table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  -- Add patients table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'patients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
  END IF;

  -- Add health_units table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'health_units'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_units;
  END IF;

  -- Add scheduling_shifts table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scheduling_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduling_shifts;
  END IF;
END $$;
