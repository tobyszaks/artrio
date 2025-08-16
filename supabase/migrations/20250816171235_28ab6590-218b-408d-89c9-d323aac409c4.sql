-- Create function to check if user can post (10-minute rate limit)
CREATE OR REPLACE FUNCTION public.can_user_post(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_post_time timestamptz;
BEGIN
  -- Get the user's most recent post time
  SELECT MAX(created_at) INTO last_post_time
  FROM public.posts
  WHERE user_id = user_id_param;
  
  -- If no previous posts, user can post
  IF last_post_time IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if 10 minutes have passed since last post
  RETURN (now() - last_post_time) >= interval '10 minutes';
END;
$$;

-- Create function to get seconds until user can post again
CREATE OR REPLACE FUNCTION public.seconds_until_next_post(user_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_post_time timestamptz;
  time_diff interval;
  seconds_remaining integer;
BEGIN
  -- Get the user's most recent post time
  SELECT MAX(created_at) INTO last_post_time
  FROM public.posts
  WHERE user_id = user_id_param;
  
  -- If no previous posts, user can post immediately
  IF last_post_time IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate time difference
  time_diff := interval '10 minutes' - (now() - last_post_time);
  
  -- If time has already passed, return 0
  IF time_diff <= interval '0' THEN
    RETURN 0;
  END IF;
  
  -- Return seconds remaining
  seconds_remaining := EXTRACT(EPOCH FROM time_diff)::integer;
  RETURN seconds_remaining;
END;
$$;

-- Add RLS policy to enforce rate limiting on posts
CREATE POLICY "Users can only post if rate limit allows"
ON public.posts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND public.can_user_post(auth.uid())
);