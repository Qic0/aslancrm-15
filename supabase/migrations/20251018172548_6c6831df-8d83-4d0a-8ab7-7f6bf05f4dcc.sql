-- Добавляем поля для системы зависимостей задач в automation_settings
ALTER TABLE automation_settings 
ADD COLUMN start_condition TEXT DEFAULT 'immediate' CHECK (start_condition IN ('immediate', 'after_task')),
ADD COLUMN depends_on_task_id UUID REFERENCES automation_settings(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска зависимых задач
CREATE INDEX idx_automation_settings_depends_on ON automation_settings(depends_on_task_id) WHERE depends_on_task_id IS NOT NULL;

-- Добавляем комментарии для документации
COMMENT ON COLUMN automation_settings.start_condition IS 'Условие запуска задачи: immediate (сразу при переходе на этап) или after_task (после завершения другой задачи)';
COMMENT ON COLUMN automation_settings.depends_on_task_id IS 'ID задачи из automation_settings, после завершения которой должна запуститься текущая задача';

-- Функция для проверки циклических зависимостей
CREATE OR REPLACE FUNCTION check_task_dependency_cycle(
  p_task_id UUID,
  p_depends_on_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_id UUID;
  v_visited UUID[];
BEGIN
  -- Если зависимость не указана, цикла нет
  IF p_depends_on_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Проверяем, не зависит ли задача сама от себя
  IF p_task_id = p_depends_on_id THEN
    RETURN TRUE;
  END IF;
  
  -- Проходим по цепочке зависимостей
  v_current_id := p_depends_on_id;
  v_visited := ARRAY[p_task_id];
  
  WHILE v_current_id IS NOT NULL LOOP
    -- Если встретили задачу повторно, найден цикл
    IF v_current_id = ANY(v_visited) THEN
      RETURN TRUE;
    END IF;
    
    -- Добавляем в посещенные
    v_visited := array_append(v_visited, v_current_id);
    
    -- Получаем следующую зависимость
    SELECT depends_on_task_id INTO v_current_id
    FROM automation_settings
    WHERE id = v_current_id;
  END LOOP;
  
  RETURN FALSE;
END;
$$;

-- Триггер для проверки циклических зависимостей перед вставкой/обновлением
CREATE OR REPLACE FUNCTION validate_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Проверяем только если установлена зависимость
  IF NEW.depends_on_task_id IS NOT NULL THEN
    -- Проверяем, что зависимость на том же этапе
    IF NOT EXISTS (
      SELECT 1 FROM automation_settings
      WHERE id = NEW.depends_on_task_id
      AND stage_id = NEW.stage_id
    ) THEN
      RAISE EXCEPTION 'Задача может зависеть только от задачи на том же этапе';
    END IF;
    
    -- Проверяем на циклические зависимости
    IF check_task_dependency_cycle(NEW.id, NEW.depends_on_task_id) THEN
      RAISE EXCEPTION 'Обнаружена циклическая зависимость задач';
    END IF;
    
    -- Если указана зависимость, start_condition должен быть 'after_task'
    IF NEW.start_condition != 'after_task' THEN
      NEW.start_condition := 'after_task';
    END IF;
  ELSE
    -- Если зависимости нет, start_condition должен быть 'immediate'
    IF NEW.start_condition = 'after_task' THEN
      NEW.start_condition := 'immediate';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_dependency_trigger
BEFORE INSERT OR UPDATE ON automation_settings
FOR EACH ROW
EXECUTE FUNCTION validate_task_dependency();

-- Функция для получения всех immediate задач этапа
CREATE OR REPLACE FUNCTION get_immediate_tasks_for_stage(p_stage_id TEXT)
RETURNS SETOF automation_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM automation_settings
  WHERE stage_id = p_stage_id
  AND start_condition = 'immediate'
  ORDER BY task_order_position;
$$;

-- Функция для получения задач, зависимых от конкретной задачи
CREATE OR REPLACE FUNCTION get_dependent_tasks(p_automation_setting_id UUID)
RETURNS SETOF automation_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM automation_settings
  WHERE depends_on_task_id = p_automation_setting_id
  ORDER BY task_order_position;
$$;