-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  birthday DATE NOT NULL,
  age INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthday))) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT bio_length CHECK (LENGTH(bio) <= 50),
  CONSTRAINT min_age CHECK (EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthday)) >= 15)
);

-- Create trios table for daily trio assignments
CREATE TABLE public.trios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user3_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id, user3_id, date),
  CONSTRAINT different_users CHECK (user1_id != user2_id AND user1_id != user3_id AND user2_id != user3_id)
);

-- Create posts table for daily posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trio_id UUID NOT NULL REFERENCES public.trios(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  CONSTRAINT one_post_per_user_per_day UNIQUE(user_id, trio_id)
);

-- Create replies table for replies to posts
CREATE TABLE public.replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  CONSTRAINT one_reply_per_user_per_post UNIQUE(user_id, post_id)
);

-- Create age verification attempts table
CREATE TABLE public.age_verification_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  birthday DATE NOT NULL,
  attempt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  CONSTRAINT prevent_underage_retry CHECK (EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthday)) >= 15)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Trios policies
CREATE POLICY "Users can view their own trios" ON public.trios FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id OR auth.uid() = user3_id);

-- Posts policies
CREATE POLICY "Users can view posts in their trios" ON public.posts FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.trios 
  WHERE trios.id = posts.trio_id 
  AND (auth.uid() = user1_id OR auth.uid() = user2_id OR auth.uid() = user3_id)
));
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);

-- Replies policies
CREATE POLICY "Users can view replies to posts in their trios" ON public.replies FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.posts 
  JOIN public.trios ON posts.trio_id = trios.id
  WHERE posts.id = replies.post_id 
  AND (auth.uid() = trios.user1_id OR auth.uid() = trios.user2_id OR auth.uid() = trios.user3_id)
));
CREATE POLICY "Users can insert their own replies" ON public.replies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Age verification attempts policies (public read for checking attempts)
CREATE POLICY "Anyone can view age verification attempts" ON public.age_verification_attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert age verification attempts" ON public.age_verification_attempts FOR INSERT WITH CHECK (true);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create profile if user has required metadata
  IF NEW.raw_user_meta_data ? 'username' AND NEW.raw_user_meta_data ? 'birthday' THEN
    INSERT INTO public.profiles (user_id, username, birthday, bio, avatar_url)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'username',
      (NEW.raw_user_meta_data ->> 'birthday')::DATE,
      NEW.raw_user_meta_data ->> 'bio',
      NEW.raw_user_meta_data ->> 'avatar_url'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired content
CREATE OR REPLACE FUNCTION public.cleanup_expired_content()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.posts WHERE expires_at < now();
  DELETE FROM public.replies WHERE expires_at < now();
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_trios_date ON public.trios(date);
CREATE INDEX idx_trios_users ON public.trios(user1_id, user2_id, user3_id);
CREATE INDEX idx_posts_trio_id ON public.posts(trio_id);
CREATE INDEX idx_posts_expires_at ON public.posts(expires_at);
CREATE INDEX idx_replies_post_id ON public.replies(post_id);
CREATE INDEX idx_replies_expires_at ON public.replies(expires_at);