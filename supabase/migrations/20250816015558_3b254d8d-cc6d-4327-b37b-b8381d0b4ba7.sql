-- Fix critical security vulnerability: Restrict profile access and protect minors' data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create secure policies that only allow trio members to see each other's profiles
CREATE POLICY "Users can view trio members' profiles only" ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles of people in their current trio
  EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = profiles.user_id OR user3_id = profiles.user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = profiles.user_id OR user3_id = profiles.user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = profiles.user_id OR user2_id = profiles.user_id))
    )
  )
);

-- Create a security definer function for safe age verification without exposing birthdates
CREATE OR REPLACE FUNCTION public.get_user_age_range(profile_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_age INTEGER;
BEGIN
  -- Only return age range if the requesting user is in the same trio
  IF NOT EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = profile_user_id OR user3_id = profile_user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = profile_user_id OR user3_id = profile_user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = profile_user_id OR user2_id = profile_user_id))
      OR 
      auth.uid() = profile_user_id
    )
  ) THEN
    RETURN NULL;
  END IF;

  SELECT public.calculate_age(birthday) INTO user_age
  FROM public.profiles 
  WHERE user_id = profile_user_id;

  -- Return age ranges instead of exact ages for privacy
  IF user_age IS NULL THEN
    RETURN NULL;
  ELSIF user_age >= 15 AND user_age <= 17 THEN
    RETURN '15-17';
  ELSIF user_age >= 18 AND user_age <= 21 THEN
    RETURN '18-21';
  ELSIF user_age >= 22 AND user_age <= 25 THEN
    RETURN '22-25';
  ELSIF user_age >= 26 THEN
    RETURN '26+';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Create a view that exposes only safe profile data
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  p.id,
  p.user_id,
  p.username,
  -- Only show bio if user is 18+ or if it's the user's own profile
  CASE 
    WHEN p.user_id = auth.uid() THEN p.bio
    WHEN public.calculate_age(p.birthday) >= 18 THEN p.bio
    ELSE NULL
  END as bio,
  p.avatar_url,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE 
  -- Same trio member restriction
  (
    auth.uid() = p.user_id 
    OR 
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
    )
  );

-- Enable RLS on the view (though it inherits table restrictions)
ALTER VIEW public.safe_profiles SET (security_invoker = true);

-- Update age verification attempts to be more private
DROP POLICY IF EXISTS "Anyone can view age verification attempts" ON public.age_verification_attempts;
DROP POLICY IF EXISTS "Anyone can insert age verification attempts" ON public.age_verification_attempts;

-- Only allow viewing your own age verification attempts
CREATE POLICY "Users can view their own age verification attempts" ON public.age_verification_attempts 
FOR SELECT 
USING (
  -- Allow checking by IP address and user agent for retry prevention
  ip_address = inet_client_addr() OR user_agent = current_setting('application_name', true)
);

CREATE POLICY "Users can insert age verification attempts" ON public.age_verification_attempts 
FOR INSERT 
WITH CHECK (true); -- Still allow insertion for age verification