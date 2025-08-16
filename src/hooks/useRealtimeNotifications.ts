import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TrioNotification {
  type: 'trio_formed';
  title: string;
  message: string;
  metadata: {
    trio_id: string;
    trio_size: number;
    date: string;
  };
}

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!user || isSubscribed) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time notification received:', payload);
          const notification = payload.new as any;
          
          // Show different types of notifications
          switch (notification.type) {
            case 'trio_formed':
            case 'group_formed': // Backward compatibility
              toast({
                title: "🎉 Your trio is ready!",
                description: `You've been matched with ${(notification.metadata.trio_size || notification.metadata.group_size) - 1} other users for today.`,
                duration: 6000,
              });
              break;
            case 'trio_reminder':
            case 'group_reminder': // Backward compatibility
              toast({
                title: "📱 Trio reminder",
                description: notification.message,
                duration: 4000,
              });
              break;
            case 'system_announcement':
              toast({
                title: "📢 System update",
                description: notification.message,
                duration: 5000,
              });
              break;
            default:
              toast({
                title: notification.title,
                description: notification.message,
                duration: 4000,
              });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trios',
          filter: `user1_id=eq.${user.id},user2_id=eq.${user.id},user3_id=eq.${user.id},user4_id=eq.${user.id},user5_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New trio formed with user:', payload);
          // This is a backup notification in case the trigger doesn't work
          toast({
            title: "🎉 New trio formed!",
            description: "Check your notifications for details about your new trio.",
            duration: 5000,
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
        }
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [user, isSubscribed, toast]);

  return { isSubscribed };
}