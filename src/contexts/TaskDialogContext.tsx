import { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import TaskDetailsDialog from '@/components/TaskDetailsDialog';

interface TaskDialogContextType {
  openTaskDialog: (taskId: number) => void;
  closeTaskDialog: () => void;
}

const TaskDialogContext = createContext<TaskDialogContextType | undefined>(undefined);

export function TaskDialogProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { data: task, refetch } = useQuery({
    queryKey: ['task-details', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      
      // Получаем задачу
      const { data: taskData, error: taskError } = await supabase
        .from('zadachi')
        .select(`
          *,
          zakazi(title)
        `)
        .eq('id_zadachi', taskId)
        .single();

      if (taskError) throw taskError;
      
      // Получаем данные пользователя если есть
      let userData = null;
      if (taskData.responsible_user_id) {
        const { data, error } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('uuid_user', taskData.responsible_user_id)
          .single();
        
        if (!error) userData = data;
      }
      
      return {
        ...taskData,
        responsible_user_name: userData?.full_name,
        order_title: taskData.zakazi?.title,
      };
    },
    enabled: !!taskId && isOpen,
  });

  const openTaskDialog = (id: number) => {
    setTaskId(id);
    setIsOpen(true);
  };

  const closeTaskDialog = () => {
    setIsOpen(false);
    setTaskId(null);
  };

  const handleTaskUpdated = () => {
    refetch();
  };

  return (
    <TaskDialogContext.Provider value={{ openTaskDialog, closeTaskDialog }}>
      {children}
      <TaskDetailsDialog
        task={task || null}
        isOpen={isOpen}
        onClose={closeTaskDialog}
        onTaskUpdated={handleTaskUpdated}
      />
    </TaskDialogContext.Provider>
  );
}

export function useTaskDialog() {
  const context = useContext(TaskDialogContext);
  if (!context) {
    throw new Error('useTaskDialog must be used within TaskDialogProvider');
  }
  return context;
}
