-- Helper: check if a user is approved in team_members
CREATE OR REPLACE FUNCTION public.is_approved_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND status = 'approved'
  );
$$;

-- Replace permissive UPDATE/DELETE on team_members with approved-only policies
DROP POLICY IF EXISTS "Authenticated users can update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users can delete team_members" ON public.team_members;

CREATE POLICY "Approved members can update team_members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members can delete team_members"
ON public.team_members
FOR DELETE
TO authenticated
USING (public.is_approved_member(auth.uid()) AND user_id <> auth.uid());

-- Performance indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_sus_card ON public.patients(sus_card);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);