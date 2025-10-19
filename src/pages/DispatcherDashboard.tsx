import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DispatcherReviewDialog from '@/components/DispatcherReviewDialog';
import DispatcherProfile from '@/components/dispatcher/DispatcherProfile';
import DispatcherMetrics from '@/components/dispatcher/DispatcherMetrics';
import DispatcherTaskCard from '@/components/dispatcher/DispatcherTaskCard';
import CompletedReviewsList from '@/components/dispatcher/CompletedReviewsList';
import { RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const DispatcherDashboard = () => {
  const { user, isUserOnline } = useAuth();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['dispatcher-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Получаем задачи на проверке и проверенные за сегодня
      const { data: tasksData, error: tasksError } = await supabase
        .from('zadachi')
        .select('*')
        .eq('dispatcher_id', user.id)
        .or('status.eq.under_review,status.eq.completed')
        .order('due_date', { ascending: true });

      if (tasksError) throw tasksError;
      
      console.log('Loaded dispatcher tasks with automation_setting_id:', tasksData?.map(t => ({ id: t.id_zadachi, automation_setting_id: t.automation_setting_id })));

      // Получаем данные о работниках
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('uuid_user, full_name');

      if (usersError) throw usersError;

      // Получаем данные о заказах
      const { data: orders, error: ordersError } = await supabase
        .from('zakazi')
        .select('id_zakaza, title, client_name');

      if (ordersError) throw ordersError;

      const usersMap = new Map(users?.map(u => [u.uuid_user, u.full_name]) || []);
      const ordersMap = new Map(orders?.map(o => [o.id_zakaza, o]) || []);

      return tasksData?.map(task => ({
        ...task,
        responsible_user_name: task.responsible_user_id ? usersMap.get(task.responsible_user_id) : null,
        order_title: task.zakaz_id ? 
          (() => {
            const order = ordersMap.get(task.zakaz_id);
            return order ? `${order.title} (${order.client_name})` : null;
          })() : null
      })) || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000
  });

  // Realtime подписка на изменения задач
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('dispatcher-tasks-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'zadachi',
        filter: `dispatcher_id=eq.${user.id}`
      }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  const pendingTasks = tasks.filter(t => t.status === 'under_review');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  // Sidebar content
  const SidebarContent = () => (
    <div className="space-y-6">
      {user && (
        <DispatcherProfile
          user={{
            uuid_user: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url
          }}
          isOnline={isUserOnline(user.id)}
        />
      )}
      
      {user && <DispatcherMetrics userId={user.id} />}
      
      <CompletedReviewsList tasks={completedTasks} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <motion.main 
        className="pt-14"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Header with mobile menu */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate">
                Проверка задач
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2 line-clamp-2">
                Задачи, ожидающие проверки диспетчера
              </p>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="hidden sm:flex"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                className="sm:hidden h-9 w-9"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>

              {/* Mobile menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden h-9 w-9">
                    <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto p-4">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Main content - Tasks */}
            <motion.div variants={itemVariants} className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : pendingTasks.length === 0 ? (
                <div className="text-center py-8 sm:py-12 bg-muted/30 rounded-lg border-2 border-dashed px-4">
                  <p className="text-base sm:text-lg text-muted-foreground">
                    Нет задач на проверке
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                    Отличная работа! Все задачи проверены.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingTasks.map((task, index) => (
                    <DispatcherTaskCard
                      key={task.uuid_zadachi}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </motion.div>

            {/* Sidebar - Desktop only */}
            <motion.aside 
              variants={itemVariants}
              className="hidden lg:block"
            >
              <SidebarContent />
            </motion.aside>
          </div>
        </div>
      </motion.main>

      <DispatcherReviewDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={() => refetch()}
      />
    </div>
  );
};

export default DispatcherDashboard;
