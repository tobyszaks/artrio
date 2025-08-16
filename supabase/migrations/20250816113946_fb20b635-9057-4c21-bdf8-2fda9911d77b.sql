-- Add optional columns for larger groups to the trios table
ALTER TABLE public.trios 
ADD COLUMN user4_id UUID,
ADD COLUMN user5_id UUID;

-- Update the RLS policy to include the new user columns
DROP POLICY "Users can view their own trios" ON public.trios;

CREATE POLICY "Users can view their own trios" 
ON public.trios 
FOR SELECT 
USING (
  (auth.uid() = user1_id) OR 
  (auth.uid() = user2_id) OR 
  (auth.uid() = user3_id) OR 
  (auth.uid() = user4_id) OR 
  (auth.uid() = user5_id)
);

-- Update the posts RLS policy to include new user columns
DROP POLICY "Users can view posts in their trios" ON public.posts;

CREATE POLICY "Users can view posts in their trios" 
ON public.posts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM trios
    WHERE trios.id = posts.trio_id 
    AND (
      auth.uid() = trios.user1_id OR 
      auth.uid() = trios.user2_id OR 
      auth.uid() = trios.user3_id OR 
      auth.uid() = trios.user4_id OR 
      auth.uid() = trios.user5_id
    )
  )
);

-- Update the replies RLS policy to include new user columns
DROP POLICY "Users can view replies to posts in their trios" ON public.replies;

CREATE POLICY "Users can view replies to posts in their trios" 
ON public.replies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM posts
    JOIN trios ON posts.trio_id = trios.id
    WHERE posts.id = replies.post_id 
    AND (
      auth.uid() = trios.user1_id OR 
      auth.uid() = trios.user2_id OR 
      auth.uid() = trios.user3_id OR 
      auth.uid() = trios.user4_id OR 
      auth.uid() = trios.user5_id
    )
  )
);

-- Update profiles RLS policy to include new user columns
DROP POLICY "Users can view trio members' profiles only" ON public.profiles;

CREATE POLICY "Users can view trio members' profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1
    FROM trios
    WHERE trios.date = CURRENT_DATE 
    AND (
      (trios.user1_id = auth.uid() AND (
        trios.user2_id = profiles.user_id OR 
        trios.user3_id = profiles.user_id OR 
        trios.user4_id = profiles.user_id OR 
        trios.user5_id = profiles.user_id
      )) OR
      (trios.user2_id = auth.uid() AND (
        trios.user1_id = profiles.user_id OR 
        trios.user3_id = profiles.user_id OR 
        trios.user4_id = profiles.user_id OR 
        trios.user5_id = profiles.user_id
      )) OR
      (trios.user3_id = auth.uid() AND (
        trios.user1_id = profiles.user_id OR 
        trios.user2_id = profiles.user_id OR 
        trios.user4_id = profiles.user_id OR 
        trios.user5_id = profiles.user_id
      )) OR
      (trios.user4_id = auth.uid() AND (
        trios.user1_id = profiles.user_id OR 
        trios.user2_id = profiles.user_id OR 
        trios.user3_id = profiles.user_id OR 
        trios.user5_id = profiles.user_id
      )) OR
      (trios.user5_id = auth.uid() AND (
        trios.user1_id = profiles.user_id OR 
        trios.user2_id = profiles.user_id OR 
        trios.user3_id = profiles.user_id OR 
        trios.user4_id = profiles.user_id
      ))
    )
  ))
);

-- Update safe_profiles RLS policy to include new user columns
DROP POLICY "Users can view safe profiles of trio members" ON public.safe_profiles;

CREATE POLICY "Users can view safe profiles of trio members" 
ON public.safe_profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1
    FROM trios
    WHERE trios.date = CURRENT_DATE 
    AND (
      (trios.user1_id = auth.uid() AND (
        trios.user2_id = safe_profiles.user_id OR 
        trios.user3_id = safe_profiles.user_id OR 
        trios.user4_id = safe_profiles.user_id OR 
        trios.user5_id = safe_profiles.user_id
      )) OR
      (trios.user2_id = auth.uid() AND (
        trios.user1_id = safe_profiles.user_id OR 
        trios.user3_id = safe_profiles.user_id OR 
        trios.user4_id = safe_profiles.user_id OR 
        trios.user5_id = safe_profiles.user_id
      )) OR
      (trios.user3_id = auth.uid() AND (
        trios.user1_id = safe_profiles.user_id OR 
        trios.user2_id = safe_profiles.user_id OR 
        trios.user4_id = safe_profiles.user_id OR 
        trios.user5_id = safe_profiles.user_id
      )) OR
      (trios.user4_id = auth.uid() AND (
        trios.user1_id = safe_profiles.user_id OR 
        trios.user2_id = safe_profiles.user_id OR 
        trios.user3_id = safe_profiles.user_id OR 
        trios.user5_id = safe_profiles.user_id
      )) OR
      (trios.user5_id = auth.uid() AND (
        trios.user1_id = safe_profiles.user_id OR 
        trios.user2_id = safe_profiles.user_id OR 
        trios.user3_id = safe_profiles.user_id OR 
        trios.user4_id = safe_profiles.user_id
      ))
    )
  ))
);