import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, Search, Ban, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
}

interface ModerationAction {
  id: string;
  target_user_id: string;
  action_type: string;
  reason: string;
  duration_hours: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export default function UserModerationPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [moderationActions, setModerationActions] = useState<ModerationAction[]>([]);
  const [actionType, setActionType] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (searchTerm.length > 2) {
      searchUsers();
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const fetchModerationHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('moderation_actions')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModerationActions(data || []);
    } catch (error) {
      console.error('Error fetching moderation history:', error);
    }
  };

  const selectUser = async (user: Profile) => {
    setSelectedUser(user);
    await fetchModerationHistory(user.user_id);
  };

  const executeModerationAction = async () => {
    if (!selectedUser || !actionType || !reason) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    setLoading(true);
    try {
      const currentUser = await supabase.auth.getUser();
      const expiresAt = duration ? new Date(Date.now() + parseInt(duration) * 60 * 60 * 1000).toISOString() : null;

      const { error } = await supabase
        .from('moderation_actions')
        .insert({
          moderator_id: currentUser.data.user?.id,
          target_user_id: selectedUser.user_id,
          action_type: actionType,
          reason: reason,
          duration_hours: duration ? parseInt(duration) : null,
          expires_at: expiresAt
        });

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_admin_id: currentUser.data.user?.id,
        p_action_type: 'user_moderation',
        p_target_type: 'user',
        p_target_id: selectedUser.user_id,
        p_description: `Applied ${actionType}: ${reason}`,
        p_metadata: { action_type: actionType, duration_hours: duration }
      });

      toast({
        title: "Success",
        description: "Moderation action applied successfully"
      });

      setActionType('');
      setReason('');
      setDuration('');
      await fetchModerationHistory(selectedUser.user_id);
    } catch (error) {
      console.error('Error applying moderation action:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to apply moderation action"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          User Moderation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {users.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Search Results:</p>
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
                onClick={() => selectUser(user)}
              >
                <div>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button size="sm" variant="outline">Select</Button>
              </div>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="font-semibold">Moderating: {selectedUser.username}</h3>
              <p className="text-sm text-muted-foreground">User ID: {selectedUser.user_id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Action Type</label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="temporary_ban">Temporary Ban</SelectItem>
                    <SelectItem value="permanent_ban">Permanent Ban</SelectItem>
                    <SelectItem value="content_removal">Content Removal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(actionType === 'temporary_ban') && (
                <div>
                  <label className="text-sm font-medium">Duration (hours)</label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="24"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for this moderation action..."
              />
            </div>

            <Button 
              onClick={executeModerationAction} 
              disabled={loading}
              className="w-full"
            >
              <Ban className="h-4 w-4 mr-2" />
              Apply Moderation Action
            </Button>

            {moderationActions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Moderation History</h4>
                <div className="space-y-2">
                  {moderationActions.map((action) => (
                    <div key={action.id} className="bg-muted p-3 rounded">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{action.action_type}</span>
                          {!action.is_active && <span className="text-xs text-muted-foreground">(Expired)</span>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(action.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{action.reason}</p>
                      {action.expires_at && action.is_active && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {format(new Date(action.expires_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}