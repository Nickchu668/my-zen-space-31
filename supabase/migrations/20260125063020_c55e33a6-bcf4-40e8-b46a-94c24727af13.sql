-- Add is_approved column to profiles for registration approval
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Create user_page_access table for per-page authorization
CREATE TABLE public.user_page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id uuid REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  granted_by uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_id)
);

-- Enable RLS on user_page_access
ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access permissions
CREATE POLICY "Users can view their own page access"
ON public.user_page_access
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all page access
CREATE POLICY "Admins can manage all page access"
ON public.user_page_access
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to check if user can view a specific page
CREATE OR REPLACE FUNCTION public.can_view_page(_user_id uuid, _page_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins can always view
  SELECT CASE 
    WHEN has_role(_user_id, 'admin'::app_role) THEN true
    -- Check if user is approved first
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND is_approved = true) THEN false
    -- Check specific page access
    ELSE EXISTS (
      SELECT 1 FROM public.user_page_access
      WHERE user_id = _user_id 
        AND page_id = _page_id 
        AND can_view = true
    )
  END
$$;

-- Create function to check if user can edit a specific page
CREATE OR REPLACE FUNCTION public.can_edit_page(_user_id uuid, _page_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins can always edit
  SELECT CASE 
    WHEN has_role(_user_id, 'admin'::app_role) THEN true
    -- Check if user is approved and is premium
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND is_approved = true) THEN false
    WHEN NOT has_role(_user_id, 'premium'::app_role) THEN false
    -- Check specific page edit access
    ELSE EXISTS (
      SELECT 1 FROM public.user_page_access
      WHERE user_id = _user_id 
        AND page_id = _page_id 
        AND can_edit = true
    )
  END
$$;

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Update pages RLS policy to use new access control
DROP POLICY IF EXISTS "Authenticated users can view active pages they have access to" ON public.pages;

CREATE POLICY "Users can view pages they have access to"
ON public.pages
FOR SELECT
USING (
  is_active = true AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    can_view_page(auth.uid(), id)
  )
);

-- Update notes table RLS to require approval
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

CREATE POLICY "Approved users can view their own notes"
ON public.notes FOR SELECT
USING (auth.uid() = user_id AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can create their own notes"
ON public.notes FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_user_approved(auth.uid()));

CREATE POLICY "Premium users can update their own notes"
ON public.notes FOR UPDATE
USING (
  auth.uid() = user_id AND 
  is_user_approved(auth.uid()) AND
  (has_role(auth.uid(), 'premium'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Premium users can delete their own notes"
ON public.notes FOR DELETE
USING (
  auth.uid() = user_id AND 
  is_user_approved(auth.uid()) AND
  (has_role(auth.uid(), 'premium'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);