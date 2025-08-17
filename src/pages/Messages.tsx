import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleComingSoon = () => {
    toast({
      title: 'Coming Soon',
      description: 'Messaging functionality is under development',
      variant: 'default'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages
            </h1>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-60px)] items-center justify-center">
        <div className="text-center text-muted-foreground max-w-md px-6">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-medium mb-2">Messages Coming Soon</h2>
          <p className="mb-4">
            Direct messaging functionality is currently under development. 
            You'll be able to chat with your trio members here soon!
          </p>
          <Button onClick={handleComingSoon} variant="outline">
            Stay Tuned
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Messages;