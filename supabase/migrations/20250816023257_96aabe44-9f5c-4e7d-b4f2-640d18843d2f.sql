-- Drop the unsafe view
DROP VIEW IF EXISTS public.safe_profiles;

-- Create a secure view with proper access control
CREATE VIEW public.safe_profiles 
WITH (security_barrier=true, security_invoker=true) AS
SELECT 
  p.id,
  p.user_id,
  p.username,
  p.avatar_url,
  -- Only show bio for users 18+ and only to trio members
  CASE 
    WHEN public.calculate_age(p.birthday) >= 18 
    AND (
      auth.uid() = p.user_id 
      OR EXISTS (
        SELECT 1 FROM public.trios 
        WHERE date = CURRENT_DATE 
        AND (
          (user1_id = auth.uid() AND (user2_id = p.user_id OR user3_id = p.user_id))
          OR 
          (user2_id = auth.uid() AND (user1_id = p.user_id OR user3_id = p.user_id))
          OR 
          (user3_id = auth.uid() AND (user1_id = p.user_id OR user2_id = p.user_id))
        )
      )
    )
    THEN p.bio
    ELSE NULL 
  END AS bio,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE 
  -- Users can see their own profile
  auth.uid() = p.user_id 
  OR 
  -- Users can see profiles of current trio members
  EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = p.user_id OR user3_id = p.user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = p.user_id OR user3_id = p.user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = p.user_id OR user2_id = p.user_id))
    )
  );