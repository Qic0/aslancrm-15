import { useState } from 'react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/Header';
import { useTaskDialog } from '@/contexts/TaskDialogContext';

export default function NotificationsHistory() {
  const { notifications } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const navigate = useNavigate();
  const { openTaskDialog } = useTaskDialog();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at);
    let key: string;
    
    if (isToday(date)) {
      key = 'Сегодня';
    } else if (isYesterday(date)) {
      key = 'Вчера';
    } else {
      key = format(date, 'd MMMM yyyy', { locale: ru });
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
    return groups;
  }, {} as Record<string, typeof notifications>);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.task_id) {
      openTaskDialog(notification.task_id);
    } else if (notification.url) {
      navigate(notification.url);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  История уведомлений
                </CardTitle>
                <CardDescription>
                  {unreadCount > 0 
                    ? `У вас ${unreadCount} непрочитанных уведомлений` 
                    : 'Все уведомления прочитаны'}
                </CardDescription>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Отметить все
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">
                  Все ({notifications.length})
                </TabsTrigger>
                <TabsTrigger value="unread">
                  Непрочитанные ({unreadCount})
                </TabsTrigger>
                <TabsTrigger value="read">
                  Прочитанные ({notifications.length - unreadCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={filter} className="mt-4">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  {Object.keys(groupedNotifications).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Уведомлений нет</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedNotifications).map(([date, items]) => (
                        <div key={date}>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3">
                            {date}
                          </h3>
                          <div className="space-y-2">
                            {items.map((notification, index) => (
                              <div key={notification.id}>
                                <div
                                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                    !notification.read
                                      ? 'bg-accent/50 border-primary/20'
                                      : 'hover:bg-accent/30'
                                  }`}
                                  onClick={() => handleNotificationClick(notification)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">{notification.title}</p>
                                        {!notification.read && (
                                          <div className="w-2 h-2 rounded-full bg-primary" />
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {notification.body}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>
                                          {format(new Date(notification.created_at), 'HH:mm')}
                                        </span>
                                        <span>•</span>
                                        <span>
                                          {formatDistanceToNow(new Date(notification.created_at), {
                                            addSuffix: true,
                                            locale: ru,
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                    {notification.read && (
                                      <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                </div>
                                {index < items.length - 1 && <Separator className="my-2" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
