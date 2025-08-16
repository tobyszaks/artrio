-- Enable Row Level Security on safe_profiles table
ALTER TABLE public.safe_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view profiles of trio members (same as main profiles table)
CREATE POLICY "Users can view safe profiles of trio members" 
ON public.safe_profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles of current trio members
  EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = safe_profiles.user_id OR user3_id = safe_profiles.user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = safe_profiles.user_id OR user3_id = safe_profiles.user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = safe_profiles.user_id OR user2_id = safe_profiles.user_id))
    )
  )
);