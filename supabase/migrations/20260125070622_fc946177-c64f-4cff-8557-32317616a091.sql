-- Add link and category columns to pages table for default page structure
ALTER TABLE public.pages 
ADD COLUMN IF NOT EXISTS link TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '一般';