import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AutomationSetting = {
  id: string;
  stage_id: string;
  stage_name: string;
  task_name: string;
  task_order_position: number;
  responsible_user_id: string | null;
  dispatcher_id: string | null;
  dispatcher_percentage: number;
  task_title_template: string;
  task_description_template: string;
  payment_amount: number;
  duration_days: number;
  start_condition: 'immediate' | 'after_task';
  depends_on_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StageWithTasks = {
  stage_id: string;
  stage_name: string;
  tasks: AutomationSetting[];
};

export const useAutomationSettings = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .order('stage_id')
        .order('task_order_position');
      
      if (error) throw error;
      return data as AutomationSetting[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const getStagesWithTasks = (): StageWithTasks[] => {
    const stagesMap = new Map<string, StageWithTasks>();
    
    settings.forEach(setting => {
      if (!stagesMap.has(setting.stage_id)) {
        stagesMap.set(setting.stage_id, {
          stage_id: setting.stage_id,
          stage_name: setting.stage_name,
          tasks: []
        });
      }
      stagesMap.get(setting.stage_id)!.tasks.push(setting);
    });
    
    return Array.from(stagesMap.values());
  };

  const createTaskMutation = useMutation({
    mutationFn: async (newTask: {
      stage_id: string;
      stage_name: string;
      task_name: string;
      task_order_position: number;
      responsible_user_id?: string | null;
      dispatcher_id?: string | null;
      dispatcher_percentage?: number;
      task_title_template?: string;
      task_description_template?: string;
      payment_amount?: number;
      duration_days?: number;
      start_condition?: 'immediate' | 'after_task';
      depends_on_task_id?: string | null;
    }) => {
      const { error } = await supabase
        .from('automation_settings')
        .insert([newTask]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Задача успешно добавлена');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Ошибка при создании задачи');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('automation_settings')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Задача удалена');
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast.error('Ошибка при удалении задачи');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: AutomationSetting[]) => {
      const promises = updatedSettings.map(setting => 
        supabase
          .from('automation_settings')
          .update({
            task_name: setting.task_name,
            task_order_position: setting.task_order_position,
            responsible_user_id: setting.responsible_user_id,
            dispatcher_id: setting.dispatcher_id,
            dispatcher_percentage: setting.dispatcher_percentage,
            task_title_template: setting.task_title_template,
            task_description_template: setting.task_description_template,
            payment_amount: setting.payment_amount,
            duration_days: setting.duration_days,
            start_condition: setting.start_condition,
            depends_on_task_id: setting.depends_on_task_id,
          })
          .eq('id', setting.id)
      );

      const results = await Promise.all(promises);
      
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Ошибка обновления: ${errors[0].error?.message}`);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Настройки автоматизации успешно сохранены');
      setIsEditing(false);
    },
    onError: (error) => {
      console.error('Error updating automation settings:', error);
      toast.error('Ошибка при сохранении настроек');
    },
  });

  const updateSettings = (updatedSettings: AutomationSetting[]) => {
    updateMutation.mutate(updatedSettings);
  };

  return {
    settings,
    isLoading,
    isEditing,
    setIsEditing,
    updateSettings,
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    getStagesWithTasks,
    isUpdating: updateMutation.isPending,
    isCreating: createTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
};