import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Trash2, RefreshCw } from 'lucide-react';

export default function SystemControlsPanel() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const setButtonLoading = (key: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [key]: isLoading }));
  };

  const triggerGroupRandomization = async () => {
    setButtonLoading('randomize', true);
    try {
      const { error } = await supabase.functions.invoke('randomize-trios');
      
      if (error) throw error;

      const currentUser = await supabase.auth.getUser();
      await supabase.rpc('log_admin_action', {
        p_admin_id: currentUser.data.user?.id,
        p_action_type: 'system_control',
        p_description: 'Manually triggered group randomization'
      });

      toast({
        title: "Success",
        description: "Group randomization triggered successfully"
      });
    } catch (error) {
      console.error('Error triggering randomization:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to trigger group randomization"
      });
    } finally {
      setButtonLoading('randomize', false);
    }
  };

  const cleanupExpiredContent = async () => {
    setButtonLoading('cleanup', true);
    try {
      const { error } = await supabase.rpc('cleanup_expired_content');
      
      if (error) throw error;

      const currentUser = await supabase.auth.getUser();
      await supabase.rpc('log_admin_action', {
        p_admin_id: currentUser.data.user?.id,
        p_action_type: 'system_control',
        p_description: 'Manually triggered expired content cleanup'
      });

      toast({
        title: "Success",
        description: "Expired content cleanup completed"
      });
    } catch (error) {
      console.error('Error cleaning up content:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cleanup expired content"
      });
    } finally {
      setButtonLoading('cleanup', false);
    }
  };

  const refreshSafeProfiles = async () => {
    setButtonLoading('profiles', true);
    try {
      const { error } = await supabase.rpc('populate_safe_profiles');
      
      if (error) throw error;

      const currentUser = await supabase.auth.getUser();
      await supabase.rpc('log_admin_action', {
        p_admin_id: currentUser.data.user?.id,
        p_action_type: 'system_control',
        p_description: 'Manually refreshed safe profiles'
      });

      toast({
        title: "Success",
        description: "Safe profiles refreshed successfully"
      });
    } catch (error) {
      console.error('Error refreshing profiles:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh safe profiles"
      });
    } finally {
      setButtonLoading('profiles', false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          System Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={triggerGroupRandomization}
            disabled={loading.randomize}
            className="h-20 flex flex-col gap-2"
          >
            <Users className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Randomize Groups</div>
              <div className="text-xs opacity-80">Create new daily groups</div>
            </div>
          </Button>

          <Button
            onClick={cleanupExpiredContent}
            disabled={loading.cleanup}
            variant="outline"
            className="h-20 flex flex-col gap-2"
          >
            <Trash2 className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Cleanup Content</div>
              <div className="text-xs opacity-80">Remove expired posts</div>
            </div>
          </Button>

          <Button
            onClick={refreshSafeProfiles}
            disabled={loading.profiles}
            variant="outline"
            className="h-20 flex flex-col gap-2"
          >
            <RefreshCw className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Refresh Profiles</div>
              <div className="text-xs opacity-80">Update safe profile data</div>
            </div>
          </Button>

          <div className="h-20 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center text-muted-foreground">
              <div className="font-medium">More controls</div>
              <div className="text-xs">Coming soon</div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">⚠️ Important Notes</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Group randomization runs automatically daily</li>
            <li>• Content cleanup happens automatically via cron jobs</li>
            <li>• Use manual controls only when necessary</li>
            <li>• All actions are logged for audit purposes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}