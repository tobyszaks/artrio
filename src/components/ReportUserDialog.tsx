import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ReportUserDialogProps {
  reportedUserId: string;
  reportedUsername: string;
}

const ReportUserDialog = ({ reportedUserId, reportedUsername }: ReportUserDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('reported_content')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          content_id: reportedUserId, // Using user ID as content ID for user reports
          content_type: 'user',
          reason,
          description: description || null
        });

      if (error) throw error;

      toast({
        title: 'Report submitted',
        description: 'Thank you for helping keep our community safe. We\'ll review this report.',
      });
      
      setOpen(false);
      setReason('');
      setDescription('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="h-4 w-4 mr-2" />
          Report User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {reportedUsername}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for reporting</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inappropriate_content">Inappropriate content</SelectItem>
                <SelectItem value="harassment">Harassment or bullying</SelectItem>
                <SelectItem value="spam">Spam or unwanted content</SelectItem>
                <SelectItem value="fake_profile">Fake or impersonation</SelectItem>
                <SelectItem value="underage">Underage user</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!reason || submitting}
              variant="destructive"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportUserDialog;