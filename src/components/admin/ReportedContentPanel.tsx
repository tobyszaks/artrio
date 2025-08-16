import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Eye, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ReportedContent {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  resolution_notes: string;
}

export default function ReportedContentPanel() {
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportedContent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reported_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch reported content"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('reported_content')
        .update({ 
          status, 
          resolution_notes: notes,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_admin_id: (await supabase.auth.getUser()).data.user?.id,
        p_action_type: 'content_moderation',
        p_target_type: 'reported_content',
        p_target_id: reportId,
        p_description: `Updated report status to ${status}`,
        p_metadata: { status, notes }
      });

      toast({
        title: "Success",
        description: `Report ${status} successfully`
      });

      fetchReports();
      setSelectedReport(null);
      setResolutionNotes('');
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update report"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'reviewed': return 'secondary';
      case 'resolved': return 'default';
      case 'dismissed': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading reported content...</div>;
  }

  const pendingReports = reports.filter(r => r.status === 'pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Reported Content ({pendingReports.length} pending)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reports.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reports found</p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {report.content_type} • {format(new Date(report.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{report.reason}</p>
                      {report.description && (
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      )}
                    </div>
                    {report.resolution_notes && (
                      <div className="bg-muted p-2 rounded">
                        <p className="text-sm"><strong>Resolution:</strong> {report.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                  {report.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Review Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p><strong>Reason:</strong> {selectedReport.reason}</p>
                  <p><strong>Type:</strong> {selectedReport.content_type}</p>
                  {selectedReport.description && (
                    <p><strong>Description:</strong> {selectedReport.description}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateReportStatus(selectedReport.id, 'resolved', resolutionNotes)}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                  <Button
                    onClick={() => updateReportStatus(selectedReport.id, 'dismissed', resolutionNotes)}
                    variant="outline"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedReport(null)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}