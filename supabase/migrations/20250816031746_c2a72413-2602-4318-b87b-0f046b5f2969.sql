-- Assign admin role to the existing user (you)
-- This will find your account and give you admin privileges

DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Get the first user that was created (which should be you)
    SELECT user_id INTO first_user_id 
    FROM public.profiles 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- If we found a user, assign admin role
    IF first_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (first_user_id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'Admin role assigned to user ID: %', first_user_id;
    ELSE
        RAISE NOTICE 'No users found to assign admin role';
    END IF;
END $$;