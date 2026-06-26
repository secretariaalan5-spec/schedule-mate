-- 1. Wrap all calls to `public.is_approved_member(auth.uid())` in RLS policies with subquery `(SELECT ...)`
-- This forces PostgreSQL to evaluate the function once per query (as an InitPlan) instead of once per row scanned.

-- On public.patients
DROP POLICY IF EXISTS "Approved members can view patients" ON public.patients;
DROP POLICY IF EXISTS "Approved members can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Approved members can update patients" ON public.patients;
DROP POLICY IF EXISTS "Approved members can delete patients" ON public.patients;

CREATE POLICY "Approved members can view patients"
  ON public.patients FOR SELECT TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can insert patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete patients"
  ON public.patients FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

-- On public.appointments
DROP POLICY IF EXISTS "Approved members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Approved members can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Approved members can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Approved members can delete appointments" ON public.appointments;

CREATE POLICY "Approved members can view appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can insert appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

-- On public.released_days
DROP POLICY IF EXISTS "Approved members can view released_days" ON public.released_days;
DROP POLICY IF EXISTS "Approved members can insert released_days" ON public.released_days;
DROP POLICY IF EXISTS "Approved members can update released_days" ON public.released_days;
DROP POLICY IF EXISTS "Approved members can delete released_days" ON public.released_days;

CREATE POLICY "Approved members can view released_days"
  ON public.released_days FOR SELECT TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can insert released_days"
  ON public.released_days FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update released_days"
  ON public.released_days FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete released_days"
  ON public.released_days FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

-- On public.health_units
DROP POLICY IF EXISTS "Approved members can insert health_units" ON public.health_units;
DROP POLICY IF EXISTS "Approved members can update health_units" ON public.health_units;
DROP POLICY IF EXISTS "Approved members can delete health_units" ON public.health_units;

CREATE POLICY "Approved members can insert health_units"
  ON public.health_units FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update health_units"
  ON public.health_units FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete health_units"
  ON public.health_units FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

-- On public.team_members
DROP POLICY IF EXISTS "Approved members can update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Approved members can delete team_members" ON public.team_members;
DROP POLICY IF EXISTS "Approved members or self can view team_members" ON public.team_members;

CREATE POLICY "Approved members can update team_members"
  ON public.team_members FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete team_members"
  ON public.team_members FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())) AND user_id <> auth.uid());

CREATE POLICY "Approved members or self can view team_members"
  ON public.team_members FOR SELECT TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())) OR user_id = auth.uid());

-- On public.scheduling_shifts
DROP POLICY IF EXISTS "Approved members can insert shifts" ON public.scheduling_shifts;
DROP POLICY IF EXISTS "Approved members can update shifts" ON public.scheduling_shifts;
DROP POLICY IF EXISTS "Approved members can delete shifts" ON public.scheduling_shifts;

CREATE POLICY "Approved members can insert shifts"
  ON public.scheduling_shifts FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can update shifts"
  ON public.scheduling_shifts FOR UPDATE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())))
  WITH CHECK ((SELECT public.is_approved_member(auth.uid())));

CREATE POLICY "Approved members can delete shifts"
  ON public.scheduling_shifts FOR DELETE TO authenticated
  USING ((SELECT public.is_approved_member(auth.uid())));

-- 2. Enforce Row Level Security on Database Views
-- This secures the views from unauthorized reads by unapproved users.
ALTER VIEW public.appointment_counts_by_date SET (security_invoker = true);
ALTER VIEW public.health_unit_patient_counts SET (security_invoker = true);

-- 3. Speed up PSF lookups and grouping on patients table
CREATE INDEX IF NOT EXISTS idx_patients_psf ON public.patients(psf);
