-- Создаем триггеры для автоматизации задач

-- 1. Триггер для создания зависимых задач после подтверждения диспетчером
DROP TRIGGER IF EXISTS trigger_dependent_tasks_on_confirm ON zadachi;
CREATE TRIGGER trigger_dependent_tasks_on_confirm
  AFTER UPDATE ON zadachi
  FOR EACH ROW
  WHEN (
    NEW.confirmed_by IS NOT NULL AND 
    OLD.confirmed_by IS NULL AND 
    NEW.automation_setting_id IS NOT NULL
  )
  EXECUTE FUNCTION trigger_dependent_tasks_on_confirm();

-- 2. Триггер для проверки завершения этапа и автоматического перехода заказа
DROP TRIGGER IF EXISTS check_and_move_order_on_task_completion ON zadachi;
CREATE TRIGGER check_and_move_order_on_task_completion
  AFTER UPDATE ON zadachi
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' AND 
    (OLD.status IS NULL OR OLD.status != 'completed')
  )
  EXECUTE FUNCTION check_and_move_order_on_task_completion();

-- 3. Обновляем функцию trigger_dependent_tasks_on_confirm для правильного получения ключа
CREATE OR REPLACE FUNCTION public.trigger_dependent_tasks_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что задача была подтверждена (confirmed_by изменилось с NULL на значение)
  IF NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL AND NEW.automation_setting_id IS NOT NULL THEN
    
    -- Получаем URL и ключ напрямую (они доступны через переменные окружения в Supabase)
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    -- Используем встроенную функцию Supabase для получения service role key
    v_service_role_key := current_setting('request.jwt.claims', true)::json->>'role';
    
    -- Если role не найден, используем сервисный ключ из секретов
    IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
      -- Для внутренних триггеров используем pg_net с anon key, 
      -- а сама edge function использует service role
      v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeWd5ZGV2aG5qbnBjY293b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODg0ODUsImV4cCI6MjA3Mzc2NDQ4NX0.z4tQvntSfvsbROFsrQJP3K-avujOBGr1XtaW8fjbj1U';
    END IF;
    
    -- Вызываем Edge Function для создания зависимых задач
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-dependent-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'completed_task_id', NEW.id_zadachi,
        'automation_setting_id', NEW.automation_setting_id
      ),
      timeout_milliseconds := 10000
    );
    
    -- Логирование для отладки
    RAISE LOG 'Triggered dependent tasks creation for task % with automation_setting_id %', 
      NEW.id_zadachi, NEW.automation_setting_id;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Обновляем функцию check_and_move_order_on_task_completion
CREATE OR REPLACE FUNCTION public.check_and_move_order_on_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что статус изменился на 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Получаем URL и ключ
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    -- Используем anon key для вызова edge function (edge function сам использует service role)
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeWd5ZGV2aG5qbnBjY293b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODg0ODUsImV4cCI6MjA3Mzc2NDQ4NX0.z4tQvntSfvsbROFsrQJP3K-avujOBGr1XtaW8fjbj1U';
    
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
    
    -- Логирование для отладки
    RAISE LOG 'Triggered stage completion check for order %', NEW.zakaz_id;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Создаем индексы для оптимизации запросов триггеров
CREATE INDEX IF NOT EXISTS idx_zadachi_automation_setting_id ON zadachi(automation_setting_id) WHERE automation_setting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zadachi_zakaz_stage ON zadachi(zakaz_id, stage_id, status);
CREATE INDEX IF NOT EXISTS idx_automation_settings_depends_on ON automation_settings(depends_on_task_id) WHERE depends_on_task_id IS NOT NULL;