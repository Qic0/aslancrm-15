-- Allow multiple tasks per stage by removing unique constraint if exists
-- and adding a task_name field to distinguish tasks within same stage

ALTER TABLE automation_settings
ADD COLUMN IF NOT EXISTS task_name TEXT DEFAULT 'Задача 1';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_automation_settings_stage_id 
ON automation_settings(stage_id);

-- Add order_position for tasks within same stage
ALTER TABLE automation_settings
ADD COLUMN IF NOT EXISTS task_order_position INTEGER DEFAULT 1;