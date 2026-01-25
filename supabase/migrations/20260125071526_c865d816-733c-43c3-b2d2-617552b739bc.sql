-- Create page_items table for storing items within dynamic pages
CREATE TABLE public.page_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  category TEXT DEFAULT '一般',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.page_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage all page items
CREATE POLICY "Admins can manage all page items"
ON public.page_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Premium users with edit access can manage page items
CREATE POLICY "Premium users can manage page items they have access to"
ON public.page_items
FOR ALL
USING (
  is_user_approved(auth.uid()) AND 
  can_edit_page(auth.uid(), page_id)
);

-- Approved users with view access can view page items
CREATE POLICY "Users can view page items they have access to"
ON public.page_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (is_user_approved(auth.uid()) AND can_view_page(auth.uid(), page_id))
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_page_items_updated_at
BEFORE UPDATE ON public.page_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();