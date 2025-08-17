-- Create user presence table for tracking online status
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policies for user presence
CREATE POLICY "Users can view presence of trio members" ON public.user_presence
  FOR SELECT USING (
    -- Can see presence of users in your trios
    EXISTS (
      SELECT 1 FROM public.trios t
      WHERE (
        -- You are in this trio
        (t.user1_id = auth.uid() OR t.user2_id = auth.uid() OR t.user3_id = auth.uid() OR t.user4_id = auth.uid() OR t.user5_id = auth.uid())
        AND
        -- The user whose presence we're checking is also in this trio
        (t.user1_id = user_id OR t.user2_id = user_id OR t.user3_id = user_id OR t.user4_id = user_id OR t.user5_id = user_id)
      )
    )
    -- Or viewing your own presence
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can update their own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence status" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_is_online BOOLEAN DEFAULT true
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_presence (user_id, is_online, last_seen)
  VALUES (auth.uid(), p_is_online, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark users as offline after inactivity (5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_presence()
RETURNS void AS $$
BEGIN
  UPDATE public.user_presence
  SET is_online = false
  WHERE is_online = true
    AND last_seen < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX idx_user_presence_online ON public.user_presence(is_online, last_seen) WHERE is_online = true;
CREATE INDEX idx_user_presence_user ON public.user_presence(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_presence_updated_at BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();