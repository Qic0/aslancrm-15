-- Добавляем RLS политику для создания уведомлений через триггер
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Создаем функцию для отправки уведомления при создании задачи
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
  
  -- Создаем уведомление для ответственного
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
      'Новая задача назначена',
      COALESCE(
        'Вам назначена задача "' || v_task_title || '"' || 
        CASE 
          WHEN v_order_title IS NOT NULL THEN ' по заказу "' || v_order_title || '"'
          ELSE ''
        END,
        'Вам назначена новая задача'
      ),
      NEW.id_zadachi,
      NEW.zakaz_id,
      '/worker'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Создаем триггер на INSERT в таблицу zadachi
DROP TRIGGER IF EXISTS trigger_notify_task_assignment ON public.zadachi;
CREATE TRIGGER trigger_notify_task_assignment
AFTER INSERT ON public.zadachi
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assignment();