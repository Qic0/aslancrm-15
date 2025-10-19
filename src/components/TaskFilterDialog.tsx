import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type TaskFilters = {
  statuses: string[];
  taskTypes: string[];
  stages: string[];
  workers: string[];
};

type TaskFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Ожидает" },
  { value: "in_progress", label: "В работе" },
  { value: "under_review", label: "На проверке" },
  { value: "completed", label: "Завершено" },
];

const TASK_TYPE_OPTIONS = [
  { value: "overdue", label: "Просроченные" },
  { value: "completed_on_time", label: "Завершенные в срок" },
];

export const TaskFilterDialog = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
}: TaskFilterDialogProps) => {
  const [localFilters, setLocalFilters] = useState<TaskFilters>(filters);

  // Загружаем этапы из automation_settings
  const { data: stages } = useQuery({
    queryKey: ['automation-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('stage_id, stage_name')
        .order('stage_id');
      
      if (error) throw error;
      
      // Убираем дубликаты по stage_id
      const uniqueStages = Array.from(
        new Map(data.map(item => [item.stage_id, item])).values()
      );
      
      return uniqueStages;
    }
  });

  // Загружаем работников
  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('uuid_user, full_name, role')
        .order('full_name');
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleStatusToggle = (status: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  const handleTaskTypeToggle = (taskType: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      taskTypes: prev.taskTypes.includes(taskType)
        ? prev.taskTypes.filter((t) => t !== taskType)
        : [...prev.taskTypes, taskType],
    }));
  };

  const handleStageToggle = (stageId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      stages: prev.stages.includes(stageId)
        ? prev.stages.filter((s) => s !== stageId)
        : [...prev.stages, stageId],
    }));
  };

  const handleWorkerToggle = (workerId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      workers: prev.workers.includes(workerId)
        ? prev.workers.filter((w) => w !== workerId)
        : [...prev.workers, workerId],
    }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters = { statuses: [], taskTypes: [], stages: [], workers: [] };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Фильтры задач</DialogTitle>
          <DialogDescription>
            Выберите статусы и стадии для фильтрации задач
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-6">
            {/* Фильтр по статусам */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Статус задачи</h4>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={localFilters.statuses.includes(option.value)}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <Label
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Фильтр по типу задач */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Тип задач</h4>
              <div className="space-y-2">
                {TASK_TYPE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tasktype-${option.value}`}
                      checked={localFilters.taskTypes.includes(option.value)}
                      onCheckedChange={() => handleTaskTypeToggle(option.value)}
                    />
                    <Label
                      htmlFor={`tasktype-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Фильтр по этапам */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Этапы производства</h4>
              <div className="space-y-2">
                {stages?.map((stage) => (
                  <div key={stage.stage_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stage-${stage.stage_id}`}
                      checked={localFilters.stages.includes(stage.stage_id)}
                      onCheckedChange={() => handleStageToggle(stage.stage_id)}
                    />
                    <Label
                      htmlFor={`stage-${stage.stage_id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {stage.stage_name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Фильтр по работникам */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Работники</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {workers?.map((worker) => (
                  <div key={worker.uuid_user} className="flex items-center space-x-2">
                    <Checkbox
                      id={`worker-${worker.uuid_user}`}
                      checked={localFilters.workers.includes(worker.uuid_user)}
                      onCheckedChange={() => handleWorkerToggle(worker.uuid_user)}
                    />
                    <Label
                      htmlFor={`worker-${worker.uuid_user}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {worker.full_name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-between gap-3 pt-4">
          <Button variant="outline" onClick={handleReset}>
            Сбросить
          </Button>
          <Button onClick={handleApply}>Применить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
