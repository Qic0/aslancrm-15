-- Добавить поле stage_id в таблицу zadachi
ALTER TABLE public.zadachi 
ADD COLUMN stage_id text;

-- Добавить индекс для лучшей производительности при фильтрации
CREATE INDEX idx_zadachi_stage_id ON public.zadachi(stage_id);

-- Добавить комментарий
COMMENT ON COLUMN public.zadachi.stage_id IS 'ID этапа, на котором была создана задача';