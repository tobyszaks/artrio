import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Send, Users, Settings, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

interface Trio {
  id: string;
  date: string;
  user1_id: string;
  user2_id: string;
  user3_id: string;
  profiles: Profile[];
}

interface Post {
  id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  user_id: string;
  profiles: Profile;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  profiles: Profile;
}

const Home = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentTrio, setCurrentTrio] = useState<Trio | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newPost, setNewPost] = useState('');
  const [newReply, setNewReply] = useState('');
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTodaysTrio();
    }
  }, [user]);

  const fetchTodaysTrio = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's trio - simplified query
      const { data: trio, error: trioError } = await supabase
        .from('trios')
        .select('*')
        .eq('date', today)
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id},user3_id.eq.${user?.id}`)
        .single();

      if (trioError && trioError.code !== 'PGRST116') {
        console.error('Error fetching trio:', trioError);
        return;
      }

      if (trio) {
        // Fetch profiles for trio members
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, username, bio, avatar_url')
          .in('user_id', [trio.user1_id, trio.user2_id, trio.user3_id]);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          return;
        }

        setCurrentTrio({ ...trio, profiles: profiles || [] });
        
        // Fetch posts for this trio
        await fetchTrioPosts(trio.id);
      } else {
        // No trio for today - this would typically be handled by a daily cron job
        toast({
          title: 'No trio today',
          description: 'Check back later for your daily trio!'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load today\'s trio',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTrioPosts = async (trioId: string) => {
    try {
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('trio_id', trioId)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return;
      }

      if (postsData) {
        // Fetch profiles for post authors
        const userIds = [...new Set(postsData.map(post => post.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url, user_id')
          .in('user_id', userIds);

        const postsWithProfiles = postsData.map(post => ({
          ...post,
          profiles: profiles?.find(p => p.user_id === post.user_id) || {
            id: '',
            user_id: '',
            username: 'Unknown',
            bio: null,
            avatar_url: null
          }
        }));

        setPosts(postsWithProfiles);
      }
      
      // Check if current user has posted today
      const userPost = postsData?.find(post => post.user_id === user?.id);
      setHasPostedToday(!!userPost);

      // Fetch replies for all posts
      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(post => post.id);
        const { data: repliesData, error: repliesError } = await supabase
          .from('replies')
          .select('*')
          .in('post_id', postIds)
          .order('created_at', { ascending: true });

        if (!repliesError && repliesData) {
          // Fetch profiles for reply authors
          const replyUserIds = [...new Set(repliesData.map(reply => reply.user_id))];
          const { data: replyProfiles } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url, user_id')
            .in('user_id', replyUserIds);

          const repliesWithProfiles = repliesData.map(reply => ({
            ...reply,
            profiles: replyProfiles?.find(p => p.user_id === reply.user_id) || {
              id: '',
              user_id: '',
              username: 'Unknown',
              bio: null,
              avatar_url: null
            }
          }));

          setReplies(repliesWithProfiles);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handlePostSubmit = async () => {
    if (!newPost.trim() || !currentTrio || hasPostedToday) return;

    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id,
          trio_id: currentTrio.id,
          content: newPost.trim()
        });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      setNewPost('');
      setHasPostedToday(true);
      toast({
        title: 'Post sent!',
        description: 'Your post has been shared with your trio'
      });
      
      // Refresh posts
      await fetchTrioPosts(currentTrio.id);
    } catch (error) {
      console.error('Error posting:', error);
      toast({
        title: 'Error',
        description: 'Failed to send post',
        variant: 'destructive'
      });
    }
  };

  const handleReplySubmit = async (postId: string) => {
    if (!newReply.trim()) return;

    try {
      const { error } = await supabase
        .from('replies')
        .insert({
          user_id: user?.id,
          post_id: postId,
          content: newReply.trim()
        });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      setNewReply('');
      toast({
        title: 'Reply sent!',
        description: 'Your reply has been posted'
      });
      
      // Refresh posts and replies
      if (currentTrio) {
        await fetchTrioPosts(currentTrio.id);
      }
    } catch (error) {
      console.error('Error replying:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive'
      });
    }
  };

  const getTimeUntilNextTrio = () => {
    return 'Daily between 7 AM - 11 PM';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading your trio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Random Trios</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              <Settings className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {currentTrio ? (
          <>
            {/* Trio Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Today's Trio
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your randomized group for today - share, chat, and connect!
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 justify-center">
                  {currentTrio.profiles.map((profile) => (
                    <div key={profile.id} className="flex flex-col items-center gap-2">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className="font-medium text-sm">{profile.username}</p>
                        {profile.bio && (
                          <p className="text-xs text-muted-foreground">{profile.bio}</p>
                        )}
                      </div>
                      {profile.user_id === user?.id && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Post Box */}
            <Card>
              <CardHeader>
                <CardTitle>Share with your trio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="What's on your mind today?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  disabled={hasPostedToday}
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={handlePostSubmit}
                  disabled={!newPost.trim() || hasPostedToday}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {hasPostedToday ? 'Already posted today' : 'Send Post'}
                </Button>
                {hasPostedToday && (
                  <p className="text-sm text-muted-foreground">
                    You can post once per day. Check back tomorrow for a new trio!
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Posts and Replies */}
            <div className="space-y-4">
              {posts.map((post) => {
                const postReplies = replies.filter(reply => reply.post_id === post.id);
                const userHasReplied = postReplies.some(reply => reply.user_id === user?.id);
                
                return (
                  <Card key={post.id}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={post.profiles.avatar_url || undefined} />
                          <AvatarFallback>
                            {post.profiles.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{post.profiles.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(post.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <p className="mt-1">{post.content}</p>
                        </div>
                      </div>

                      {/* Replies */}
                      {postReplies.length > 0 && (
                        <div className="ml-11 space-y-2 border-l-2 border-muted pl-4">
                          {postReplies.slice(0, 2).map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={reply.profiles.avatar_url || undefined} />
                                <AvatarFallback>
                                  {reply.profiles.username.substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-xs">{reply.profiles.username}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(reply.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <p className="text-sm">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply input */}
                      {post.user_id !== user?.id && !userHasReplied && (
                        <div className="ml-11 space-y-2">
                          <Textarea
                            placeholder="Reply to this post..."
                            value={newReply}
                            onChange={(e) => setNewReply(e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleReplySubmit(post.id)}
                            disabled={!newReply.trim()}
                          >
                            Reply
                          </Button>
                        </div>
                      )}

                      {userHasReplied && (
                        <p className="ml-11 text-xs text-muted-foreground">
                          You've already replied to this post
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">No trio assigned yet</h2>
              <p className="text-muted-foreground">
                New trios are formed daily between 7 AM - 11 PM.<br />
                Check back throughout the day!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Home;