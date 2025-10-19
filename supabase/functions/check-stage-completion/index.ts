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

    const { order_id } = await req.json();
    
    console.log('Checking stage completion for order:', order_id);

    // Получаем информацию о заказе
    const { data: order, error: orderError } = await supabase
      .from('zakazi')
      .select('id_zakaza, status')
      .eq('id_zakaza', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentStage = order.status;
    console.log('Current stage:', currentStage);

    // Проверяем, все ли задачи ТЕКУЩЕГО ЭТАПА завершены
    const { data: incompleteTasks, error: tasksError } = await supabase
      .from('zadachi')
      .select('id_zadachi')
      .eq('zakaz_id', order_id)
      .eq('stage_id', currentStage)
      .neq('status', 'completed');

    if (tasksError) {
      console.error('Error checking tasks:', tasksError);
      throw tasksError;
    }

    if (incompleteTasks && incompleteTasks.length > 0) {
      console.log('Not all tasks completed, found incomplete:', incompleteTasks.length);
      return new Response(
        JSON.stringify({ message: 'Not all tasks completed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('All tasks completed for current stage');

    // Получаем следующий этап из цепочки автоматизации
    const { data: chain, error: chainError } = await supabase
      .from('stage_automation_chain')
      .select('to_stage_id, is_active')
      .eq('from_stage_id', currentStage)
      .single();

    if (chainError || !chain) {
      console.log('No automation chain found or error:', chainError);
      return new Response(
        JSON.stringify({ message: 'No automation chain configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!chain.is_active) {
      console.log('Automation is disabled for this stage');
      return new Response(
        JSON.stringify({ message: 'Automation disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextStage = chain.to_stage_id;

    if (!nextStage) {
      console.log('This is the final stage, no next stage');
      return new Response(
        JSON.stringify({ message: 'Final stage reached' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Moving order to next stage:', nextStage);

    // Обновляем статус заказа
    const { error: updateError } = await supabase
      .from('zakazi')
      .update({ status: nextStage, updated_at: new Date().toISOString() })
      .eq('id_zakaza', order_id);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      throw updateError;
    }

    // Получаем только immediate задачи БЕЗ зависимостей для нового этапа
    const { data: automationSettingsList, error: settingsError } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('stage_id', nextStage)
      .eq('start_condition', 'immediate')
      .is('depends_on_task_id', null)
      .order('task_order_position');

    if (settingsError) {
      console.error('Error fetching automation settings:', settingsError);
      throw settingsError;
    }

    if (!automationSettingsList || automationSettingsList.length === 0) {
      console.log('No immediate tasks found for next stage');
      return new Response(
        JSON.stringify({ 
          message: 'Order moved but no immediate tasks to create',
          moved_to: nextStage 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем информацию о заказе для создания задач
    const { data: orderInfo } = await supabase
      .from('zakazi')
      .select('title')
      .eq('id_zakaza', order_id)
      .single();

    // Получаем максимальный id задачи для инкремента
    const { data: maxIdData } = await supabase
      .from('zadachi')
      .select('id_zadachi')
      .order('id_zadachi', { ascending: false })
      .limit(1);

    let nextTaskId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id_zadachi + 1 : 1;

    const createdTasks: number[] = [];

    // Создаем задачи для каждой настройки автоматизации
    for (const automationSettings of automationSettingsList) {
      if (!automationSettings.responsible_user_id) {
        console.log(`Skipping task creation - no responsible user for: ${automationSettings.task_name}`);
        continue;
      }

      const taskTitle = automationSettings.task_title_template.replace('#{order_id}', order_id.toString());
      const taskDescription = automationSettings.task_description_template + ` (Заказ: ${orderInfo?.title || order_id})`;
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (automationSettings.duration_days || 1));

      const { error: taskError } = await supabase
        .from('zadachi')
        .insert({
          id_zadachi: nextTaskId,
          title: taskTitle,
          description: taskDescription,
          responsible_user_id: automationSettings.responsible_user_id,
          zakaz_id: order_id,
          due_date: dueDate.toISOString(),
          original_deadline: dueDate.toISOString(),
          salary: automationSettings.payment_amount,
          priority: 'medium',
          status: 'in_progress',
          dispatcher_id: automationSettings.dispatcher_id,
          dispatcher_percentage: automationSettings.dispatcher_percentage,
          stage_id: nextStage,
          automation_setting_id: automationSettings.id
        });

      if (taskError) {
        console.error(`Error creating task ${nextTaskId}:`, taskError);
        // Продолжаем создавать остальные задачи даже если одна не создалась
      } else {
        console.log(`Successfully created task ${nextTaskId}: ${taskTitle}`);
        createdTasks.push(nextTaskId);

        // Отправляем push-уведомление работнику о новой задаче
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

      nextTaskId++; // Инкрементируем для следующей задачи
    }

    console.log(`Successfully moved order and created ${createdTasks.length} task(s)`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Order automatically moved to next stage',
        from_stage: currentStage,
        to_stage: nextStage,
        tasks_created: createdTasks.length,
        task_ids: createdTasks
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-stage-completion:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});