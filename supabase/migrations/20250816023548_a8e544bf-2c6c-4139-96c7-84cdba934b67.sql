-- Fix search_path for security functions
CREATE OR REPLACE FUNCTION public.populate_safe_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.sync_safe_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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