import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Unified real-time hook for zadachi data with multi-cache support
export const useRealtimeZadachi = (
  queryKey: string[] = ['zadachi'], 
  additionalQueryKeys: string[][] = []
) => {
  const queryClient = useQueryClient();

  const { data: zadachi, isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      console.log(`Fetching zadachi data for ${queryKey.join('-')}...`);
      
      // Получаем задачи
      const { data: tasks, error: tasksError } = await supabase
        .from('zadachi')
        .select('*')
        .order('id_zadachi', { ascending: false });
      
      if (tasksError) {
        console.error('Error fetching zadachi:', tasksError);
        throw tasksError;
      }
      
      // Получаем заказы
      const { data: orders, error: ordersError } = await supabase
        .from('zakazi')
        .select('id_zakaza, title, client_name, status');
      
      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      // Получаем пользователей
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('uuid_user, full_name');
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }
      
      // Создаем карту пользователей и заказов
      const usersMap = new Map(users?.map(user => [user.uuid_user, user.full_name]) || []);
      const ordersMap = new Map(orders?.map(order => [order.id_zakaza, order]) || []);
      
      // Обогащаем задачи данными о пользователях
      const enrichedTasks = tasks?.map(task => {
        const taskWithOrder = task as any;
        const order = taskWithOrder.zakaz_id ? ordersMap.get(taskWithOrder.zakaz_id) : null;
        return {
          ...task,
          responsible_user_name: task.responsible_user_id ? usersMap.get(task.responsible_user_id) : null,
          order_title: order ? `${order.title} (${order.client_name})` : null,
          order_stage: order?.status || null
        };
      }) || [];
      
      // Сортируем так, чтобы завершенные задачи были внизу
      const sortedTasks = enrichedTasks.sort((a, b) => {
        // Если одна задача завершена, а другая нет
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        // Если обе задачи имеют одинаковый статус, сортируем по ID (новые сверху)
        return b.id_zadachi - a.id_zadachi;
      });
      
      console.log('Zadachi data fetched:', sortedTasks?.length, 'records');
      return sortedTasks;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    placeholderData: [], // Keep empty array to prevent flashing
  });

  // Update all caches when data changes
  const updateAllCaches = (updateFn: (oldData: any) => any) => {
    const allQueryKeys = [queryKey, ...additionalQueryKeys];
    
    allQueryKeys.forEach(key => {
      queryClient.setQueryData(key, updateFn);
    });
  };

  // Unified real-time subscription for zadachi
  useEffect(() => {
    const channelName = `zadachi-realtime-unified`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zadachi'
        },
        async (payload) => {
          console.log('Zadachi table changed:', payload);
          
          // При изменении задачи, обновляем данные полностью чтобы пересчитать все связи
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            console.log('Refreshing all zadachi data due to change');
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up unified zadachi channel');
      supabase.removeChannel(channel);
    };
  }, [queryClient, refetch]);

  // Also listen to zakazi and users changes to update enriched data
  useEffect(() => {
    const channelName = `zadachi-dependencies-realtime`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zakazi'
        },
        () => {
          console.log('Zakazi table changed, refreshing zadachi to update relations');
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users'
        },
        () => {
          console.log('Users table changed, refreshing zadachi to update names');
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up zadachi dependencies channel');
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return {
    data: zadachi,
    isLoading,
    isFetching,
    refetch
  };
};
