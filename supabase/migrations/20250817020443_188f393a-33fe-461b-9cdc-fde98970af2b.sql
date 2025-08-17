-- Remove all admin roles
DELETE FROM public.user_roles WHERE role = 'admin';