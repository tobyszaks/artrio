-- Complete Artrio Database Setup
-- Run this in your Supabase SQL Editor to set up the entire schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- 1. PROFILES TABLE (without birthday - that goes in sensitive_user_data)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT bio_length CHECK (LENGTH(bio) <= 50)
);

-- 2. SENSITIVE USER DATA TABLE (for birthday and other PII)
CREATE TABLE IF NOT EXISTS public.sensitive_user_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birthday DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. TRIOS TABLE
CREATE TABLE IF NOT EXISTS public.trios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user3_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user4_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user5_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, user1_id),
  UNIQUE(date, user2_id),
  UNIQUE(date, user3_id),
  CONSTRAINT different_users CHECK (
    user1_id != user2_id AND 
    user1_id != user3_id AND 
    user2_id != user3_id AND
    (user4_id IS NULL OR (user4_id != user1_id AND user4_id != user2_id AND user4_id != user3_id)) AND
    (user5_id IS NULL OR (user5_id != user1_id AND user5_id != user2_id AND user5_id != user3_id AND user5_id != user4_id))
  )
);

-- 4. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trio_id UUID NOT NULL REFERENCES public.trios(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- 5. REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 8. AGE VERIFICATION ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.age_verification_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  birthday DATE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. REPORTED CONTENT TABLE
CREATE TABLE IF NOT EXISTS public.reported_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. MODERATION ACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  duration_hours INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. ADMIN LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. USER BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- 13. SAFE PROFILES VIEW (public profile data without sensitive info)
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  id,
  user_id,
  username,
  bio,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- FUNCTIONS

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate age function
CREATE OR REPLACE FUNCTION public.calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$ LANGUAGE plpgsql STABLE;

-- Secure age calculation
CREATE OR REPLACE FUNCTION public.calculate_age_secure(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  birth_date DATE;
BEGIN
  -- Only allow access to own data or from service role
  IF auth.uid() != target_user_id AND 
     current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RETURN NULL;
  END IF;
  
  SELECT birthday INTO birth_date 
  FROM public.sensitive_user_data 
  WHERE user_id = target_user_id;
  
  IF birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$;

-- Check if user can post (rate limiting)
CREATE OR REPLACE FUNCTION public.can_user_post(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_post_time TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT created_at INTO last_post_time
  FROM public.posts
  WHERE user_id = user_id_param
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF last_post_time IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN (EXTRACT(EPOCH FROM (now() - last_post_time)) / 60) >= 10;
END;
$$ LANGUAGE plpgsql;

-- Seconds until next post
CREATE OR REPLACE FUNCTION public.seconds_until_next_post(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  last_post_time TIMESTAMP WITH TIME ZONE;
  seconds_passed INTEGER;
  seconds_required INTEGER := 600; -- 10 minutes
BEGIN
  SELECT created_at INTO last_post_time
  FROM public.posts
  WHERE user_id = user_id_param
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF last_post_time IS NULL THEN
    RETURN 0;
  END IF;
  
  seconds_passed := EXTRACT(EPOCH FROM (now() - last_post_time))::INTEGER;
  
  IF seconds_passed >= seconds_required THEN
    RETURN 0;
  ELSE
    RETURN seconds_required - seconds_passed;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role app_role) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create profile if user has required metadata
  IF NEW.raw_user_meta_data ? 'username' AND NEW.raw_user_meta_data ? 'birthday' THEN
    -- Insert basic profile data (without birthday)
    INSERT INTO public.profiles (user_id, username, bio, avatar_url)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'bio',
      NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url;
    
    -- Insert sensitive data separately
    INSERT INTO public.sensitive_user_data (user_id, birthday)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'birthday')::DATE
    )
    ON CONFLICT (user_id) DO UPDATE
    SET birthday = EXCLUDED.birthday;
    
    -- Give user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the entire auth flow
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- TRIGGERS

-- Update timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sensitive_data_updated_at BEFORE UPDATE ON public.sensitive_user_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ROW LEVEL SECURITY

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reported_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SENSITIVE DATA POLICIES
CREATE POLICY "Users can view own sensitive data" ON public.sensitive_user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sensitive data" ON public.sensitive_user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sensitive data" ON public.sensitive_user_data
  FOR UPDATE USING (auth.uid() = user_id);

-- TRIOS POLICIES
CREATE POLICY "Users can view their trios" ON public.trios
  FOR SELECT USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id OR 
    auth.uid() = user3_id OR
    auth.uid() = user4_id OR
    auth.uid() = user5_id
  );

-- POSTS POLICIES
CREATE POLICY "Trio members can view posts" ON public.posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trios
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

CREATE POLICY "Users can create posts with rate limit" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    public.can_user_post(auth.uid())
  );

-- REPLIES POLICIES
CREATE POLICY "Trio members can view replies" ON public.replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.posts
      JOIN public.trios ON posts.trio_id = trios.id
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

CREATE POLICY "Users can create replies" ON public.replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- USER ROLES POLICIES
CREATE POLICY "Users can view all roles" ON public.user_roles
  FOR SELECT USING (true);

-- STORAGE BUCKETS (Run these in Storage section of Supabase)
-- You'll need to create these buckets manually in the Supabase dashboard:
-- 1. avatars (public)
-- 2. post-media (public)

-- INITIAL ADMIN USER
-- After setting up, run this to make yourself admin (replace YOUR_USER_ID):
-- INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR_USER_ID', 'admin');

-- Success message
SELECT 'Database setup complete! 🎉' as message;