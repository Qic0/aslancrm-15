import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Workflow, 
  Loader2,
  FileText,
  Database
} from 'lucide-react';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { useStageChain } from '@/hooks/useStageChain';

const AutomationAudit = () => {
  const { settings, isLoading: settingsLoading } = useAutomationSettings();
  const { chain, isLoading: chainLoading } = useStageChain();

  // Получаем статистику по задачам
  const { data: tasksStats, isLoading: statsLoading } = useQuery({
    queryKey: ['tasks-automation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zadachi')
        .select('automation_setting_id, confirmed_by, confirmed_at, rejection_count, status, stage_id')
        .not('automation_setting_id', 'is', null);
      
      if (error) throw error;
      return data;
    }
  });

  const isLoading = settingsLoading || chainLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-2"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Загрузка аудита...</span>
        </motion.div>
      </div>
    );
  }

  // Анализ зависимостей
  const tasksWithDependencies = settings.filter(s => s.depends_on_task_id);
  const immediateTasks = settings.filter(s => s.start_condition === 'immediate' || !s.start_condition);
  const afterTaskTasks = settings.filter(s => s.start_condition === 'after_task');

  // Анализ активных этапов
  const activeStages = chain.filter(link => link.is_active);
  const inactiveStages = chain.filter(link => !link.is_active);

  // Статистика по задачам
  const confirmedTasks = tasksStats?.filter(t => t.confirmed_by) || [];
  const rejectedTasks = tasksStats?.filter(t => (t.rejection_count || 0) > 0) || [];
  const pendingReviewTasks = tasksStats?.filter(t => t.status === 'under_review' && !t.confirmed_by) || [];

  return (
    <div className="container mx-auto p-6 space-y-6 pt-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Аудит системы автоматизации
            </h1>
            <p className="text-muted-foreground">
              Отчет о текущем состоянии и статистике автоматизации задач
            </p>
          </div>
        </div>
      </motion.div>

      {/* Общая статистика */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Общая статистика</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Workflow className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{settings.length}</p>
                  <p className="text-sm text-muted-foreground">Всего задач в схемах</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{activeStages.length}</p>
                  <p className="text-sm text-muted-foreground">Активных этапов</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">{tasksWithDependencies.length}</p>
                  <p className="text-sm text-muted-foreground">Задач с зависимостями</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Анализ типов создания задач */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Распределение по типам создания</CardTitle>
            <CardDescription>
              Какие задачи создаются сразу, а какие ждут выполнения других
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  immediate
                </Badge>
                <span className="text-sm">Создаются сразу при переносе на этап</span>
              </div>
              <span className="font-bold text-lg">{immediateTasks.length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  after_task
                </Badge>
                <span className="text-sm">Создаются после завершения другой задачи</span>
              </div>
              <span className="font-bold text-lg">{afterTaskTasks.length}</span>
            </div>

            <Separator />

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600" />
                Важно
              </h4>
              <p className="text-sm text-muted-foreground">
                После миграции системы: зависимые задачи (after_task) создаются только после 
                <strong className="text-foreground"> подтверждения диспетчером</strong>, а не просто при завершении работником.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Статистика выполнения */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Статистика выполнения (задачи с автоматизацией)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Подтверждено</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{confirmedTasks.length}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">На проверке</span>
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold">{pendingReviewTasks.length}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Отклонено</span>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold">{rejectedTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Список задач с зависимостями */}
      {tasksWithDependencies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Задачи с зависимостями</CardTitle>
              <CardDescription>
                Эти задачи создаются только после подтверждения предыдущих
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasksWithDependencies.map((task) => {
                  const dependsOn = settings.find(s => s.id === task.depends_on_task_id);
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{task.stage_name}</Badge>
                          <span className="font-medium">{task.task_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>→</span>
                          <span>Зависит от:</span>
                          <strong className="text-foreground">
                            {dependsOn?.task_name || 'Удаленная задача'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Рекомендации */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-muted/30 rounded-lg p-4"
      >
        <div className="text-sm text-muted-foreground">
          <h3 className="font-semibold mb-3 text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Этап 1 миграции завершен:
          </h3>
          <ul className="space-y-2 list-disc list-inside ml-2">
            <li>✅ Добавлены поля подтверждения задач (confirmed_by, confirmed_at)</li>
            <li>✅ Зависимые задачи создаются только после подтверждения диспетчером</li>
            <li>✅ Функции БД: confirm_task(), reject_task()</li>
            <li>✅ UI для подтверждения/отклонения обновлен</li>
          </ul>
          <Separator className="my-3" />
          <h3 className="font-semibold mb-2 text-foreground">Следующие этапы (опционально):</h3>
          <ul className="space-y-1 list-disc list-inside ml-2">
            <li>Этап 2: Расширенные типы условий (after_all_previous_finished, time_delay)</li>
            <li>Этап 3: Таблица audit logging для истории</li>
            <li>Этап 4: Визуализация ожидающих задач, force-create override</li>
            <li>Этап 5: Unit/integration тесты</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default AutomationAudit;
