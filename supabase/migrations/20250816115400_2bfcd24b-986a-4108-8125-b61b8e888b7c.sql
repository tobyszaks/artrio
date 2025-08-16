-- Create reported content table
CREATE TABLE public.reported_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reply', 'profile')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Create moderation actions table
CREATE TABLE public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'temporary_ban', 'permanent_ban', 'content_removal')),
  reason TEXT NOT NULL,
  duration_hours INTEGER, -- For temporary bans
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create system logs table for admin activities
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reported_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reported_content
CREATE POLICY "Users can report content" 
ON public.reported_content 
FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" 
ON public.reported_content 
FOR SELECT 
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" 
ON public.reported_content 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for moderation_actions
CREATE POLICY "Admins can manage moderation actions" 
ON public.moderation_actions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for admin_logs
CREATE POLICY "Admins can view admin logs" 
ON public.admin_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.moderation_actions 
    WHERE target_user_id = user_id 
    AND action_type IN ('temporary_ban', 'permanent_ban')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.admin_logs (admin_id, action_type, target_type, target_id, description, metadata)
  VALUES (p_admin_id, p_action_type, p_target_type, p_target_id, p_description, p_metadata)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;