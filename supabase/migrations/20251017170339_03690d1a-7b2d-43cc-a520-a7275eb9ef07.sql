-- Remove unique constraint on stage_id to allow multiple tasks per stage
ALTER TABLE automation_settings
DROP CONSTRAINT IF EXISTS automation_settings_stage_id_key;

-- Add unique constraint on combination of stage_id and task_order_position instead
ALTER TABLE automation_settings
ADD CONSTRAINT automation_settings_stage_task_unique 
UNIQUE (stage_id, task_order_position);