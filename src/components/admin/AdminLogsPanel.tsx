import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface AdminLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  description: string;
  metadata: any;
  created_at: string;
}

export default function AdminLogsPanel() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching admin logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'user_moderation': return 'destructive';
      case 'content_moderation': return 'secondary';
      case 'system_control': return 'default';
      default: return 'outline';
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'user_moderation': return '👤';
      case 'content_moderation': return '📝';
      case 'system_control': return '⚙️';
      default: return '📋';
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading admin logs...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Admin Activity Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No admin activity found</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-xl">{getActionTypeIcon(log.action_type)}</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionTypeColor(log.action_type)}>
                            {log.action_type}
                          </Badge>
                          {log.target_type && (
                            <Badge variant="outline">
                              {log.target_type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{log.description}</p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}