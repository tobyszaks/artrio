-- Give admin privileges to accounts that might be yours
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('68d8b84f-bba7-4d57-86f5-c3f6cbc04c54', 'admin'::app_role), -- luszaks
  ('4e2428dd-3f19-4040-8d32-b006b45f4f1f', 'admin'::app_role)  -- tzaks
ON CONFLICT (user_id, role) DO NOTHING;