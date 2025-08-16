-- Update notification types to use 'trio' instead of 'group' terminology
-- This migration adds the new trio-based notification types while maintaining backward compatibility

-- First, add the new notification types to the check constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('group_formed', 'group_reminder', 'trio_formed', 'trio_reminder', 'system_announcement'));

-- Update the function to create trio notifications instead of group notifications
CREATE OR REPLACE FUNCTION public.create_trio_notifications(p_trio_id UUID)
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
  
  -- Create notifications for each user using the new trio terminology
  FOREACH user_id IN ARRAY user_ids
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      user_id,
      'trio_formed',
      'Your daily trio is ready!',
      'You''ve been matched with ' || (array_length(user_ids, 1) - 1) || ' other users for today. Start chatting!',
      jsonb_build_object(
        'trio_id', p_trio_id,
        'trio_size', array_length(user_ids, 1),
        'date', trio_record.date
      )
    );
  END LOOP;
END;
$$;

-- Update the trigger function to use the new trio notifications function
CREATE OR REPLACE FUNCTION public.notify_new_trio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create notifications for the new trio using updated function
  PERFORM public.create_trio_notifications(NEW.id);
  RETURN NEW;
END;
$$;

-- The trigger remains the same, but now calls the updated function
-- CREATE TRIGGER trigger_notify_new_trio already exists and will use the updated function

-- Comment: After this migration is deployed and the frontend is updated,
-- you can later create another migration to:
-- 1. Remove the old 'group_formed' and 'group_reminder' types from the constraint
-- 2. Drop the old create_group_notifications function
-- 3. Update any existing notifications to use the new types if needed