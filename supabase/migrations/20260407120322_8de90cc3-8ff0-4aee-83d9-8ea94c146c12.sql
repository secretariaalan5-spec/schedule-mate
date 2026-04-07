
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team_members"
ON public.team_members FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert team_members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update team_members"
ON public.team_members FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete team_members"
ON public.team_members FOR DELETE TO authenticated
USING (true);

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
