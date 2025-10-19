import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { useTaskDialog } from '@/contexts/TaskDialogContext';

export function NotificationCenter() {
  const { notifications } = useNotifications(10);
  const { unreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const navigate = useNavigate();
  const { openTaskDialog } = useTaskDialog();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Уведомления</SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `У вас ${unreadCount} непрочитанных уведомлений` : 'Нет новых уведомлений'}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-4 space-y-4">
          {isSupported && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1">
                  <Label htmlFor="push-notifications" className="text-sm font-medium cursor-pointer">
                    Push-уведомления
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isSubscribed 
                      ? 'Вы получаете уведомления о новых задачах' 
                      : 'Включите, чтобы получать уведомления даже при закрытом приложении'
                    }
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={isSubscribed}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      subscribe();
                    } else {
                      unsubscribe();
                    }
                  }}
                  disabled={isLoading}
                />
              </div>
              <Separator />
            </>
          )}
          {unreadCount > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                Отметить все как прочитанные
              </Button>
              <Separator />
            </>
          )}

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Уведомлений пока нет</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                      !notification.read ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {notifications.length > 0 && (
            <>
              <Separator />
              <Button
                variant="link"
                className="w-full"
                onClick={() => navigate('/notifications')}
              >
                Посмотреть всю историю
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
