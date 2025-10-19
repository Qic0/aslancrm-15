import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, TrendingUp, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, isToday } from 'date-fns';

interface DispatcherMetricsProps {
  userId: string;
}

const DispatcherMetrics = ({ userId }: DispatcherMetricsProps) => {
  const { data: metrics } = useQuery({
    queryKey: ['dispatcher-metrics', userId],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('zadachi')
        .select('*')
        .eq('dispatcher_id', userId);

      if (error) throw error;

      const now = new Date();
      const monthStart = startOfMonth(now);

      const pendingReview = tasks?.filter(t => t.status === 'under_review').length || 0;
      
      const completedToday = tasks?.filter(t => 
        t.status === 'completed' && 
        t.completed_at && 
        isToday(new Date(t.completed_at))
      ).length || 0;

      const rewardThisMonth = tasks
        ?.filter(t => 
          t.dispatcher_reward_applied_at && 
          new Date(t.dispatcher_reward_applied_at) >= monthStart
        )
        .reduce((sum, t) => {
          const reward = t.dispatcher_reward_amount 
            || (t.salary && t.dispatcher_percentage 
              ? t.salary * (t.dispatcher_percentage / 100) 
              : 0);
          return sum + reward;
        }, 0) || 0;

      const tasksWithPercentage = tasks?.filter(t => t.dispatcher_percentage) || [];
      const avgPercentage = tasksWithPercentage.length > 0
        ? tasksWithPercentage.reduce((sum, t) => sum + (t.dispatcher_percentage || 0), 0) / tasksWithPercentage.length
        : 0;

      return {
        pendingReview,
        completedToday,
        rewardThisMonth,
        avgPercentage
      };
    },
    enabled: !!userId
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const metricsData = [
    {
      title: "Ожидают проверки",
      value: metrics?.pendingReview || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10"
    },
    {
      title: "Проверено сегодня",
      value: metrics?.completedToday || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      title: "Вознаграждение за месяц",
      value: `${formatCurrency(metrics?.rewardThisMonth || 0)} ₽`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Средний % вознаграждения",
      value: `${(metrics?.avgPercentage || 0).toFixed(1)}%`,
      icon: Percent,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metricsData.map((metric, index) => (
        <Card key={index} className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <metric.icon className={`w-4 h-4 ${metric.color}`} />
              {metric.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metric.color}`}>
              {metric.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DispatcherMetrics;
