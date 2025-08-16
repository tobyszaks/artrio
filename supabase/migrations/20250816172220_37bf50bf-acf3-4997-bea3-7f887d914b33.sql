-- Create secure table for sensitive personal data
CREATE TABLE public.sensitive_user_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birthday DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sensitive data table
ALTER TABLE public.sensitive_user_data ENABLE ROW LEVEL SECURITY;

-- Only users can access their own sensitive data
CREATE POLICY "Users can view their own sensitive data" 
ON public.sensitive_user_data 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sensitive data" 
ON public.sensitive_user_data 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sensitive data" 
ON public.sensitive_user_data 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admin access for necessary functions only
CREATE POLICY "System functions can access sensitive data for trio formation" 
ON public.sensitive_user_data 
FOR SELECT 
USING (
  -- Only allow access from the randomize-trios function
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);

-- Migrate existing birthday data to secure table
INSERT INTO public.sensitive_user_data (user_id, birthday)
SELECT user_id, birthday 
FROM public.profiles 
WHERE birthday IS NOT NULL;

-- Remove birthday column from profiles table (it will be handled via function calls)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birthday;

-- Update the age calculation function to use the secure table
CREATE OR REPLACE FUNCTION public.calculate_age_secure(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  birth_date DATE;
BEGIN
  -- Only allow access to own data or from service role
  IF auth.uid() != target_user_id AND 
     current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RETURN NULL;
  END IF;
  
  SELECT birthday INTO birth_date 
  FROM public.sensitive_user_data 
  WHERE user_id = target_user_id;
  
  IF birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$;

-- Update the age range function to use secure data
CREATE OR REPLACE FUNCTION public.get_user_age_range(profile_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_age INTEGER;
BEGIN
  -- Only return age range if the requesting user is in the same trio
  IF NOT EXISTS (
    SELECT 1 FROM public.trios 
    WHERE date = CURRENT_DATE 
    AND (
      (user1_id = auth.uid() AND (user2_id = profile_user_id OR user3_id = profile_user_id OR user4_id = profile_user_id OR user5_id = profile_user_id))
      OR 
      (user2_id = auth.uid() AND (user1_id = profile_user_id OR user3_id = profile_user_id OR user4_id = profile_user_id OR user5_id = profile_user_id))
      OR 
      (user3_id = auth.uid() AND (user1_id = profile_user_id OR user2_id = profile_user_id OR user4_id = profile_user_id OR user5_id = profile_user_id))
      OR 
      (user4_id = auth.uid() AND (user1_id = profile_user_id OR user2_id = profile_user_id OR user3_id = profile_user_id OR user5_id = profile_user_id))
      OR 
      (user5_id = auth.uid() AND (user1_id = profile_user_id OR user2_id = profile_user_id OR user3_id = profile_user_id OR user4_id = profile_user_id))
      OR 
      auth.uid() = profile_user_id
    )
  ) THEN
    RETURN NULL;
  END IF;

  -- Use secure age calculation
  SELECT public.calculate_age_secure(profile_user_id) INTO user_age;

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

-- Update validation trigger to use secure data
CREATE OR REPLACE FUNCTION public.validate_minimum_age_secure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.calculate_age_secure(NEW.user_id) < 15 THEN
    RAISE EXCEPTION 'User must be at least 15 years old to create an account';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on sensitive data table
CREATE TRIGGER validate_age_trigger
  BEFORE INSERT OR UPDATE ON public.sensitive_user_data
  FOR EACH ROW EXECUTE FUNCTION public.validate_minimum_age_secure();

-- Update the handle_new_user function to work with separated data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create profile if user has required metadata
  IF NEW.raw_user_meta_data ? 'username' AND NEW.raw_user_meta_data ? 'birthday' THEN
    -- Insert basic profile data
    INSERT INTO public.profiles (user_id, username, bio, avatar_url)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'bio',
      NEW.raw_user_meta_data ->> 'avatar_url'
    );
    
    -- Insert sensitive data separately
    INSERT INTO public.sensitive_user_data (user_id, birthday)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'birthday')::DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Add trigger for timestamp updates on sensitive data
CREATE TRIGGER update_sensitive_data_updated_at
  BEFORE UPDATE ON public.sensitive_user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();