-- Этап 1: Добавление системы подтверждения задач диспетчером

-- Добавляем поля для подтверждения задач
ALTER TABLE public.zadachi
ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejection_count integer DEFAULT 0;

-- Комментарии для документации
COMMENT ON COLUMN public.zadachi.confirmed_by IS 'Диспетчер, подтвердивший выполнение задачи';
COMMENT ON COLUMN public.zadachi.confirmed_at IS 'Время подтверждения задачи диспетчером';
COMMENT ON COLUMN public.zadachi.rejection_reason IS 'Причина отклонения задачи (если была отклонена)';
COMMENT ON COLUMN public.zadachi.rejection_count IS 'Количество отклонений задачи';

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_zadachi_confirmed_by ON public.zadachi(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_zadachi_confirmed_at ON public.zadachi(confirmed_at);

-- Функция для подтверждения задачи диспетчером
CREATE OR REPLACE FUNCTION public.confirm_task(
  p_task_id numeric,
  p_dispatcher_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем задачу: подтверждаем и завершаем
  UPDATE public.zadachi
  SET 
    confirmed_by = p_dispatcher_id,
    confirmed_at = now(),
    status = 'completed'::task_status,
    completed_at = COALESCE(completed_at, now()),
    rejection_reason = NULL
  WHERE id_zadachi = p_task_id
    AND dispatcher_id = p_dispatcher_id
    AND status = 'under_review'::task_status;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена или не может быть подтверждена';
  END IF;
END;
$$;

-- Функция для отклонения задачи диспетчером
CREATE OR REPLACE FUNCTION public.reject_task(
  p_task_id numeric,
  p_dispatcher_id uuid,
  p_rejection_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем задачу: отклоняем и возвращаем в работу
  UPDATE public.zadachi
  SET 
    status = 'in_progress'::task_status,
    completed_at = NULL,
    rejection_reason = p_rejection_reason,
    rejection_count = COALESCE(rejection_count, 0) + 1,
    confirmed_by = NULL,
    confirmed_at = NULL
  WHERE id_zadachi = p_task_id
    AND dispatcher_id = p_dispatcher_id
    AND status = 'under_review'::task_status;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена или не может быть отклонена';
  END IF;
END;
$$;

-- Триггер для автоматического вызова создания зависимых задач после подтверждения
CREATE OR REPLACE FUNCTION public.trigger_dependent_tasks_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Проверяем, что задача была подтверждена (confirmed_by изменилось с NULL на значение)
  IF NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL AND NEW.automation_setting_id IS NOT NULL THEN
    
    -- Получаем URL и ключ
    v_supabase_url := 'https://wfygydevhnjnpccowoxw.supabase.co';
    v_service_role_key := current_setting('app.settings.service_role_key', true);
    
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
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Создаём триггер
DROP TRIGGER IF EXISTS on_task_confirmed ON public.zadachi;
CREATE TRIGGER on_task_confirmed
  AFTER UPDATE ON public.zadachi
  FOR EACH ROW
  WHEN (NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL)
  EXECUTE FUNCTION public.trigger_dependent_tasks_on_confirm();

-- Обновляем существующий триггер check_and_move_order_on_task_completion
-- чтобы он НЕ срабатывал при изменении на 'completed', а только при подтверждении
DROP TRIGGER IF EXISTS check_order_completion_on_task_complete ON public.zadachi;
CREATE TRIGGER check_order_completion_on_task_complete
  AFTER UPDATE ON public.zadachi
  FOR EACH ROW
  WHEN (NEW.confirmed_by IS NOT NULL AND OLD.confirmed_by IS NULL)
  EXECUTE FUNCTION public.check_and_move_order_on_task_completion();