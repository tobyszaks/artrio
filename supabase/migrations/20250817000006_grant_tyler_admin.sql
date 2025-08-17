-- Grant admin access to tyler@szakacsmedia.com
DO $$
DECLARE
  tyler_user_id UUID;
BEGIN
  -- Get Tyler's user ID
  SELECT id INTO tyler_user_id 
  FROM auth.users 
  WHERE email = 'tyler@szakacsmedia.com'
  LIMIT 1;
  
  IF tyler_user_id IS NOT NULL THEN
    -- Grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (tyler_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to tyler@szakacsmedia.com (user_id: %)', tyler_user_id;
  ELSE
    RAISE NOTICE 'User tyler@szakacsmedia.com not found. Please create the account first.';
  END IF;
END $$;

-- Also check for other Tyler emails
DO $$
DECLARE
  tyler_alt_id UUID;
BEGIN
  -- Check for alternative Tyler emails
  SELECT id INTO tyler_alt_id
  FROM auth.users 
  WHERE email IN ('tylerjszakacs@gmail.com', 'tjzaks@gmail.com')
  LIMIT 1;
  
  IF tyler_alt_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (tyler_alt_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role also granted to alternate Tyler account';
  END IF;
END $$;

-- Show all current admins
SELECT 
  u.email,
  ur.created_at as admin_since
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at;