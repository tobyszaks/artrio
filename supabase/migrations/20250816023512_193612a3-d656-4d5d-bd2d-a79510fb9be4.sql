-- Drop the view and create a proper table with RLS
DROP VIEW IF EXISTS public.safe_profiles;

-- Create a table with proper RLS policies
CREATE TABLE public.safe_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  username text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

-- Enable RLS on the table
ALTER TABLE public.safe_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for reading safe profiles (same logic as original view)
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

-- Create a function to populate safe_profiles from profiles table
CREATE OR REPLACE FUNCTION public.populate_safe_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear existing data
  DELETE FROM public.safe_profiles;
  
  -- Insert data from profiles with privacy controls
  INSERT INTO public.safe_profiles (id, user_id, username, avatar_url, bio, created_at, updated_at)
  SELECT 
    p.id,
    p.user_id,
    p.username,
    p.avatar_url,
    -- Only include bio for users 18+, otherwise NULL
    CASE 
      WHEN public.calculate_age(p.birthday) >= 18 THEN p.bio
      ELSE NULL 
    END AS bio,
    p.created_at,
    p.updated_at
  FROM public.profiles p;
END;
$$;

-- Populate the table initially
SELECT public.populate_safe_profiles();

-- Create trigger to keep safe_profiles in sync with profiles
CREATE OR REPLACE FUNCTION public.sync_safe_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.safe_profiles (id, user_id, username, avatar_url, bio, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.user_id,
      NEW.username,
      NEW.avatar_url,
      CASE 
        WHEN public.calculate_age(NEW.birthday) >= 18 THEN NEW.bio
        ELSE NULL 
      END,
      NEW.created_at,
      NEW.updated_at
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.safe_profiles 
    SET 
      username = NEW.username,
      avatar_url = NEW.avatar_url,
      bio = CASE 
        WHEN public.calculate_age(NEW.birthday) >= 18 THEN NEW.bio
        ELSE NULL 
      END,
      updated_at = NEW.updated_at
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.safe_profiles WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER sync_safe_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_safe_profiles();