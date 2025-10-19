-- Исправляем логику автоматизации: проверка завершения этапа должна быть ПОСЛЕ создания зависимых задач

-- 1. Удаляем триггер, который срабатывает слишком рано
DROP TRIGGER IF EXISTS check_and_move_order_on_task_completion_trigger ON zadachi;

-- 2. Пересоздаем триггер, но теперь он срабатывает только при подтверждении диспетчером
-- Это гарантирует, что сначала создадутся зависимые задачи, а потом проверится завершение этапа
CREATE TRIGGER check_stage_after_confirmation_trigger
  AFTER UPDATE OF confirmed_by ON zadachi
  FOR EACH ROW
  WHEN (NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL)
  EXECUTE FUNCTION check_and_move_order_on_task_completion();

-- 3. Обновляем функцию trigger_dependent_tasks_on_confirm для правильной последовательности
-- Сначала создаются зависимые задачи, потом проверяется завершение этапа
DROP FUNCTION IF EXISTS trigger_dependent_tasks_on_confirm() CASCADE;

CREATE OR REPLACE FUNCTION trigger_dependent_tasks_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что задача была подтверждена (confirmed_by изменилось с NULL на значение)
  IF NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL AND NEW.automation_setting_id IS NOT NULL THEN
    
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeWd5ZGV2aG5qbnBjY293b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODg0ODUsImV4cCI6MjA3Mzc2NDQ4NX0.z4tQvntSfvsbROFsrQJP3K-avujOBGr1XtaW8fjbj1U';
    
    -- Вызываем Edge Function для создания зависимых задач
    -- create-dependent-tasks САМ вызовет check-stage-completion в конце
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
    
    RAISE LOG 'Triggered dependent tasks creation for task % with automation_setting_id %', 
      NEW.id_zadachi, NEW.automation_setting_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Создаем триггер для вызова функции создания зависимых задач
DROP TRIGGER IF EXISTS trigger_dependent_tasks_on_confirm_trigger ON zadachi;

CREATE TRIGGER trigger_dependent_tasks_on_confirm_trigger
  AFTER UPDATE OF confirmed_by ON zadachi
  FOR EACH ROW
  WHEN (NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL)
  EXECUTE FUNCTION trigger_dependent_tasks_on_confirm();

-- Логирование для отладки
COMMENT ON TRIGGER trigger_dependent_tasks_on_confirm_trigger ON zadachi IS 
  'Создает зависимые задачи после подтверждения диспетчером. create-dependent-tasks сам вызовет check-stage-completion.';

COMMENT ON TRIGGER check_stage_after_confirmation_trigger ON zadachi IS 
  'Проверяет завершение этапа после подтверждения задачи. Срабатывает после создания зависимых задач.';