-- Add followers count column to page_items for Instagram accounts
ALTER TABLE public.page_items 
ADD COLUMN followers_count TEXT;

-- Add column comment
COMMENT ON COLUMN public.page_items.followers_count IS 'Follower count for social media accounts like Instagram';