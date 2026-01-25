-- Add allow_member_submit column to pages table
ALTER TABLE public.pages 
ADD COLUMN allow_member_submit boolean DEFAULT false;

-- Update the public-notebook page to allow member submissions
UPDATE public.pages 
SET allow_member_submit = true 
WHERE slug = 'public-notebook';

-- Drop existing page_items policies to recreate them
DROP POLICY IF EXISTS "Admins can manage all page items" ON public.page_items;
DROP POLICY IF EXISTS "Premium users can manage page items they have access to" ON public.page_items;
DROP POLICY IF EXISTS "Users can view page items they have access to" ON public.page_items;

-- Create new RLS policies for page_items

-- Admins can do everything
CREATE POLICY "Admins can manage all page items"
ON public.page_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view items on pages they have access to
CREATE POLICY "Users can view page items"
ON public.page_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (is_user_approved(auth.uid()) AND can_view_page(auth.uid(), page_id))
);

-- Approved users can insert items on pages that allow member submissions
CREATE POLICY "Approved users can insert on member-submit pages"
ON public.page_items
FOR INSERT
WITH CHECK (
  is_user_approved(auth.uid()) 
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR can_edit_page(auth.uid(), page_id)
    OR EXISTS (
      SELECT 1 FROM public.pages 
      WHERE id = page_id 
      AND allow_member_submit = true
      AND is_active = true
    )
  )
  AND created_by = auth.uid()
);

-- Users can update their own items (or admins/editors can update any)
CREATE POLICY "Users can update own items or editors can update all"
ON public.page_items
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_edit_page(auth.uid(), page_id)
  OR (is_user_approved(auth.uid()) AND created_by = auth.uid())
);

-- Users can delete their own items (or admins/editors can delete any)
CREATE POLICY "Users can delete own items or editors can delete all"
ON public.page_items
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_edit_page(auth.uid(), page_id)
  OR (is_user_approved(auth.uid()) AND created_by = auth.uid())
);