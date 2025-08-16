-- Create user_blocks table for blocking functionality
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own blocks
CREATE POLICY "Users can view their own blocks" 
ON public.user_blocks 
FOR SELECT 
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create their own blocks" 
ON public.user_blocks 
FOR INSERT 
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks" 
ON public.user_blocks 
FOR DELETE 
USING (auth.uid() = blocker_id);