-- Fix critical security vulnerability: Remove overly permissive profile access
-- and replace with trio-based access control

-- Drop the problematic policy that allows all authenticated users to see all profiles
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;

-- Create new secure policies for profile access
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to view profiles of their current trio members only
CREATE POLICY "Users can view trio member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() != user_id AND EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = profiles.user_id OR user3_id = profiles.user_id OR user4_id = profiles.user_id OR user5_id = profiles.user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = profiles.user_id OR user3_id = profiles.user_id OR user4_id = profiles.user_id OR user5_id = profiles.user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = profiles.user_id OR user2_id = profiles.user_id OR user4_id = profiles.user_id OR user5_id = profiles.user_id))
      OR 
      (user4_id = auth.uid() AND (user1_id = profiles.user_id OR user2_id = profiles.user_id OR user3_id = profiles.user_id OR user5_id = profiles.user_id))
      OR 
      (user5_id = auth.uid() AND (user1_id = profiles.user_id OR user2_id = profiles.user_id OR user3_id = profiles.user_id OR user4_id = profiles.user_id))
    )
  )
);

-- Keep admin access for moderation purposes (this policy already exists but let's ensure it's properly defined)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));