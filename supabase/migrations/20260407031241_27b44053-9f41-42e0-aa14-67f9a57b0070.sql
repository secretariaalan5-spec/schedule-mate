
CREATE TABLE public.health_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view health_units" ON public.health_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert health_units" ON public.health_units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update health_units" ON public.health_units FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete health_units" ON public.health_units FOR DELETE TO authenticated USING (true);
