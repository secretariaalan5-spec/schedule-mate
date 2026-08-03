-- 1. Cadastro único: campos adicionais na paciente
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS health_unit_id uuid REFERENCES public.health_units(id) ON DELETE SET NULL;

-- 2. Módulo Implanon
CREATE TABLE IF NOT EXISTS public.implanon_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'released',
  released_at date,
  applied_at date,
  lot text,
  lot_expiry date,
  expected_removal_at date,
  removed_at date,
  removal_reason text,
  professional text,
  application_site text,
  dum date,
  health_unit_id uuid REFERENCES public.health_units(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implanon_records TO authenticated;
GRANT ALL ON public.implanon_records TO service_role;

ALTER TABLE public.implanon_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members can view implanon"
  ON public.implanon_records FOR SELECT TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can insert implanon"
  ON public.implanon_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update implanon"
  ON public.implanon_records FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete implanon"
  ON public.implanon_records FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE TRIGGER update_implanon_records_updated_at
  BEFORE UPDATE ON public.implanon_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_implanon_patient ON public.implanon_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_implanon_status ON public.implanon_records(status);

-- 3. Linha do tempo unificada (prontuário)
CREATE OR REPLACE VIEW public.patient_timeline
WITH (security_invoker = true) AS
  SELECT
    a.id,
    a.patient_id,
    'agenda'::text AS module,
    'appointment'::text AS event_type,
    a.date AS event_date,
    COALESCE(a.schedule_time, '') AS event_time,
    ('Consulta ' || COALESCE(a.type, 'NORMAL')) AS title,
    COALESCE(a.reason, '') AS detail,
    CASE WHEN a.printed THEN 'impresso' ELSE 'pendente' END AS status,
    a.created_at
  FROM public.appointments a
  UNION ALL
  SELECT
    l.id,
    l.patient_id,
    'emprestimos'::text,
    CASE WHEN l.returned_at IS NULL THEN 'loan_active' ELSE 'loan_returned' END,
    COALESCE(l.returned_at, l.loaned_at),
    ''::text,
    CASE WHEN l.returned_at IS NULL THEN 'Empréstimo de glicosímetro' ELSE 'Devolução de glicosímetro' END,
    COALESCE(l.notes, ''),
    CASE WHEN l.returned_at IS NULL THEN 'ativo' ELSE 'devolvido' END,
    l.created_at
  FROM public.glucometer_loans l
  UNION ALL
  SELECT
    i.id,
    i.patient_id,
    'implanon'::text,
    CASE
      WHEN i.removed_at IS NOT NULL THEN 'implanon_removed'
      WHEN i.applied_at IS NOT NULL THEN 'implanon_applied'
      ELSE 'implanon_released'
    END,
    COALESCE(i.removed_at, i.applied_at, i.released_at, i.created_at::date),
    ''::text,
    CASE
      WHEN i.removed_at IS NOT NULL THEN 'Implanon retirado'
      WHEN i.applied_at IS NOT NULL THEN 'Implanon aplicado'
      ELSE 'Implanon liberado'
    END,
    COALESCE(NULLIF(i.notes, ''), COALESCE('Lote ' || i.lot, '')),
    i.status,
    i.created_at
  FROM public.implanon_records i;

GRANT SELECT ON public.patient_timeline TO authenticated;