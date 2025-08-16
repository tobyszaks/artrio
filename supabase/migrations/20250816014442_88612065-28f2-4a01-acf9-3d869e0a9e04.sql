-- Fix security warnings by setting search_path for functions

-- Update calculate_age function with proper search path
CREATE OR REPLACE FUNCTION public.calculate_age(birth_date DATE)
RETURNS INTEGER 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$;

-- Update validate_minimum_age function with proper search path
CREATE OR REPLACE FUNCTION public.validate_minimum_age()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.calculate_age(NEW.birthday) < 15 THEN
    RAISE EXCEPTION 'User must be at least 15 years old to create an account';
  END IF;
  RETURN NEW;
END;
$$;

-- Update update_updated_at_column function with proper search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update cleanup_expired_content function with proper search path
CREATE OR REPLACE FUNCTION public.cleanup_expired_content()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.posts WHERE expires_at < now();
  DELETE FROM public.replies WHERE expires_at < now();
END;
$$;