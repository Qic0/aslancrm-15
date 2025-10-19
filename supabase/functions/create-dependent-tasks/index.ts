import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { completed_task_id, automation_setting_id } = await req.json();
    
    console.log('Creating dependent tasks for automation setting:', automation_setting_id);

    // Получаем информацию о завершенной задаче
    const { data: completedTask, error: taskError } = await supabase
      .from('zadachi')
      .select('id_zadachi, zakaz_id, stage_id')
      .eq('id_zadachi', completed_task_id)
      .single();

    if (taskError || !completedTask) {
      console.error('Task not found:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем зависимые задачи из automation_settings
    const { data: dependentSettings, error: settingsError } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('depends_on_task_id', automation_setting_id)
      .order('task_order_position');

    if (settingsError) {
      console.error('Error fetching dependent settings:', settingsError);
      throw settingsError;
    }

    if (!dependentSettings || dependentSettings.length === 0) {
      console.log('No dependent tasks found');
      
      // Вызываем проверку завершения этапа
      await supabase.functions.invoke('check-stage-completion', {
        body: { order_id: completedTask.zakaz_id }
      });
      
      return new Response(
        JSON.stringify({ message: 'No dependent tasks' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем информацию о заказе
    const { data: orderInfo } = await supabase
      .from('zakazi')
      .select('title, status')
      .eq('id_zakaza', completedTask.zakaz_id)
      .single();

    // Проверяем, что заказ все еще на том же этапе
    if (!orderInfo || orderInfo.status !== completedTask.stage_id) {
      console.log('Order has moved to a different stage');
      return new Response(
        JSON.stringify({ message: 'Order moved to different stage' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем максимальный id задачи для инкремента
    const { data: maxIdData } = await supabase
      .from('zadachi')
      .select('id_zadachi')
      .order('id_zadachi', { ascending: false })
      .limit(1);

    let nextTaskId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id_zadachi + 1 : 1;

    const createdTasks: number[] = [];

    // Получаем уже существующие задачи для этого заказа на текущем этапе
    const { data: existingTasks } = await supabase
      .from('zadachi')
      .select('automation_setting_id')
      .eq('zakaz_id', completedTask.zakaz_id)
      .eq('stage_id', completedTask.stage_id)
      .not('automation_setting_id', 'is', null);

    const existingSettingIds = new Set(
      existingTasks?.map(t => t.automation_setting_id).filter(Boolean) || []
    );

    // Создаем зависимые задачи
    for (const automationSettings of dependentSettings) {
      // Проверяем, не создана ли уже задача с этим automation_setting_id
      if (existingSettingIds.has(automationSettings.id)) {
        console.log(`Task already exists for automation setting: ${automationSettings.task_name}`);
        continue;
      }

      if (!automationSettings.responsible_user_id) {
        console.log(`Skipping task creation - no responsible user for: ${automationSettings.task_name}`);
        continue;
      }

      const taskTitle = automationSettings.task_title_template.replace('#{order_id}', completedTask.zakaz_id.toString());
      const taskDescription = automationSettings.task_description_template + ` (Заказ: ${orderInfo?.title || completedTask.zakaz_id})`;
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (automationSettings.duration_days || 1));

      const { error: taskError } = await supabase
        .from('zadachi')
        .insert({
          id_zadachi: nextTaskId,
          title: taskTitle,
          description: taskDescription,
          responsible_user_id: automationSettings.responsible_user_id,
          zakaz_id: completedTask.zakaz_id,
          due_date: dueDate.toISOString(),
          original_deadline: dueDate.toISOString(),
          salary: automationSettings.payment_amount,
          priority: 'medium',
          status: 'in_progress',
          dispatcher_id: automationSettings.dispatcher_id,
          dispatcher_percentage: automationSettings.dispatcher_percentage,
          stage_id: completedTask.stage_id,
          automation_setting_id: automationSettings.id
        });

      if (taskError) {
        console.error(`Error creating task ${nextTaskId}:`, taskError);
      } else {
        console.log(`Successfully created dependent task ${nextTaskId}: ${taskTitle}`);
        createdTasks.push(nextTaskId);

        // Отправляем push-уведомление работнику
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: automationSettings.responsible_user_id,
              title: 'Новая задача',
              body: taskTitle,
              taskId: nextTaskId,
              url: '/worker-dashboard'
            }
          });
          console.log(`Push notification sent for task ${nextTaskId}`);
        } catch (notifError) {
          console.error(`Failed to send push notification for task ${nextTaskId}:`, notifError);
        }
      }

      nextTaskId++;
    }

    console.log(`Created ${createdTasks.length} dependent task(s)`);

    // Всегда проверяем завершение этапа после создания зависимых задач
    // check-stage-completion сам решит, нужно ли переносить заказ
    try {
      await supabase.functions.invoke('check-stage-completion', {
        body: { order_id: completedTask.zakaz_id }
      });
      console.log('Stage completion check triggered for order:', completedTask.zakaz_id);
    } catch (checkError) {
      console.error('Error checking stage completion:', checkError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Dependent tasks created',
        tasks_created: createdTasks.length,
        task_ids: createdTasks
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-dependent-tasks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
