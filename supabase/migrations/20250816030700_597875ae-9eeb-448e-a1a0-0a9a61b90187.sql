-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.get_random_cron_time()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  random_hour INTEGER;
  random_minute INTEGER;
BEGIN
  -- Generate random hour between 7 (7 AM) and 23 (11 PM)
  random_hour := 7 + floor(random() * 17)::integer;
  
  -- Generate random minute between 0 and 59
  random_minute := floor(random() * 60)::integer;
  
  -- Return cron format: minute hour * * *
  RETURN random_minute || ' ' || random_hour || ' * * *';
END;
$$;