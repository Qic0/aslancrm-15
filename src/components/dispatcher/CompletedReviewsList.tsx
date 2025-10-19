import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday } from 'date-fns';

interface CompletedReview {
  uuid_zadachi: string;
  title: string;
  dispatcher_reward_amount: number | null;
  completed_at: string;
  responsible_user_name?: string;
}

interface CompletedReviewsListProps {
  tasks: CompletedReview[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const CompletedReviewsList = ({ tasks }: CompletedReviewsListProps) => {
  const todayTasks = tasks.filter(task => {
    try {
      return isToday(new Date(task.completed_at));
    } catch {
      return false;
    }
  });

  const totalRewardToday = todayTasks.reduce((sum, task) => 
    sum + (task.dispatcher_reward_amount || 0), 0
  );

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Проверено сегодня
          </CardTitle>
          <Badge className="bg-green-500/10 text-green-700 border-green-200">
            <TrendingUp className="w-3 h-3 mr-1" />
            {formatCurrency(totalRewardToday)} ₽
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Пока нет проверенных задач
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {todayTasks.map(task => (
                <div 
                  key={task.uuid_zadachi}
                  className="bg-muted/50 rounded-lg p-3 space-y-2 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-sm font-medium line-clamp-2">
                        {task.title}
                      </span>
                      {task.responsible_user_name && (
                        <p className="text-xs text-muted-foreground">
                          Работник: {task.responsible_user_name}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
                      +{formatCurrency(task.dispatcher_reward_amount || 0)} ₽
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {format(new Date(task.completed_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default CompletedReviewsList;
