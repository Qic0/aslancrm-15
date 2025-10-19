import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Trash2, User, UserCog, DollarSign, Calendar, FileText, Info, Workflow } from 'lucide-react';
import { AutomationSetting, useAutomationSettings } from '@/hooks/useAutomationSettings';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type StageSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string | null;
  stageName: string;
};

export const StageSettingsDialog: React.FC<StageSettingsDialogProps> = ({
  open,
  onOpenChange,
  stageId,
  stageName,
}) => {
  const { settings, isLoading, updateSettings, createTask, deleteTask, isUpdating, isCreating, isDeleting } = useAutomationSettings();
  const [localTasks, setLocalTasks] = useState<AutomationSetting[]>([]);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const { toast } = useToast();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('uuid_user, full_name, role')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stageId && settings.length > 0) {
      const stageTasks = settings.filter(s => s.stage_id === stageId);
      if (stageTasks.length > 0) {
        setLocalTasks(stageTasks);
        setSelectedTaskIndex(0);
      } else {
        setLocalTasks([]);
      }
    }
  }, [stageId, settings]);

  const handleSave = () => {
    if (localTasks.length === 0) return;

    // Validate all tasks
    const invalidTasks = localTasks.filter(task => {
      return !task.task_name?.trim() || 
             !task.duration_days || 
             task.duration_days < 1 ||
             task.payment_amount === null || 
             task.payment_amount === undefined ||
             task.payment_amount < 0;
    });

    if (invalidTasks.length > 0) {
      toast({
        title: "Ошибка валидации",
        description: "Все поля задачи обязательны для заполнения. Проверьте название, длительность и оплату.",
        variant: "destructive",
      });
      return;
    }

    updateSettings(localTasks);
    onOpenChange(false);
  };

  const handleAddTask = () => {
    if (!stageId) return;
    
    const newTask = {
      stage_id: stageId,
      stage_name: stageName,
      task_name: `Задача ${localTasks.length + 1}`,
      task_order_position: localTasks.length + 1,
      responsible_user_id: null,
      dispatcher_id: null,
      dispatcher_percentage: 0,
      task_title_template: '',
      task_description_template: '',
      payment_amount: 0,
      duration_days: 1,
    };

    createTask(newTask);
  };

  const handleDeleteTask = (taskId: string) => {
    if (localTasks.length === 1) {
      return; // Don't delete last task
    }
    deleteTask(taskId);
    if (selectedTaskIndex >= localTasks.length - 1) {
      setSelectedTaskIndex(Math.max(0, localTasks.length - 2));
    }
  };

  const handleTaskChange = (index: number, updates: Partial<AutomationSetting>) => {
    const newTasks = [...localTasks];
    newTasks[index] = { ...newTasks[index], ...updates };
    setLocalTasks(newTasks);
  };

  const roleLabels: Record<string, string> = {
    'admin': 'Администратор',
    'manager': 'Менеджер',
    'dispatcher': 'Диспетчер',
    'edger': 'Кромление',
    'otk': 'ОТК',
    'packer': 'Упаковщик',
    'painter': 'Маляр',
    'grinder': 'Шлифовка',
    'additive': 'Присадка',
    'sawyer': 'Распил',
  };

  const workers = users.filter(u => !['admin', 'manager', 'dispatcher'].includes(u.role));
  const dispatchers = users.filter(u => u.role === 'dispatcher');

  const selectedTask = localTasks[selectedTaskIndex];

  if (isLoading || !stageId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Настройки этапа: {stageName}</DialogTitle>
          <DialogDescription>
            Управляйте задачами для этого этапа производства
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[240px_1fr] gap-6 py-4 flex-1 min-h-0 overflow-hidden">
          {/* Task List Sidebar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Задачи этапа</h4>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleAddTask}
                disabled={isCreating}
                className="h-7 w-7"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {localTasks.map((task, index) => (
                  <Card
                    key={task.id}
                    className={`cursor-pointer transition-all ${
                      selectedTaskIndex === index
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedTaskIndex(index)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.task_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.payment_amount}₽ • {task.duration_days}д
                          </p>
                        </div>
                        {localTasks.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Task Details */}
          {selectedTask && (
            <ScrollArea className="h-full">
              <div className="space-y-6 pr-4">
                {/* Basic Info Card */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Основная информация
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="task_name" className="text-sm font-medium">
                        Название задачи
                      </Label>
                      <Input
                        id="task_name"
                        value={selectedTask.task_name}
                        onChange={(e) =>
                          handleTaskChange(selectedTaskIndex, { task_name: e.target.value })
                        }
                        placeholder="Например: Распил деталей"
                        className="bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <Label htmlFor="duration" className="text-sm font-medium">
                          Длительность выполнения
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="duration"
                          type="number"
                          min="1"
                          value={selectedTask.duration_days}
                          onChange={(e) =>
                            handleTaskChange(selectedTaskIndex, {
                              duration_days: Number(e.target.value),
                            })
                          }
                          className="bg-background"
                        />
                        <Badge variant="secondary">дней</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Task Dependency Card */}
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Workflow className="w-4 h-4" />
                      Условие запуска задачи
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <RadioGroup
                        value={selectedTask.start_condition || 'immediate'}
                        onValueChange={(value: 'immediate' | 'after_task') =>
                          handleTaskChange(selectedTaskIndex, {
                            start_condition: value,
                            depends_on_task_id: value === 'immediate' ? null : selectedTask.depends_on_task_id,
                          })
                        }
                      >
                        <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="immediate" id="immediate" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="immediate" className="text-sm font-medium cursor-pointer">
                              Запустить сразу
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Задача создается автоматически при переходе заказа на этот этап
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="after_task" id="after_task" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="after_task" className="text-sm font-medium cursor-pointer">
                              После завершения другой задачи
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Задача создается только после завершения выбранной задачи
                            </p>
                          </div>
                        </div>
                      </RadioGroup>

                      {selectedTask.start_condition === 'after_task' && (
                        <div className="space-y-2 pl-6 animate-in fade-in slide-in-from-top-2">
                          <Label htmlFor="depends_on" className="text-sm font-medium">
                            Зависит от задачи
                          </Label>
                          <Select
                            value={selectedTask.depends_on_task_id || 'none'}
                            onValueChange={(value) =>
                              handleTaskChange(selectedTaskIndex, {
                                depends_on_task_id: value === 'none' ? null : value,
                              })
                            }
                          >
                            <SelectTrigger id="depends_on" className="bg-background">
                              <SelectValue placeholder="Выберите задачу" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Не выбрана</span>
                              </SelectItem>
                              {localTasks
                                .filter((task, idx) => {
                                  // Не показываем текущую задачу
                                  if (idx === selectedTaskIndex) return false;
                                  // Не показываем задачи, которые зависят от текущей (предотвращаем циклы)
                                  if (task.depends_on_task_id === selectedTask.id) return false;
                                  return true;
                                })
                                .map((task) => (
                                  <SelectItem key={task.id} value={task.id}>
                                    {task.task_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {selectedTask.depends_on_task_id && !localTasks.find(t => t.id === selectedTask.depends_on_task_id) && (
                            <p className="text-xs text-destructive">
                              ⚠️ Выбранная задача не найдена
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Worker Assignment Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Исполнитель и оплата
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-[1fr_140px] gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="responsible" className="text-sm font-medium">
                          Ответственный работник
                        </Label>
                        <Select
                          value={selectedTask.responsible_user_id || 'none'}
                          onValueChange={(value) =>
                            handleTaskChange(selectedTaskIndex, {
                              responsible_user_id: value === 'none' ? null : value,
                            })
                          }
                        >
                          <SelectTrigger id="responsible" className="bg-background">
                            <SelectValue placeholder="Выберите работника" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Не выбран</span>
                            </SelectItem>
                            {workers.map((worker) => (
                              <SelectItem key={worker.uuid_user} value={worker.uuid_user}>
                                {worker.full_name} ({roleLabels[worker.role] || worker.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment" className="text-sm font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Оплата
                        </Label>
                        <div className="relative">
                          <Input
                            id="payment"
                            type="number"
                            min="0"
                            step="0.01"
                            value={selectedTask.payment_amount}
                            onChange={(e) =>
                              handleTaskChange(selectedTaskIndex, {
                                payment_amount: Number(e.target.value),
                              })
                            }
                            className="bg-background pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dispatcher Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCog className="w-4 h-4" />
                      Контроль диспетчера
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-[1fr_140px] gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dispatcher" className="text-sm font-medium">
                          Диспетчер
                        </Label>
                        <Select
                          value={selectedTask.dispatcher_id || 'none'}
                          onValueChange={(value) =>
                            handleTaskChange(selectedTaskIndex, {
                              dispatcher_id: value === 'none' ? null : value,
                            })
                          }
                        >
                          <SelectTrigger id="dispatcher" className="bg-background">
                            <SelectValue placeholder="Выберите диспетчера" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Не выбран</span>
                            </SelectItem>
                            {dispatchers.map((dispatcher) => (
                              <SelectItem key={dispatcher.uuid_user} value={dispatcher.uuid_user}>
                                {dispatcher.full_name} ({roleLabels[dispatcher.role] || dispatcher.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dispatcher_percentage" className="text-sm font-medium">
                          Процент
                        </Label>
                        <div className="relative">
                          <Input
                            id="dispatcher_percentage"
                            type="number"
                            min="0"
                            max="100"
                            value={selectedTask.dispatcher_percentage}
                            onChange={(e) =>
                              handleTaskChange(selectedTaskIndex, {
                                dispatcher_percentage: Number(e.target.value),
                              })
                            }
                            className="bg-background pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                {/* Templates Card */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">Шаблоны автогенерации</CardTitle>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Используйте переменные: {'{stage_name}'}, {'{order_title}'}, {'{client_name}'}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title_template" className="text-sm font-medium">
                        Шаблон названия задачи
                      </Label>
                      <Input
                        id="title_template"
                        value={selectedTask.task_title_template}
                        onChange={(e) =>
                          handleTaskChange(selectedTaskIndex, {
                            task_title_template: e.target.value,
                          })
                        }
                        placeholder="{stage_name} - {order_title}"
                        className="bg-background font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description_template" className="text-sm font-medium">
                        Шаблон описания
                      </Label>
                      <Textarea
                        id="description_template"
                        value={selectedTask.task_description_template}
                        onChange={(e) =>
                          handleTaskChange(selectedTaskIndex, {
                            task_description_template: e.target.value,
                          })
                        }
                        placeholder="Выполнить {stage_name} для заказа {order_title} клиента {client_name}"
                        rows={3}
                        className="bg-background font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}

          {localTasks.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="mb-4">Нет задач для этого этапа</p>
                <Button onClick={handleAddTask} disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Добавить первую задачу
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isUpdating || localTasks.length === 0}>
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить изменения
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};