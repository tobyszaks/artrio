-- Assign admin role to the current user (you as the developer)
-- Note: You'll need to replace this with your actual user ID after you sign up
-- For now, let's create a function to easily assign admin role to the first user who signs up

CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user (no existing profiles)
  IF NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN
    -- Assign admin role to the first user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin'::app_role);
  ELSE
    -- Assign regular user role to subsequent users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'user'::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign roles when a profile is created
CREATE TRIGGER assign_user_role_on_profile_creation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_user_as_admin();