import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Settings, Workflow, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { StageChainEditor } from '@/components/automation/StageChainEditor';
import { TaskDependencyFlow } from '@/components/automation/TaskDependencyFlow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AutomationSettings = () => {
  const { isLoading, getStagesWithTasks } = useAutomationSettings();
  const stagesWithTasks = getStagesWithTasks();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-2"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Загрузка настроек...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 pt-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Настройки автоматизации
            </h1>
            <p className="text-muted-foreground">
            Управление автоматическим созданием задач при переносе заказов между этапами
          </p>
        </div>
      </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Workflow className="w-5 h-5" />
              <span>Схема автоматизации производства</span>
            </CardTitle>
            <CardDescription>
              Визуальная цепочка этапов с автоматическим переносом заказов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StageChainEditor />
          </CardContent>
        </Card>
      </motion.div>

      {/* Task Dependencies Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Workflow className="w-5 h-5" />
              <span>Детальная схема задач по этапам</span>
            </CardTitle>
            <CardDescription>
              Визуализация зависимостей между задачами на каждом этапе производства
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={stagesWithTasks[0]?.stage_id || ''} className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                {stagesWithTasks.map((stage) => (
                  <TabsTrigger key={stage.stage_id} value={stage.stage_id}>
                    {stage.stage_name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {stagesWithTasks.map((stage) => (
                <TabsContent key={stage.stage_id} value={stage.stage_id} className="mt-6">
                  <TaskDependencyFlow tasks={stage.tasks} />
                </TabsContent>
              ))}

              {stagesWithTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Нет настроенных этапов с задачами</p>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-muted/30 rounded-lg p-4"
      >
        <div className="text-sm text-muted-foreground">
          <h3 className="font-semibold mb-3 text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            Как работает система автоматизации:
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">🎯 Создание задач при переносе этапа:</h4>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li>Создаются только задачи с условием "Запустить сразу" без зависимостей</li>
                <li>Задачи с зависимостями ожидают завершения родительской задачи</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-foreground mb-1">⚡ Последовательное выполнение:</h4>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li>После завершения задачи автоматически создаются все зависимые от неё задачи</li>
                <li>Зависимые задачи создаются сразу после отправки родительской на проверку диспетчеру</li>
                <li>Иконка молнии (⚡) показывает наличие последовательных зависимостей</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">🔄 Переход между этапами:</h4>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li>Заказ переходит на следующий этап только когда ВСЕ задачи текущего этапа завершены</li>
                <li>Система проверяет как выполненные, так и еще не созданные зависимые задачи</li>
                <li>Автоматический переход можно отключить в настройках каждого этапа</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">📝 Дополнительные возможности:</h4>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li>В названия и описания автоматически подставляется информация о заказе</li>
                <li>Срок выполнения рассчитывается от момента создания + указанное количество дней</li>
                <li>Визуализация зависимостей доступна на вкладках с каждым этапом</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AutomationSettings;