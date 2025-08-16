import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User, Camera, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SensitiveData {
  birthday: string;
}

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sensitiveData, setSensitiveData] = useState<SensitiveData | null>(null);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'destructive'
        });
        return;
      }

      // Fetch sensitive data (birthday) - only accessible by the user themselves
      const { data: sensitiveData, error: sensitiveError } = await supabase
        .from('sensitive_user_data')
        .select('birthday')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (sensitiveError && sensitiveError.code !== 'PGRST116') {
        console.error('Error fetching sensitive data:', sensitiveError);
      }

      // Calculate age using secure function
      const { data: ageData, error: ageError } = await supabase
        .rpc('calculate_age_secure', { target_user_id: user?.id });

      if (ageError) {
        console.error('Error calculating age:', ageError);
      }

      if (profileData) {
        setProfile(profileData);
        setFormData({
          username: profileData.username,
          bio: profileData.bio || '',
          avatar_url: profileData.avatar_url || ''
        });
      } else {
        // No profile exists - this might happen if signup didn't create one
        console.log('No profile found, user will need to create one');
        setFormData({
          username: '',
          bio: '',
          avatar_url: ''
        });
      }

      if (sensitiveData) {
        setSensitiveData(sensitiveData);
      }

      if (ageData) {
        setUserAge(ageData);
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

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be smaller than 5MB',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive'
        });
        return;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (data.publicUrl) {
        setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));
        toast({
          title: 'Image uploaded!',
          description: 'Don\'t forget to save your profile to update your avatar'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      // Clear the input so the same file can be selected again
      if (event.target) {
        event.target.value = '';
      }
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
      if (profile) {
        // Update existing profile
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
      } else {
        // Create new profile (this shouldn't normally happen but handles edge cases)
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user?.id,
            username: formData.username.trim(),
            bio: formData.bio.trim() || null,
            avatar_url: formData.avatar_url.trim() || null
          });

        if (error) {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive'
          });
          return;
        }
      }

      toast({
        title: profile ? 'Profile updated!' : 'Profile created!',
        description: profile ? 'Your profile has been saved successfully' : 'Your profile has been created successfully'
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

  const calculateAge = (birthday: string | null): number | 'Unknown' => {
    if (!birthday) return 'Unknown';
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const isUnderAge = (birthday: string | null): boolean => {
    const age = calculateAge(birthday);
    return typeof age === 'number' && age < 18;
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
              {profile ? 'Edit Profile' : 'Create Your Profile'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Avatar */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={formData.avatar_url || undefined} />
                <AvatarFallback className="text-xl">
                  {formData.username.substring(0, 2).toUpperCase() || 'US'}
                </AvatarFallback>
              </Avatar>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
              
              <Button 
                variant="outline" 
                size="sm" 
                disabled={uploading}
                onClick={handleCameraClick}
              >
                {uploading ? (
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {uploading ? 'Uploading...' : 'Change Photo'}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Select a photo from your device. Maximum size: 5MB
              </p>
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
                {userAge !== null && userAge < 18
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
                  {userAge !== null && (
                    <div>
                      <p className="text-muted-foreground">Age</p>
                      <p>{userAge} years old</p>
                    </div>
                  )}
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
              disabled={saving || uploading || !formData.username.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : (profile ? 'Save Profile' : 'Create Profile')}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;