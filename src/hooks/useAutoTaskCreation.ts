import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AutomationSetting } from './useAutomationSettings';
// Removed date-fns-tz import - now working with UTC directly

export const useAutoTaskCreation = () => {
  // Загружаем настройки автоматизации
  const { data: automationSettings = [] } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*');
      
      if (error) throw error;
      return data as AutomationSetting[];
    },
  });

  const createTaskForStage = async (orderId: string, orderNumericId: number, newStage: string, orderTitle: string) => {
    try {
      // Находим только immediate настройки БЕЗ зависимостей для этого этапа
      const immediateSettings = automationSettings.filter(
        setting => setting.stage_id === newStage && 
        setting.start_condition === 'immediate' &&
        !setting.depends_on_task_id
      ).sort((a, b) => (a.task_order_position || 0) - (b.task_order_position || 0));
      
      console.log(`Creating immediate tasks for stage ${newStage}:`, immediateSettings.length);
      console.log(`Tasks with dependencies will be created automatically after parent task completion`);
      
      if (immediateSettings.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Нет immediate задач без зависимостей для этапа: ${newStage}`);
        }
        return;
      }

      // Получаем максимальный id_zadachi для инкремента
      const { data: maxIdData } = await supabase
        .from('zadachi')
        .select('id_zadachi')
        .order('id_zadachi', { ascending: false })
        .limit(1);

      let nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id_zadachi + 1 : 1;
      let createdCount = 0;

      // Создаём все immediate задачи для этапа
      for (const stageSettings of immediateSettings) {
        if (!stageSettings.responsible_user_id) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Ответственный не назначен для задачи: ${stageSettings.task_name}`);
          }
          continue;
        }

        const taskTitle = stageSettings.task_title_template.replace('#{order_id}', orderNumericId.toString());
        const taskDescription = stageSettings.task_description_template + ` (Заказ: ${orderTitle})`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + stageSettings.duration_days);

        const { error } = await supabase
          .from('zadachi')
          .insert({
            id_zadachi: nextId,
            title: taskTitle,
            description: taskDescription,
            responsible_user_id: stageSettings.responsible_user_id,
            zakaz_id: orderNumericId,
            due_date: dueDate.toISOString(),
            original_deadline: dueDate.toISOString(),
            salary: stageSettings.payment_amount,
            priority: 'medium',
            status: 'in_progress',
            dispatcher_id: stageSettings.dispatcher_id,
            dispatcher_percentage: stageSettings.dispatcher_percentage,
            stage_id: newStage,
            automation_setting_id: stageSettings.id
          });

        if (error) {
          console.error(`Ошибка создания задачи ${nextId}:`, error);
          continue;
        }

        createdCount++;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Создана задача ${nextId}: ${taskTitle}`);
        }

        // Отправляем push-уведомление работнику
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: stageSettings.responsible_user_id,
              title: 'Новая задача',
              body: taskTitle,
              taskId: nextId,
              orderId: orderNumericId,
              url: '/worker-dashboard'
            }
          });
        } catch (notifError) {
          console.error(`Ошибка отправки уведомления для задачи ${nextId}:`, notifError);
        }

        nextId++;
      }

      if (createdCount > 0) {
        toast.success(`Создано задач: ${createdCount}`);
      }

    } catch (error) {
      console.error('Ошибка при создании автоматических задач:', error);
      toast.error('Ошибка при создании автоматических задач');
    }
  };

  return {
    createTaskForStage,
    automationSettings,
  };
};