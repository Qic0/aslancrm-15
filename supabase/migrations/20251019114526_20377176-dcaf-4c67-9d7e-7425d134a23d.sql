-- Добавляем уведомления при отклонении задачи
CREATE OR REPLACE FUNCTION public.notify_task_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
  v_worker_name text;
  v_supabase_url text;
  v_service_role_key text;
  v_notification_body text;
BEGIN
  -- Проверяем что задача была отклонена (rejection_reason появилось)
  IF NEW.rejection_reason IS NOT NULL AND (OLD.rejection_reason IS NULL OR OLD.rejection_reason != NEW.rejection_reason) THEN
    
    v_task_title := NEW.title;
    
    -- Получаем имя работника
    IF NEW.responsible_user_id IS NOT NULL THEN
      SELECT full_name INTO v_worker_name
      FROM public.users
      WHERE uuid_user = NEW.responsible_user_id;
    END IF;
    
    -- Формируем текст уведомления
    v_notification_body := 'Задача "' || v_task_title || '" возвращена на доработку. Причина: ' || NEW.rejection_reason;
    
    -- Создаем уведомление для работника
    IF NEW.responsible_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        body,
        task_id,
        order_id,
        url
      ) VALUES (
        NEW.responsible_user_id,
        'Задача возвращена на доработку',
        v_notification_body,
        NEW.id_zadachi,
        NEW.zakaz_id,
        '/worker-dashboard'
      );
      
      -- Вызываем Edge Function для отправки Web Push
      v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
      v_service_role_key := current_setting('app.settings.service_role_key', true);
      
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'userId', NEW.responsible_user_id,
          'title', 'Задача возвращена на доработку',
          'body', v_notification_body,
          'taskId', NEW.id_zadachi,
          'orderId', NEW.zakaz_id,
          'url', '/worker-dashboard'
        ),
        timeout_milliseconds := 5000
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Создаём триггер для уведомлений об отклонении
DROP TRIGGER IF EXISTS on_task_rejected ON public.zadachi;
CREATE TRIGGER on_task_rejected
  AFTER UPDATE ON public.zadachi
  FOR EACH ROW
  WHEN (NEW.rejection_reason IS NOT NULL AND (OLD.rejection_reason IS NULL OR OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason))
  EXECUTE FUNCTION public.notify_task_rejection();