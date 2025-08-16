import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  birthday: string;
  created_at: string;
  updated_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'destructive'
        });
        return;
      }

      if (data) {
        setProfile(data);
        setFormData({
          username: data.username,
          bio: data.bio || '',
          avatar_url: data.avatar_url || ''
        });
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

  const handleSave = async () => {
    if (!formData.username.trim()) {
      toast({
        title: 'Error',
        description: 'Username is required',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username.trim(),
          bio: formData.bio.trim() || null,
          avatar_url: formData.avatar_url.trim() || null
        })
        .eq('user_id', user?.id);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Profile updated!',
        description: 'Your profile has been saved successfully'
      });

      // Refresh profile data
      await fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (birthday: string) => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {formData.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a URL to an image for your profile picture
                </p>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell others about yourself..."
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                {profile && calculateAge(profile.birthday) < 18 
                  ? 'Bio will be hidden for users under 18' 
                  : 'Share a bit about yourself with your trio members'
                }
              </p>
            </div>

            {/* Read-only info */}
            {profile && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p>{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Age</p>
                    <p>{calculateAge(profile.birthday)} years old</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Member since</p>
                    <p>{new Date(profile.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last updated</p>
                    <p>{new Date(profile.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <Button 
              onClick={handleSave}
              disabled={saving || !formData.username.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;