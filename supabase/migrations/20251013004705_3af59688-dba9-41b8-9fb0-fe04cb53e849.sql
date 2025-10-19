-- Включаем расширение pg_net для HTTP запросов
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Функция для вызова Edge Function при завершении задачи
CREATE OR REPLACE FUNCTION check_and_move_order_on_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что статус изменился на 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Получаем URL и ключ из переменных окружения
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    v_service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Вызываем Edge Function асинхронно через pg_net
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/check-stage-completion',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'order_id', NEW.zakaz_id
      ),
      timeout_milliseconds := 10000
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Создаем триггер на таблице zadachi
DROP TRIGGER IF EXISTS trigger_check_stage_completion ON public.zadachi;
CREATE TRIGGER trigger_check_stage_completion
  AFTER UPDATE ON public.zadachi
  FOR EACH ROW
  EXECUTE FUNCTION check_and_move_order_on_task_completion();