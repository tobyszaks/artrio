import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, User, Share, UserX, UserCheck, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProfileSkeleton from '@/components/ProfileSkeleton';
import ReportUserDialog from '@/components/ReportUserDialog';

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      checkBlockStatus();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    if (!userId) return;

    try {
      // Fetch the user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast({
          title: 'Error',
          description: 'Failed to load user profile',
          variant: 'destructive'
        });
        return;
      }

      setProfile(profileData);

      // Fetch age range if available
      const { data: ageData, error: ageError } = await supabase
        .rpc('get_user_age_range', { profile_user_id: userId });

      if (!ageError && ageData) {
        setAgeRange(ageData);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBlockStatus = async () => {
    if (!userId || !user) return;

    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .single();

      if (!error && data) {
        setIsBlocked(true);
      }
    } catch (error) {
      // Not blocked or error checking
    }
  };

  const handleBlock = async () => {
    if (!userId || !user) return;

    setBlockLoading(true);
    try {
      if (isBlocked) {
        // Unblock
        const { error } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId);

        if (error) throw error;

        setIsBlocked(false);
        toast({
          title: 'User unblocked',
          description: 'You can now see content from this user.',
        });
      } else {
        // Block
        const { error } = await supabase
          .from('user_blocks')
          .insert({
            blocker_id: user.id,
            blocked_id: userId
          });

        if (error) throw error;

        setIsBlocked(true);
        toast({
          title: 'User blocked',
          description: 'You will no longer see content from this user.',
        });
      }
    } catch (error) {
      console.error('Error updating block status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update block status',
        variant: 'destructive'
      });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleShare = async () => {
    const profileUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.username}'s Profile`,
          text: `Check out ${profile?.username}'s profile on our app!`,
          url: profileUrl,
        });
      } catch (error) {
        // Fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Profile link copied to clipboard!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Profile</h1>
          </div>
        </header>
        <main className="p-4">
          <ProfileSkeleton />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-lg">Profile not found</div>
        <Button onClick={() => navigate('/')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    );
  }

  const isOwnProfile = profile.user_id === user?.id;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Profile</h1>
          </div>
        </header>

        <main className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Profile
                {isOwnProfile && (
                  <Badge variant="secondary" className="ml-2">You</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {profile.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{profile.username}</h2>
                  {ageRange && (
                    <p className="text-muted-foreground">Age: {ageRange}</p>
                  )}
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="space-y-2">
                  <h3 className="font-semibold">About</h3>
                  <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
                </div>
              )}

              {/* Account Info */}
              <div className="space-y-2">
                <h3 className="font-semibold">Account Information</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-3">
                {isOwnProfile ? (
                  <Button 
                    onClick={() => navigate('/profile')} 
                    className="w-full"
                    variant="outline"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleShare}
                        variant="outline"
                        className="flex-1"
                      >
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                      <Button 
                        onClick={handleBlock}
                        variant="outline"
                        disabled={blockLoading}
                        className="flex-1"
                      >
                        {isBlocked ? (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Unblock
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Block
                          </>
                        )}
                      </Button>
                    </div>
                    <ReportUserDialog 
                      reportedUserId={profile.user_id}
                      reportedUsername={profile.username}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default UserProfile;