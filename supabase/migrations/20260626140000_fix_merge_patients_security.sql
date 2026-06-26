-- Fix: Remove SECURITY DEFINER from merge_patients so that Row Level Security
-- on the patients and appointments tables is correctly enforced.
-- With SECURITY INVOKER (the default), the function runs with the authenticated
-- user's permissions, meaning they can only merge patients they already have access to.
CREATE OR REPLACE FUNCTION public.merge_patients(master_id UUID, duplicate_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 1. Verify existence (also acts as implicit RLS check — if user can't see them, NOT EXISTS fires)
  IF NOT EXISTS (SELECT 1 FROM patients WHERE id = master_id) OR
     NOT EXISTS (SELECT 1 FROM patients WHERE id = duplicate_id) THEN
    RAISE EXCEPTION 'Um ou ambos os pacientes não foram encontrados ou você não tem permissão para acessá-los.';
  END IF;

  -- 2. Verify they are not the same
  IF master_id = duplicate_id THEN
    RAISE EXCEPTION 'Não é possível unificar um paciente consigo mesmo.';
  END IF;

  -- 3. Copy missing info from duplicate to master
  UPDATE patients m
  SET
    sus_card            = COALESCE(m.sus_card, d.sus_card),
    dob                 = COALESCE(m.dob, d.dob),
    psf                 = COALESCE(m.psf, d.psf),
    observations        = CASE
      WHEN m.observations IS NULL THEN d.observations
      WHEN d.observations IS NULL THEN m.observations
      WHEN m.observations = d.observations THEN m.observations
      ELSE m.observations || E'\n[Histórico Unificado] ' || d.observations
    END,
    is_pregnant         = COALESCE(m.is_pregnant, d.is_pregnant),
    dum                 = COALESCE(m.dum, d.dum),
    risk_classification = COALESCE(m.risk_classification, d.risk_classification),
    gestational_notes   = CASE
      WHEN m.gestational_notes IS NULL THEN d.gestational_notes
      WHEN d.gestational_notes IS NULL THEN m.gestational_notes
      ELSE m.gestational_notes || E'\n' || d.gestational_notes
    END
  FROM patients d
  WHERE m.id = master_id AND d.id = duplicate_id;

  -- 4. Reassign all appointments from duplicate to master
  UPDATE appointments
  SET patient_id = master_id
  WHERE patient_id = duplicate_id;

  -- 5. Delete the duplicate patient
  DELETE FROM patients
  WHERE id = duplicate_id;
END;
$$;
