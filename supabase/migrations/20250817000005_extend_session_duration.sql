-- Note: Session duration is controlled in Supabase Dashboard settings
-- Go to: Authentication > Settings > JWT Settings
-- 
-- Recommended settings for persistent login:
-- - JWT expiry limit: 2592000 (30 days)
-- - Database session duration: 2592000 (30 days)
-- 
-- To apply these settings:
-- 1. Go to: https://supabase.com/dashboard/project/nqwijkvpzyadpsegvgbm/settings/auth
-- 2. Under "JWT Settings", set:
--    - JWT expiry limit: 2592000
-- 3. Under "Session Settings", enable:
--    - "Refresh token rotation" (for security)
--    - Set refresh token reuse interval to 10 seconds
-- 
-- This allows users to stay logged in for up to 30 days
-- The session will automatically refresh as long as they're active

-- Create a function to check session validity
CREATE OR REPLACE FUNCTION public.is_session_valid()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_session_valid() TO authenticated;