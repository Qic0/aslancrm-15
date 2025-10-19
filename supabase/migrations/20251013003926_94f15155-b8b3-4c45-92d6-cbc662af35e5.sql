-- Создаем таблицу для хранения цепочки автоматизации этапов
CREATE TABLE IF NOT EXISTS public.stage_automation_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id TEXT NOT NULL,
  to_stage_id TEXT,  -- NULL означает конечный этап
  order_position INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.stage_automation_chain ENABLE ROW LEVEL SECURITY;

-- Политики доступа: только админы могут управлять цепочкой
CREATE POLICY "Admins can view stage automation chain"
  ON public.stage_automation_chain
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uuid_user = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage stage automation chain"
  ON public.stage_automation_chain
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uuid_user = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uuid_user = auth.uid()
      AND role = 'admin'
    )
  );

-- Заполняем начальными данными - линейная цепочка этапов
INSERT INTO public.stage_automation_chain (from_stage_id, to_stage_id, order_position, is_active)
VALUES 
  ('cutting', 'edging', 1, true),
  ('edging', 'drilling', 2, true),
  ('drilling', 'sanding', 3, true),
  ('sanding', 'priming', 4, true),
  ('priming', 'painting', 5, true),
  ('painting', NULL, 6, true)  -- конечный этап
ON CONFLICT DO NOTHING;

-- Создаем индекс для быстрой проверки завершения задач
CREATE INDEX IF NOT EXISTS idx_zadachi_zakaz_status ON public.zadachi(zakaz_id, status);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_stage_chain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_stage_automation_chain_updated_at
  BEFORE UPDATE ON public.stage_automation_chain
  FOR EACH ROW
  EXECUTE FUNCTION update_stage_chain_updated_at();