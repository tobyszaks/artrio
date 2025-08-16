-- Create media storage bucket for posts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media', 
  'post-media', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Storage policies for post media
CREATE POLICY "Users can upload their own media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'post-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view media in their groups" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'post-media' AND (
    -- Allow users to see their own uploads
    auth.uid()::text = (storage.foldername(name))[1] OR
    -- Allow group members to see each other's media
    EXISTS (
      SELECT 1 FROM public.trios t
      WHERE t.date = CURRENT_DATE
      AND (
        (t.user1_id = auth.uid() AND (storage.foldername(name))[1] IN (t.user2_id::text, t.user3_id::text, t.user4_id::text, t.user5_id::text)) OR
        (t.user2_id = auth.uid() AND (storage.foldername(name))[1] IN (t.user1_id::text, t.user3_id::text, t.user4_id::text, t.user5_id::text)) OR
        (t.user3_id = auth.uid() AND (storage.foldername(name))[1] IN (t.user1_id::text, t.user2_id::text, t.user4_id::text, t.user5_id::text)) OR
        (t.user4_id = auth.uid() AND (storage.foldername(name))[1] IN (t.user1_id::text, t.user2_id::text, t.user3_id::text, t.user5_id::text)) OR
        (t.user5_id = auth.uid() AND (storage.foldername(name))[1] IN (t.user1_id::text, t.user2_id::text, t.user3_id::text, t.user4_id::text))
      )
    )
  )
);

CREATE POLICY "Users can update their own media" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'post-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own media" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'post-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);