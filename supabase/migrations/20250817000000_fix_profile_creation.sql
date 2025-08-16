-- Fix handle_new_user function to handle split profile/sensitive data properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create profile if user has required metadata
  IF NEW.raw_user_meta_data ? 'username' AND NEW.raw_user_meta_data ? 'birthday' THEN
    -- Insert basic profile data (without birthday since it was removed)
    INSERT INTO public.profiles (user_id, username, bio, avatar_url)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'bio',
      NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url;
    
    -- Insert sensitive data separately
    INSERT INTO public.sensitive_user_data (user_id, birthday)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'birthday')::DATE
    )
    ON CONFLICT (user_id) DO UPDATE
    SET birthday = EXCLUDED.birthday;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the entire auth flow
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Also ensure the trigger exists and is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();