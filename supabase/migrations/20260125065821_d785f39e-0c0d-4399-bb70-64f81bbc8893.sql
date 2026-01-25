-- Change content column from jsonb to text for rich text HTML storage
ALTER TABLE public.pages 
ALTER COLUMN content TYPE TEXT USING content::text;

-- Set default to empty string instead of JSON
ALTER TABLE public.pages 
ALTER COLUMN content SET DEFAULT '';