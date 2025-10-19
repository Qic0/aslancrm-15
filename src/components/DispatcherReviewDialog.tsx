import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, FileText, Banknote, Clock, Building, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Task {
  id_zadachi: number;
  uuid_zadachi: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
  completed_at?: string;
  execution_time_seconds?: number;
  responsible_user_name?: string;
  responsible_user_id?: string;
  order_title?: string;
  zakaz_id?: number;
  salary?: number;
  is_locked?: boolean;
  dispatcher_id?: string;
  dispatcher_percentage?: number;
  dispatcher_reward_amount?: number;
  dispatcher_reward_applied?: boolean;
  automation_setting_id?: string;
  review_returns?: Array<{
    return_number: number;
    comment: string;
    returned_at: string;
  }>;
  original_deadline?: string;
  image_url?: string;
  checklist_photo?: string;
}

interface DispatcherReviewDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
};

const DispatcherReviewDialog = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated
}: DispatcherReviewDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnComment, setReturnComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  if (!task) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      console.log('Approving task:', task.id_zadachi, 'automation_setting_id:', task.automation_setting_id);
      
      // Используем новую функцию confirm_task для подтверждения задачи
      // Функция автоматически:
      // 1. Установит confirmed_by, confirmed_at
      // 2. Изменит статус на 'completed'
      // 3. Триггер создаст зависимые задачи
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Пользователь не авторизован');

      const { error: confirmError } = await supabase.rpc('confirm_task', {
        p_task_id: task.id_zadachi,
        p_dispatcher_id: currentUser.user.id
      });

      if (confirmError) throw confirmError;

      // Начислить зарплату диспетчера
      if (!task.dispatcher_reward_applied && task.dispatcher_id && task.dispatcher_percentage && task.salary) {
        const dispatcherReward = (task.salary * task.dispatcher_percentage) / 100;
        
        const { error: dispatcherError } = await supabase.rpc('add_dispatcher_completed_task', {
          p_dispatcher_id: task.dispatcher_id,
          p_task_id: task.id_zadachi,
          p_payment: dispatcherReward
        });

        if (dispatcherError) {
          console.error('Ошибка при начислении диспетчеру:', dispatcherError);
        }

        // Обновить dispatcher_reward_amount
        await supabase
          .from('zadachi')
          .update({
            dispatcher_reward_amount: dispatcherReward,
            dispatcher_reward_applied: true,
            dispatcher_reward_applied_at: new Date().toISOString()
          })
          .eq('id_zadachi', task.id_zadachi);
      }

      // Начислить зарплату работнику
      if (task.responsible_user_id && task.salary) {
        const isOverdue = task.original_deadline && new Date(task.original_deadline) < new Date();
        const actualPayment = isOverdue ? Math.round(task.salary * 0.9) : task.salary;

        const { error: workerSalaryError } = await supabase.rpc('add_completed_task_and_salary', {
          p_worker_id: task.responsible_user_id,
          p_task_id: task.id_zadachi,
          p_payment: actualPayment,
          p_has_penalty: isOverdue
        });

        if (workerSalaryError) {
          console.error('Не удалось начислить зарплату работнику:', workerSalaryError);
          toast({
            variant: "destructive",
            title: "Предупреждение",
            description: "Задача подтверждена, но зарплата работнику не начислена"
          });
        }
      }

      toast({
        title: "Задача подтверждена",
        description: "Зависимые задачи будут созданы автоматически"
      });

      queryClient.invalidateQueries({ queryKey: ['dispatcher-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['zadachi'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onTaskUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error approving task:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось подтвердить задачу"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!returnComment.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Комментарий обязателен при возврате на доработку"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Пользователь не авторизован');

      // Используем новую функцию reject_task для отклонения задачи
      const { error: rejectError } = await supabase.rpc('reject_task', {
        p_task_id: task.id_zadachi,
        p_dispatcher_id: currentUser.user.id,
        p_rejection_reason: returnComment.trim()
      });

      if (rejectError) throw rejectError;

      // Добавляем запись в review_returns для истории
      const currentReturns = task.review_returns || [];
      const newReturn = {
        return_number: currentReturns.length + 1,
        comment: returnComment.trim(),
        returned_at: new Date().toISOString()
      };

      await supabase
        .from('zadachi')
        .update({
          review_returns: [...currentReturns, newReturn]
        })
        .eq('id_zadachi', task.id_zadachi);

      toast({
        title: "Задача возвращена",
        description: "Задача отправлена работнику на доработку"
      });

      queryClient.invalidateQueries({ queryKey: ['dispatcher-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['zadachi'] });
      queryClient.invalidateQueries({ queryKey: ['worker-tasks'] });
      onTaskUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error returning task:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось вернуть задачу на доработку"
      });
    } finally {
      setIsProcessing(false);
      setShowReturnDialog(false);
      setReturnComment("");
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showReturnDialog} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[600px] lg:max-w-[800px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl sm:text-2xl tracking-tight">
              Проверка задачи: {task.title}
            </DialogTitle>
            <Badge variant="secondary" className="bg-warning text-warning-foreground w-fit mt-2">
              На проверке
            </Badge>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Фотоотчет работника */}
            {(task.image_url || task.checklist_photo) && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Фотоотчет работника
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {task.image_url && (
                      <div className="relative group overflow-hidden rounded-lg border">
                        <img 
                          src={task.image_url} 
                          alt="Фото работы" 
                          className="w-full h-48 sm:h-64 object-cover"
                          onClick={() => window.open(task.image_url, '_blank')}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium">
                            Открыть полный размер
                          </span>
                        </div>
                      </div>
                    )}
                    {task.checklist_photo && (
                      <div className="relative group overflow-hidden rounded-lg border">
                        <img 
                          src={task.checklist_photo} 
                          alt="Чек-лист фото" 
                          className="w-full h-48 sm:h-64 object-cover"
                          onClick={() => window.open(task.checklist_photo, '_blank')}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium">
                            Открыть полный размер
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Основная информация */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display font-bold text-base sm:text-lg">Информация о задаче</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {task.description && (
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Описание</p>
                      <p className="text-sm sm:text-base font-medium whitespace-pre-wrap break-words">{task.description}</p>
                    </div>
                  </div>
                )}

                {task.order_title && (
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <Building className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Заказ</p>
                      <p className="text-sm sm:text-base font-semibold break-words">{task.order_title}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-2 sm:space-x-3">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Ответственный работник</p>
                    <p className="text-sm sm:text-base font-semibold break-words">{task.responsible_user_name || '—'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 sm:space-x-3">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Оплата работника</p>
                    <p className="text-sm sm:text-base font-semibold">{task.salary ? `${task.salary} ₽` : '—'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 sm:space-x-3">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Срок выполнения</p>
                    <p className="text-sm sm:text-base font-semibold break-words">{formatDate(task.original_deadline || task.due_date)}</p>
                    {task.original_deadline && new Date(task.original_deadline) < new Date() && (
                      <Badge variant="destructive" className="mt-1 text-xs">Просрочено</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* История возвратов */}
            {task.review_returns && task.review_returns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning flex-shrink-0" />
                    <span className="break-words">История возвратов на доработку</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.review_returns.map((returnItem) => (
                    <div key={returnItem.return_number} className="border-l-4 border-warning pl-3 sm:pl-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-1">
                        <span className="text-sm sm:text-base font-semibold">Возврат #{returnItem.return_number}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {formatDate(returnItem.returned_at)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm break-words">{returnItem.comment}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Кнопки действий */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="w-full sm:flex-1 bg-status-done hover:bg-status-done/90"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm sm:text-base">Всё верно</span>
              </Button>
              <Button
                onClick={() => setShowReturnDialog(true)}
                disabled={isProcessing}
                variant="destructive"
                className="w-full sm:flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                <span className="text-sm sm:text-base">Вернуть на доработку</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог возврата с комментарием */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Возврат на доработку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs sm:text-sm font-medium">
                Комментарий для работника <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="Укажите, что необходимо исправить..."
                rows={4}
                className="mt-2 text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={handleReturn}
                disabled={isProcessing || !returnComment.trim()}
                className="w-full sm:flex-1 text-sm"
                variant="destructive"
              >
                Отправить на доработку
              </Button>
              <Button
                onClick={() => {
                  setShowReturnDialog(false);
                  setReturnComment("");
                }}
                variant="outline"
                className="w-full sm:flex-1 text-sm"
              >
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DispatcherReviewDialog;
