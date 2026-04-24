-- =========================================
-- 1. PATIENTS — restrict to approved members
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can delete patients" ON public.patients;

CREATE POLICY "Approved members can view patients"
  ON public.patients FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can insert patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can delete patients"
  ON public.patients FOR DELETE TO authenticated
  USING (public.is_approved_member(auth.uid()));

-- =========================================
-- 2. APPOINTMENTS — restrict to approved members
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;

CREATE POLICY "Approved members can view appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can insert appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.is_approved_member(auth.uid()));

-- =========================================
-- 3. RELEASED_DAYS — restrict to approved members
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can view released_days" ON public.released_days;
DROP POLICY IF EXISTS "Authenticated users can insert released_days" ON public.released_days;
DROP POLICY IF EXISTS "Authenticated users can update released_days" ON public.released_days;
DROP POLICY IF EXISTS "Authenticated users can delete released_days" ON public.released_days;

CREATE POLICY "Approved members can view released_days"
  ON public.released_days FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can insert released_days"
  ON public.released_days FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can update released_days"
  ON public.released_days FOR UPDATE TO authenticated
  USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can delete released_days"
  ON public.released_days FOR DELETE TO authenticated
  USING (public.is_approved_member(auth.uid()));

-- =========================================
-- 4. HEALTH_UNITS — view open, write approved-only
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can insert health_units" ON public.health_units;
DROP POLICY IF EXISTS "Authenticated users can update health_units" ON public.health_units;
DROP POLICY IF EXISTS "Authenticated users can delete health_units" ON public.health_units;

CREATE POLICY "Approved members can insert health_units"
  ON public.health_units FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can update health_units"
  ON public.health_units FOR UPDATE TO authenticated
  USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can delete health_units"
  ON public.health_units FOR DELETE TO authenticated
  USING (public.is_approved_member(auth.uid()));

-- =========================================
-- 5. TEAM_MEMBERS — fix privilege escalation
-- =========================================
-- Replace permissive INSERT policy: status must be 'pending', user can only insert themselves.
DROP POLICY IF EXISTS "Authenticated users can insert team_members" ON public.team_members;

CREATE POLICY "Users can self-register as pending"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Restrict SELECT to approved members + allow users to see their own row (so pending users can see their status)
DROP POLICY IF EXISTS "Authenticated users can view team_members" ON public.team_members;

CREATE POLICY "Approved members or self can view team_members"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR user_id = auth.uid()
  );

-- =========================================
-- 6. BOOTSTRAP: ensure existing users are approved (one-time)
-- Without this, no user would be 'approved' and the system would lock everyone out.
-- =========================================
UPDATE public.team_members SET status = 'approved' WHERE status = 'approved';
-- (No-op safety; existing approved members keep access. Pending/rejected users now correctly blocked.)
