import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Circle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AutomationSetting } from '@/hooks/useAutomationSettings';

interface TaskDependencyFlowProps {
  tasks: AutomationSetting[];
  onTaskClick?: (task: AutomationSetting) => void;
}

export const TaskDependencyFlow: React.FC<TaskDependencyFlowProps> = ({ tasks, onTaskClick }) => {
  // Группируем задачи по уровням зависимостей
  const getTaskLevel = (task: AutomationSetting): number => {
    if (!task.depends_on_task_id) return 0;
    
    const parentTask = tasks.find(t => t.id === task.depends_on_task_id);
    if (!parentTask) return 0;
    
    return getTaskLevel(parentTask) + 1;
  };

  // Создаем структуру уровней
  const levels: AutomationSetting[][] = [];
  tasks.forEach(task => {
    const level = getTaskLevel(task);
    if (!levels[level]) levels[level] = [];
    levels[level].push(task);
  });

  // Сортируем задачи в каждом уровне по order_position
  levels.forEach(level => {
    level.sort((a, b) => a.task_order_position - b.task_order_position);
  });

  const getTaskColor = (task: AutomationSetting) => {
    if (task.start_condition === 'immediate') {
      return 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300';
    }
    return 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300';
  };

  const getTaskIcon = (task: AutomationSetting) => {
    if (task.start_condition === 'immediate') {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    return <Circle className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {levels.map((level, levelIndex) => (
        <div key={levelIndex} className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">
              {levelIndex === 0 ? 'Запуск сразу' : `Уровень ${levelIndex}`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {level.map((task, taskIndex) => {
              const parentTask = tasks.find(t => t.id === task.depends_on_task_id);
              
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: levelIndex * 0.1 + taskIndex * 0.05 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${getTaskColor(task)}`}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getTaskIcon(task)}
                          <h4 className="font-semibold text-sm line-clamp-1">
                            {task.task_name}
                          </h4>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {task.task_order_position}
                        </Badge>
                      </div>

                      {parentTask && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ArrowRight className="w-3 h-3" />
                          <span className="line-clamp-1">
                            После: {parentTask.task_name}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {task.duration_days} дн.
                        </span>
                        {task.payment_amount > 0 && (
                          <span className="font-medium">
                            {task.payment_amount} ₽
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {levelIndex < levels.length - 1 && levels[levelIndex + 1].length > 0 && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-8 w-px bg-border" />
                <ArrowRight className="w-4 h-4" />
                <div className="h-8 w-px bg-border" />
              </div>
            </div>
          )}
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Нет настроенных задач для этого этапа</p>
        </div>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground pt-4 border-t">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span>Запуск сразу</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-blue-600" />
          <span>После завершения другой задачи</span>
        </div>
      </div>
    </div>
  );
};
