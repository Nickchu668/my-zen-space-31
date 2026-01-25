-- Update can_view_page function to allow all approved users to view member-submit pages
CREATE OR REPLACE FUNCTION public.can_view_page(_user_id uuid, _page_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    -- Admins can always view
    WHEN has_role(_user_id, 'admin'::app_role) THEN true
    -- Check if user is approved first
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND is_approved = true) THEN false
    -- Allow all approved users to view member-submit pages (會員分享簿)
    WHEN EXISTS (SELECT 1 FROM public.pages WHERE id = _page_id AND allow_member_submit = true AND is_active = true) THEN true
    -- Check specific page access for other pages
    ELSE EXISTS (
      SELECT 1 FROM public.user_page_access
      WHERE user_id = _user_id 
        AND page_id = _page_id 
        AND can_view = true
    )
  END
$$;