-- Add policy to allow approved users to view basic profile info (for displaying creator names)
CREATE POLICY "Approved users can view all profiles display_name"
ON public.profiles
FOR SELECT
USING (
  is_user_approved(auth.uid())
);