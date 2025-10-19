import React from 'react';
import { motion } from 'framer-motion';
import { Settings, GripVertical, ArrowDown, CheckCircle2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StageChainLink } from '@/hooks/useStageChain';
import { StageWithTasks } from '@/hooks/useAutomationSettings';

type StageChainCardProps = {
  link: StageChainLink;
  stageName: string;
  nextStageName?: string;
  stageData?: StageWithTasks;
  onToggle: (id: string, isActive: boolean) => void;
  onSettingsClick: () => void;
  isLast: boolean;
};

export const StageChainCard: React.FC<StageChainCardProps> = ({
  link,
  stageName,
  nextStageName,
  stageData,
  onToggle,
  onSettingsClick,
  isLast,
}) => {
  const tasksCount = stageData?.tasks.length || 0;
  const hasDependencies = stageData?.tasks.some(t => t.depends_on_task_id) || false;

  // Создаем последовательность задач для tooltip
  const getTaskSequence = () => {
    if (!stageData || stageData.tasks.length === 0) return [];
    
    const tasks = [...stageData.tasks].sort((a, b) => a.task_order_position - b.task_order_position);
    const sequence: { name: string; isImmediate: boolean; dependsOn?: string }[] = [];
    
    tasks.forEach(task => {
      const parentTask = tasks.find(t => t.id === task.depends_on_task_id);
      sequence.push({
        name: task.task_name,
        isImmediate: task.start_condition === 'immediate',
        dependsOn: parentTask?.task_name
      });
    });
    
    return sequence;
  };

  const taskSequence = getTaskSequence();

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="w-full"
      >
        <Card
          className={`relative w-full border-2 transition-all cursor-pointer ${
            link.is_active
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30'
          }`}
          onClick={onSettingsClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">
                    {stageName}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {tasksCount} {tasksCount === 1 ? 'задача' : tasksCount < 5 ? 'задачи' : 'задач'}
                    </Badge>
                    {hasDependencies && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center w-4 h-4 bg-amber-500/20 rounded-sm cursor-help">
                              <Zap className="w-3 h-3 text-amber-600" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold text-xs mb-2">Последовательность задач:</p>
                              {taskSequence.map((task, idx) => (
                                <div key={idx} className="text-xs space-y-0.5">
                                  <div className="flex items-start gap-2">
                                    <span className="font-medium text-muted-foreground shrink-0">
                                      {idx + 1}.
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">{task.name}</span>
                                        {task.isImmediate && (
                                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                                        )}
                                      </div>
                                      {task.dependsOn && (
                                        <div className="text-muted-foreground text-[10px] mt-0.5">
                                          ↳ После: {task.dependsOn}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettingsClick();
                }}
                className="h-6 w-6 shrink-0"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </div>

            {stageData && stageData.tasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {stageData.tasks.slice(0, 3).map((task, index) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground p-1.5 rounded bg-background/50"
                  >
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{task.task_name}</span>
                  </div>
                ))}
                {stageData.tasks.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    + еще {stageData.tasks.length - 3}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Автоматический переход
              </span>
              <Switch
                checked={link.is_active}
                onCheckedChange={(checked) => {
                  onToggle(link.id, checked);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {link.is_active && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 pt-2 border-t border-border"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-primary">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Активно</span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {!isLast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-1 py-1.5"
        >
          <ArrowDown
            className={`w-5 h-5 ${
              link.is_active ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
          {nextStageName && (
            <span className="text-[10px] text-muted-foreground text-center">
              {nextStageName}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
};
