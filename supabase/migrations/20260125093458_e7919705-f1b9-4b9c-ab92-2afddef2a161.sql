-- Add is_starred column to page_items table
ALTER TABLE public.page_items 
ADD COLUMN is_starred boolean DEFAULT false;