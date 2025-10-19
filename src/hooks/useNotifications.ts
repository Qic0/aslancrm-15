import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from '@/components/ui/sonner';
import { useEffect, createElement } from 'react';
import { Bell } from 'lucide-react';
import { useTaskDialog } from '@/contexts/TaskDialogContext';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  task_id: number | null;
  order_id: number | null;
  url: string | null;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

export function useNotifications(limit?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openTaskDialog } = useTaskDialog();

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Notification[];
    },
  });

  // Подписка на realtime обновления
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          console.log('Notification change:', payload);
          
          // Показываем toast только для новых уведомлений (INSERT)
          if (payload.eventType === 'INSERT' && payload.new) {
            const notification = payload.new as Notification;
            
            // Проверяем, что уведомление для текущего пользователя
            const { data: { user } } = await supabase.auth.getUser();
            if (user && notification.user_id === user.id) {
              sonnerToast(notification.title, {
                description: notification.body,
                duration: 6000,
                icon: createElement(Bell, { className: "h-4 w-4" }),
                action: notification.task_id ? {
                  label: 'Открыть',
                  onClick: () => {
                    if (notification.task_id) {
                      openTaskDialog(notification.task_id);
                    }
                  },
                } : undefined,
              });
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, openTaskDialog]);

  return {
    notifications: notifications || [],
    isLoading,
    error,
  };
}

export function useUnreadCount() {
  const { data: count, isLoading } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    },
  });

  return {
    unreadCount: count || 0,
    isLoading,
  };
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отметить уведомление как прочитанное',
        variant: 'destructive',
      });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      toast({
        title: 'Готово',
        description: 'Все уведомления отмечены как прочитанные',
      });
    },
    onError: (error) => {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отметить уведомления как прочитанные',
        variant: 'destructive',
      });
    },
  });
}
