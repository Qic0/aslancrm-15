-- Обновляем функцию notify_task_assignment для вызова edge function отправки Web Push
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_title text;
  v_order_title text;
  v_worker_name text;
  v_supabase_url text;
  v_service_role_key text;
  v_notification_body text;
BEGIN
  -- Получаем название задачи
  v_task_title := NEW.title;
  
  -- Получаем название заказа
  IF NEW.zakaz_id IS NOT NULL THEN
    SELECT title INTO v_order_title
    FROM public.zakazi
    WHERE id_zakaza = NEW.zakaz_id;
  END IF;
  
  -- Получаем имя работника
  IF NEW.responsible_user_id IS NOT NULL THEN
    SELECT full_name INTO v_worker_name
    FROM public.users
    WHERE uuid_user = NEW.responsible_user_id;
  END IF;
  
  -- Формируем текст уведомления
  v_notification_body := COALESCE(
    'Вам назначена задача "' || v_task_title || '"' || 
    CASE 
      WHEN v_order_title IS NOT NULL THEN ' по заказу "' || v_order_title || '"'
      ELSE ''
    END,
    'Вам назначена новая задача'
  );
  
  -- Создаем уведомление для ответственного
  IF NEW.responsible_user_id IS NOT NULL THEN
    -- Создаем запись в таблице notifications (для истории)
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      task_id,
      order_id,
      url
    ) VALUES (
      NEW.responsible_user_id,
      'Новая задача назначена',
      v_notification_body,
      NEW.id_zadachi,
      NEW.zakaz_id,
      '/worker'
    );
    
    -- Вызываем Edge Function для отправки Web Push уведомления
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    v_service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Асинхронный вызов edge function через pg_net
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'userId', NEW.responsible_user_id,
        'title', 'Новая задача назначена',
        'body', v_notification_body,
        'taskId', NEW.id_zadachi,
        'orderId', NEW.zakaz_id,
        'url', '/worker'
      ),
      timeout_milliseconds := 5000
    );
  END IF;
  
  RETURN NEW;
END;
$$;