-- Create resources table
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  category TEXT DEFAULT '一般',
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Approved users can view all resources
CREATE POLICY "Approved users can view resources"
ON public.resources FOR SELECT
USING (is_user_approved(auth.uid()));

-- Approved users can create resources
CREATE POLICY "Approved users can create resources"
ON public.resources FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_user_approved(auth.uid()));

-- Premium/Admin can update resources
CREATE POLICY "Premium users can update resources"
ON public.resources FOR UPDATE
USING (
  auth.uid() = user_id 
  AND is_user_approved(auth.uid()) 
  AND (has_role(auth.uid(), 'premium'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Premium/Admin can delete resources
CREATE POLICY "Premium users can delete resources"
ON public.resources FOR DELETE
USING (
  auth.uid() = user_id 
  AND is_user_approved(auth.uid()) 
  AND (has_role(auth.uid(), 'premium'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Trigger for updated_at
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();