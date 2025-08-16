import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Send, Users, Settings, Shield, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import NotificationBell from '@/components/NotificationBell';
import MediaUpload from '@/components/MediaUpload';

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
  user4_id: string | null;
  user5_id: string | null;
  profiles: Profile[];
}

interface Post {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
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
  const { isSubscribed } = useRealtimeNotifications();
  const [currentTrio, setCurrentTrio] = useState<Trio | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newPost, setNewPost] = useState('');
  const [newReply, setNewReply] = useState('');
  const [lastPostTime, setLastPostTime] = useState<Date | null>(null);
  const [postCooldownRemaining, setPostCooldownRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  useEffect(() => {
    if (user) {
      fetchTodaysTrio();
    }
  }, [user]);

  const fetchTodaysTrio = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's trio - check all user positions
      const { data: trio, error: trioError } = await supabase
        .from('trios')
        .select('*')
        .eq('date', today)
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id},user3_id.eq.${user?.id},user4_id.eq.${user?.id},user5_id.eq.${user?.id}`)
        .single();

      if (trioError && trioError.code !== 'PGRST116') {
        console.error('Error fetching trio:', trioError);
        return;
      }

      if (trio) {
        // Collect all user IDs, filtering out null values
        const userIds = [
          trio.user1_id,
          trio.user2_id,
          trio.user3_id,
          trio.user4_id,
          trio.user5_id
        ].filter(Boolean);

        // Fetch profiles for all trio members
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, username, bio, avatar_url')
          .in('user_id', userIds);

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
      
      // Check user's last post time for cooldown
      const userPosts = postsData?.filter(post => post.user_id === user?.id) || [];
      if (userPosts.length > 0) {
        // Get the most recent post
        const mostRecentPost = userPosts.reduce((latest, post) => {
          return new Date(post.created_at) > new Date(latest.created_at) ? post : latest;
        });
        setLastPostTime(new Date(mostRecentPost.created_at));
      } else {
        setLastPostTime(null);
      }

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

  // Calculate cooldown timer
  useEffect(() => {
    if (!lastPostTime) {
      setPostCooldownRemaining(0);
      return;
    }

    const calculateCooldown = () => {
      const now = new Date();
      const timeSinceLastPost = now.getTime() - lastPostTime.getTime();
      const cooldownMs = 10 * 60 * 1000; // 10 minutes in milliseconds
      const remaining = Math.max(0, cooldownMs - timeSinceLastPost);
      setPostCooldownRemaining(Math.ceil(remaining / 1000)); // Convert to seconds
    };

    calculateCooldown();
    const interval = setInterval(calculateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastPostTime]);

  const handlePostSubmit = async () => {
    if ((!newPost.trim() && !mediaUrl) || !currentTrio || postCooldownRemaining > 0) return;

    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id,
          trio_id: currentTrio.id,
          content: newPost.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null
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
      setMediaUrl('');
      setMediaType(null);
      setLastPostTime(new Date());
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

  const handleMediaUploaded = (url: string, type: 'image' | 'video') => {
    setMediaUrl(url);
    setMediaType(type);
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
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">artrio</h1>
            {isSubscribed && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="h-8 px-2">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="h-8 px-2">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8 px-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 pb-20">
        {currentTrio ? (
          <>
            {/* Trio Panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Today's Trio ({currentTrio.profiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {currentTrio.profiles.map((profile) => (
                    <div 
                      key={profile.id} 
                      className="flex flex-col items-center gap-2 min-w-0 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/user/${profile.user_id}`)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center min-w-0">
                        <p className="font-medium text-sm truncate w-16">{profile.username}</p>
                        {profile.user_id === user?.id && (
                          <Badge variant="secondary" className="text-xs mt-1">You</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Post Box */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Share with your trio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="What's happening?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  disabled={postCooldownRemaining > 0}
                  className="min-h-[80px] resize-none"
                />
                
                {postCooldownRemaining === 0 && (
                  <MediaUpload 
                    onMediaUploaded={handleMediaUploaded}
                    className="w-full"
                  />
                )}
                
                <Button 
                  onClick={handlePostSubmit}
                  disabled={(!newPost.trim() && !mediaUrl) || postCooldownRemaining > 0}
                  className="w-full"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {postCooldownRemaining > 0 ? `Wait ${Math.floor(postCooldownRemaining / 60)}:${(postCooldownRemaining % 60).toString().padStart(2, '0')}` : 'Share'}
                </Button>
                
                {postCooldownRemaining > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    You can post again in {Math.floor(postCooldownRemaining / 60)} minutes {postCooldownRemaining % 60} seconds
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Posts and Replies */}
            <div className="space-y-3">
              {posts.map((post) => {
                const postReplies = replies.filter(reply => reply.post_id === post.id);
                const userHasReplied = postReplies.some(reply => reply.user_id === user?.id);
                
                return (
                  <Card key={post.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={post.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {post.profiles.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium text-sm truncate">{post.profiles.username}</p>
                            <p className="text-xs text-muted-foreground flex-shrink-0">
                              {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {post.content && <p className="text-sm leading-relaxed break-words">{post.content}</p>}
                          
                          {/* Media Display */}
                          {post.media_url && (
                            <div className="mt-3">
                              {post.media_type === 'image' ? (
                                <img 
                                  src={post.media_url} 
                                  alt="Post media" 
                                  className="max-w-full h-auto rounded-lg border"
                                  style={{ maxHeight: '300px' }}
                                />
                              ) : post.media_type === 'video' ? (
                                <video 
                                  src={post.media_url} 
                                  controls 
                                  className="max-w-full h-auto rounded-lg border"
                                  style={{ maxHeight: '300px' }}
                                />
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Replies */}
                      {postReplies.length > 0 && (
                        <div className="ml-11 space-y-2 border-l-2 border-muted pl-3">
                          {postReplies.slice(0, 3).map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar className="h-6 w-6 flex-shrink-0">
                                <AvatarImage src={reply.profiles.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {reply.profiles.username.substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-xs truncate">{reply.profiles.username}</p>
                                  <p className="text-xs text-muted-foreground flex-shrink-0">
                                    {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <p className="text-sm break-words">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                          {postReplies.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{postReplies.length - 3} more replies
                            </p>
                          )}
                        </div>
                      )}

                      {/* Reply input */}
                      {post.user_id !== user?.id && !userHasReplied && (
                        <div className="ml-11 space-y-2">
                          <Textarea
                            placeholder="Reply..."
                            value={newReply}
                            onChange={(e) => setNewReply(e.target.value)}
                            className="min-h-[60px] text-sm resize-none"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleReplySubmit(post.id)}
                            disabled={!newReply.trim()}
                            className="h-8"
                          >
                            Reply
                          </Button>
                        </div>
                      )}

                      {userHasReplied && (
                        <p className="ml-11 text-xs text-muted-foreground">
                          ✓ Replied
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
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold mb-2">No trio yet today</h2>
              <p className="text-muted-foreground text-sm">
                Trios form throughout the day.<br />
                Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Home;