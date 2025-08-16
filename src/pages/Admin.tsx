import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Calendar, BarChart3, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  totalTrios: number;
  todaysTrios: number;
  totalPosts: number;
  todaysPosts: number;
  recentUsers: Array<{
    username: string;
    created_at: string;
    ageRange: string;
  }>;
}

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAccess();
    }
  }, [user]);

  const checkAdminAccess = async () => {
    try {
      // Check if user has admin role
      const { data: roles, error } = await supabase
        .rpc('get_user_roles', { _user_id: user?.id });

      if (error) {
        console.error('Error checking admin access:', error);
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this page',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      const hasAdminRole = roles?.some((role: any) => role.role === 'admin');
      
      if (!hasAdminRole) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await fetchAdminStats();
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    }
  };

  const fetchAdminStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total profiles count (should be same as users)
      const { count: totalProfiles } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total trios count
      const { count: totalTrios } = await supabase
        .from('trios')
        .select('*', { count: 'exact', head: true });

      // Get today's trios count
      const { count: todaysTrios } = await supabase
        .from('trios')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      // Get total posts count
      const { count: totalPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Get today's posts count
      const { count: todaysPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Get recent users (last 10)
      const { data: recentProfiles } = await supabase
        .from('profiles')
        .select('username, created_at, birthday')
        .order('created_at', { ascending: false })
        .limit(10);

      const recentUsers = recentProfiles?.map(profile => ({
        username: profile.username,
        created_at: profile.created_at,
        ageRange: getAgeRange(profile.birthday)
      })) || [];

      setStats({
        totalUsers: totalUsers || 0,
        totalProfiles: totalProfiles || 0,
        totalTrios: totalTrios || 0,
        todaysTrios: todaysTrios || 0,
        totalPosts: totalPosts || 0,
        todaysPosts: todaysPosts || 0,
        recentUsers
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin statistics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getAgeRange = (birthday: string): string => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age >= 15 && age <= 17) return '15-17';
    if (age >= 18 && age <= 21) return '18-21';
    if (age >= 22 && age <= 25) return '22-25';
    if (age >= 26) return '26+';
    return 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Access denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Registered profiles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trios</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTrios || 0}</div>
              <p className="text-xs text-muted-foreground">
                All-time trio formations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Trios</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todaysTrios || 0}</div>
              <p className="text-xs text-muted-foreground">
                Active trios today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.todaysPosts || 0} posted today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentUsers.map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {user.ageRange}
                    </Badge>
                  </div>
                </div>
              )) || (
                <p className="text-muted-foreground text-center py-4">
                  No users found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={fetchAdminStats}
              variant="outline"
              className="w-full"
            >
              Refresh Statistics
            </Button>
            <p className="text-sm text-muted-foreground">
              Trio randomization runs automatically every hour between 7 AM - 11 PM.
              New trios are formed once per day when eligible users are available.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;