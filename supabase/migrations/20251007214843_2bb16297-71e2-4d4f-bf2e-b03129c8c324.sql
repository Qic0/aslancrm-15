-- Fix remove_task_from_completed to properly adjust salary when task is deleted
CREATE OR REPLACE FUNCTION public.remove_task_from_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_record RECORD;
  v_task jsonb;
  v_payment numeric;
  v_has_penalty boolean;
  v_salary_adjustment numeric;
BEGIN
  -- Обрабатываем всех пользователей, у которых есть эта задача
  FOR v_user_record IN 
    SELECT uuid_user, salary, completed_tasks
    FROM public.users
    WHERE EXISTS (
      SELECT 1
      FROM unnest(completed_tasks) AS task
      WHERE (task->>'task_id')::numeric = OLD.id_zadachi
    )
  LOOP
    -- Находим задачу в completed_tasks этого пользователя
    SELECT task INTO v_task
    FROM unnest(v_user_record.completed_tasks) AS task
    WHERE (task->>'task_id')::numeric = OLD.id_zadachi
    LIMIT 1;
    
    IF v_task IS NOT NULL THEN
      v_payment := (v_task->>'payment')::numeric;
      v_has_penalty := COALESCE((v_task->>'has_penalty')::boolean, false);
      
      -- Расчет корректировки salary:
      -- Если штрафа не было: вычитаем payment (откатываем начисление)
      -- Если штраф был: добавляем payment (откатываем штраф)
      IF v_has_penalty THEN
        v_salary_adjustment := v_payment;
      ELSE
        v_salary_adjustment := -v_payment;
      END IF;
      
      -- Обновляем пользователя
      UPDATE public.users
      SET 
        completed_tasks = (
          SELECT array_agg(task)
          FROM unnest(v_user_record.completed_tasks) AS task
          WHERE (task->>'task_id')::numeric != OLD.id_zadachi
        ),
        salary = COALESCE(v_user_record.salary, 0) + v_salary_adjustment,
        updated_at = now()
      WHERE uuid_user = v_user_record.uuid_user;
    END IF;
  END LOOP;
  
  RETURN OLD;
END;
$function$;