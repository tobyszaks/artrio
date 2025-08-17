-- Create direct messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (sender_id != recipient_id)
);

-- Create conversations view for easier querying
CREATE OR REPLACE VIEW public.conversations AS
SELECT DISTINCT
  CASE 
    WHEN dm.sender_id = auth.uid() THEN dm.recipient_id
    ELSE dm.sender_id
  END as other_user_id,
  MAX(dm.created_at) as last_message_at,
  COUNT(CASE WHEN dm.recipient_id = auth.uid() AND NOT dm.is_read THEN 1 END) as unread_count
FROM public.direct_messages dm
WHERE dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid()
GROUP BY 
  CASE 
    WHEN dm.sender_id = auth.uid() THEN dm.recipient_id
    ELSE dm.sender_id
  END;

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- DM Policies
CREATE POLICY "Users can view their own DMs" ON public.direct_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send DMs" ON public.direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    -- Can only DM someone who was in a trio with you
    EXISTS (
      SELECT 1 FROM public.trios t
      WHERE (
        (t.user1_id = auth.uid() OR t.user2_id = auth.uid() OR t.user3_id = auth.uid() OR t.user4_id = auth.uid() OR t.user5_id = auth.uid())
        AND
        (t.user1_id = recipient_id OR t.user2_id = recipient_id OR t.user3_id = recipient_id OR t.user4_id = recipient_id OR t.user5_id = recipient_id)
      )
    )
  );

CREATE POLICY "Users can update read status of received DMs" ON public.direct_messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(sender_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.direct_messages
  SET is_read = true
  WHERE sender_id = sender_user_id 
    AND recipient_id = auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updated_at
CREATE TRIGGER update_dm_updated_at BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_direct_messages_users ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_direct_messages_unread ON public.direct_messages(recipient_id, is_read) WHERE is_read = false;