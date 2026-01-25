-- Drop existing policies on notes table
DROP POLICY IF EXISTS "Approved users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Approved users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Premium users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Premium users can update their own notes" ON public.notes;

-- Create new policies that only allow admin access
CREATE POLICY "Only admins can create notes" 
ON public.notes 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can view their own notes" 
ON public.notes 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can update their own notes" 
ON public.notes 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can delete their own notes" 
ON public.notes 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'admin'::app_role)
);