-- Шаг 1: Удалить существующие триггеры, которые вызывают дублирование
DROP TRIGGER IF EXISTS trigger_dependent_tasks_on_confirm_trigger ON public.zadachi;
DROP TRIGGER IF EXISTS check_stage_after_confirmation_trigger ON public.zadachi;

-- Создать новую функцию для триггера на status='completed'
CREATE OR REPLACE FUNCTION public.trigger_dependent_tasks_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что статус изменился на 'completed' и есть automation_setting_id
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.automation_setting_id IS NOT NULL THEN
    
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeWd5ZGV2aG5qbnBjY293b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODg0ODUsImV4cCI6MjA3Mzc2NDQ4NX0.z4tQvntSfvsbROFsrQJP3K-avujOBGr1XtaW8fjbj1U';
    
    -- Вызываем ТОЛЬКО create-dependent-tasks
    -- create-dependent-tasks САМ решит, нужно ли вызывать check-stage-completion
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
$function$;

-- Создать новый триггер на изменение status
CREATE TRIGGER trigger_create_dependent_on_status_complete
  AFTER UPDATE OF status ON public.zadachi
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.automation_setting_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_dependent_tasks_on_complete();

-- Шаг 3: Создать вспомогательную функцию для advisory lock
CREATE OR REPLACE FUNCTION public.pg_try_advisory_xact_lock(lock_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN pg_try_advisory_xact_lock(lock_id);
END;
$$;

-- Добавить комментарии для понимания
COMMENT ON FUNCTION public.trigger_dependent_tasks_on_complete IS 'Triggers dependent tasks creation when a task is completed. Only calls create-dependent-tasks, which then decides if check-stage-completion is needed.';
COMMENT ON FUNCTION public.pg_try_advisory_xact_lock IS 'Wrapper for PostgreSQL advisory lock to prevent race conditions in edge functions.';