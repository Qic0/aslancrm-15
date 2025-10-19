import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useTaskCompletion = () => {
  const queryClient = useQueryClient();

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, automationSettingId }: { taskId: number; automationSettingId?: string }) => {
      // Отмечаем задачу как завершенную
      const { error: updateError } = await supabase
        .from('zadachi')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString() 
        })
        .eq('id_zadachi', taskId);

      if (updateError) throw updateError;

      // Если есть automation_setting_id, запускаем создание зависимых задач
      if (automationSettingId) {
        const { error: functionError } = await supabase.functions.invoke('create-dependent-tasks', {
          body: {
            completed_task_id: taskId,
            automation_setting_id: automationSettingId
          }
        });

        if (functionError) {
          console.error('Error creating dependent tasks:', functionError);
          // Не выбрасываем ошибку, чтобы задача все равно отметилась как завершенная
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zadachi'] });
      queryClient.invalidateQueries({ queryKey: ['zakazi'] });
      toast.success('Задача завершена');
    },
    onError: (error) => {
      console.error('Error completing task:', error);
      toast.error('Ошибка при завершении задачи');
    },
  });

  return {
    completeTask: completeTaskMutation.mutate,
    isCompleting: completeTaskMutation.isPending,
  };
};
