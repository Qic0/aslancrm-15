import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, User, Building, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DispatcherTaskCardProps {
  task: any;
  onClick: () => void;
  index: number;
}

const DispatcherTaskCard = ({ task, onClick, index }: DispatcherTaskCardProps) => {
  const isOverdue = task.original_deadline && new Date(task.original_deadline) < new Date();
  const returnsCount = Array.isArray(task.review_returns) ? task.review_returns.length : 0;

  const getWaitingTime = () => {
    if (!task.completed_at) return null;
    try {
      return formatDistanceToNow(new Date(task.completed_at), { 
        addSuffix: false,
        locale: ru 
      });
    } catch {
      return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const borderColor = returnsCount > 0 
    ? 'border-orange-500' 
    : isOverdue 
    ? 'border-destructive' 
    : 'border-blue-500';

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0
    }
  };

  const waitingTime = getWaitingTime();

  // Calculate dispatcher reward if not set
  const dispatcherReward = task.dispatcher_reward_amount 
    || (task.salary && task.dispatcher_percentage 
      ? task.salary * (task.dispatcher_percentage / 100) 
      : 0);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.05
      }}
    >
      <Card 
        className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${borderColor} ${
          isOverdue ? 'animate-pulse' : ''
        }`}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* Левая часть - информация о задаче */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-bold text-xl">{task.title}</h3>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                  На проверке
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Просрочено
                  </Badge>
                )}
                {returnsCount > 0 && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">
                    Возвратов: {returnsCount}
                  </Badge>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {task.responsible_user_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{task.responsible_user_name}</span>
                  </div>
                )}

                {task.order_title && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{task.order_title}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Срок: {formatDate(task.original_deadline || task.due_date)}
                  </span>
                </div>

                {waitingTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-700 font-medium">
                      Ожидает {waitingTime}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Правая часть - вознаграждение и действия */}
            <div className="flex flex-col items-end justify-between gap-3 md:min-w-[160px]">
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-2xl font-bold">
                    {formatCurrency(dispatcherReward)} ₽
                  </span>
                </div>
                {task.dispatcher_percentage && (
                  <p className="text-xs text-muted-foreground">
                    {task.dispatcher_percentage}% от задачи
                  </p>
                )}
              </div>

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="w-full md:w-auto"
              >
                Проверить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DispatcherTaskCard;
