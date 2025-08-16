-- Enable pg_cron extension for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to generate random time between 7 AM and 11 PM
CREATE OR REPLACE FUNCTION public.get_random_cron_time()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Schedule the trio randomization function with randomized timing
-- This will be called multiple times per day to ensure randomization happens within the 7 AM - 11 PM window
SELECT cron.schedule(
  'randomize-trios-hourly',
  '0 7-23 * * *', -- Every hour from 7 AM to 11 PM
  $$
  select
    net.http_post(
        url:='https://wojakjbyqclydhcgtvga.supabase.co/functions/v1/randomize-trios',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvamFramJ5cWNseWRoY2d0dmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMDY1NDIsImV4cCI6MjA3MDg4MjU0Mn0.-3z7X7sGFLwUVcmluKk6bOIbRccsu-8vAbApOueUsAU"}'::jsonb,
        body:=concat('{"scheduled_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);