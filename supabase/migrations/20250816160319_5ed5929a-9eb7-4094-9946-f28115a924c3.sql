-- Drop the existing check constraint and recreate it to allow 'user' content type
ALTER TABLE public.reported_content 
DROP CONSTRAINT IF EXISTS reported_content_content_type_check;

-- Add the updated constraint that includes 'user' as a valid content type
ALTER TABLE public.reported_content 
ADD CONSTRAINT reported_content_content_type_check 
CHECK (content_type IN ('post', 'reply', 'user'));