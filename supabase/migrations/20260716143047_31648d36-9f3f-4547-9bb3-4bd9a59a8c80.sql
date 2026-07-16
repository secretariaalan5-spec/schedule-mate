
CREATE TABLE public.glucometers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  brand text,
  notes text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','loaned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glucometers TO authenticated;
GRANT ALL ON public.glucometers TO service_role;
ALTER TABLE public.glucometers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved members can view glucometers" ON public.glucometers FOR SELECT USING ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can insert glucometers" ON public.glucometers FOR INSERT WITH CHECK ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can update glucometers" ON public.glucometers FOR UPDATE USING ((SELECT public.is_approved_member(auth.uid()))) WITH CHECK ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can delete glucometers" ON public.glucometers FOR DELETE USING ((SELECT public.is_approved_member(auth.uid())));
CREATE TRIGGER update_glucometers_updated_at BEFORE UPDATE ON public.glucometers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.glucometer_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  glucometer_id uuid NOT NULL REFERENCES public.glucometers(id) ON DELETE RESTRICT,
  loaned_at date NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date date NOT NULL,
  returned_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX glucometer_loans_one_active_per_device ON public.glucometer_loans (glucometer_id) WHERE returned_at IS NULL;
CREATE INDEX glucometer_loans_patient_idx ON public.glucometer_loans (patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glucometer_loans TO authenticated;
GRANT ALL ON public.glucometer_loans TO service_role;
ALTER TABLE public.glucometer_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved members can view loans" ON public.glucometer_loans FOR SELECT USING ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can insert loans" ON public.glucometer_loans FOR INSERT WITH CHECK ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can update loans" ON public.glucometer_loans FOR UPDATE USING ((SELECT public.is_approved_member(auth.uid()))) WITH CHECK ((SELECT public.is_approved_member(auth.uid())));
CREATE POLICY "Approved members can delete loans" ON public.glucometer_loans FOR DELETE USING ((SELECT public.is_approved_member(auth.uid())));
CREATE TRIGGER update_glucometer_loans_updated_at BEFORE UPDATE ON public.glucometer_loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync glucometer status when a loan is created/returned/deleted
CREATE OR REPLACE FUNCTION public.sync_glucometer_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.returned_at IS NULL THEN
      UPDATE public.glucometers SET status='loaned' WHERE id = NEW.glucometer_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
      UPDATE public.glucometers SET status='available' WHERE id = NEW.glucometer_id;
    ELSIF NEW.returned_at IS NULL AND OLD.returned_at IS NOT NULL THEN
      UPDATE public.glucometers SET status='loaned' WHERE id = NEW.glucometer_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.returned_at IS NULL THEN
      UPDATE public.glucometers SET status='available' WHERE id = OLD.glucometer_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_sync_glucometer_status
AFTER INSERT OR UPDATE OR DELETE ON public.glucometer_loans
FOR EACH ROW EXECUTE FUNCTION public.sync_glucometer_status();
