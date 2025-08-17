-- Restore admin access for key accounts
-- This migration fixes the accidental removal of all admin roles

DO $$
DECLARE
  toby_user_id UUID;
  tyler_user_id UUID;
BEGIN
  -- Get Toby's user ID (tobyszakacs@icloud.com)
  SELECT id INTO toby_user_id 
  FROM auth.users 
  WHERE email = 'tobyszakacs@icloud.com'
  LIMIT 1;
  
  -- Also check for Tyler's account (if exists)
  SELECT id INTO tyler_user_id
  FROM auth.users
  WHERE email IN ('tylerjszakacs@gmail.com', 'tyler@szakacsmedia.com', 'tjzaks@gmail.com')
  LIMIT 1;
  
  -- Grant admin to Toby
  IF toby_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (toby_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to tobyszakacs@icloud.com (user_id: %)', toby_user_id;
  ELSE
    RAISE NOTICE 'User tobyszakacs@icloud.com not found - they may need to create an account first';
  END IF;
  
  -- Grant admin to Tyler if found
  IF tyler_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (tyler_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to Tyler (user_id: %)', tyler_user_id;
  END IF;
  
  -- Also restore the accounts from the previous migration that were removed
  -- These were the user IDs that Toby had granted admin to
  INSERT INTO public.user_roles (user_id, role)
  VALUES 
    ('68d8b84f-bba7-4d57-86f5-c3f6cbc04c54', 'admin'), -- luszaks account
    ('4e2428dd-3f19-4040-8d32-b006b45f4f1f', 'admin')  -- tzaks account
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Admin roles have been restored';
END $$;

-- List all current admins for verification
SELECT 
  u.email,
  u.id as user_id,
  ur.role,
  ur.created_at as admin_since
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at;