-- Enable realtime for trios table
ALTER TABLE public.trios REPLICA IDENTITY FULL;

-- Add trios to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trios;

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('group_formed', 'group_reminder', 'system_announcement')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create group notifications
CREATE OR REPLACE FUNCTION public.create_group_notifications(p_trio_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  trio_record RECORD;
  user_ids UUID[];
  user_id UUID;
BEGIN
  -- Get trio details
  SELECT * INTO trio_record FROM public.trios WHERE id = p_trio_id;
  
  IF trio_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Collect all user IDs in the trio
  user_ids := ARRAY[trio_record.user1_id, trio_record.user2_id, trio_record.user3_id];
  
  -- Add user4_id and user5_id if they exist
  IF trio_record.user4_id IS NOT NULL THEN
    user_ids := user_ids || trio_record.user4_id;
  END IF;
  
  IF trio_record.user5_id IS NOT NULL THEN
    user_ids := user_ids || trio_record.user5_id;
  END IF;
  
  -- Create notifications for each user
  FOREACH user_id IN ARRAY user_ids
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      user_id,
      'group_formed',
      'Your daily group is ready!',
      'You''ve been matched with ' || (array_length(user_ids, 1) - 1) || ' other users for today. Start chatting!',
      jsonb_build_object(
        'trio_id', p_trio_id,
        'group_size', array_length(user_ids, 1),
        'date', trio_record.date
      )
    );
  END LOOP;
END;
$$;

-- Trigger to automatically create notifications when trios are inserted
CREATE OR REPLACE FUNCTION public.notify_new_trio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create notifications for the new trio
  PERFORM public.create_group_notifications(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_trio
  AFTER INSERT ON public.trios
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_trio();