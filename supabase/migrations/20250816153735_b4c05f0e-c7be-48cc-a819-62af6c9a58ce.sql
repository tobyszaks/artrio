-- Drop the restrictive trio-only profile viewing policy
DROP POLICY IF EXISTS "Users can view trio members' profiles only" ON public.profiles;

-- Create a new policy allowing all authenticated users to view all profiles
CREATE POLICY "All authenticated users can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);