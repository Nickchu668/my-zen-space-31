-- Add avatar_url column to page_items for manual avatar image URLs
ALTER TABLE public.page_items
ADD COLUMN avatar_url TEXT NULL;