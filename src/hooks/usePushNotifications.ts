import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// VAPID публичный ключ
const VAPID_PUBLIC_KEY = 'BE0GvbBBD9kpNOXMMtqvh3jrby1qK9vbP3tNdGEyIJ1VjSDaNaDyWHhxnjVhFbrBGIoYKVq1NDKxzkcfdDVSWLM';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 
        'Notification' in window && 
        'serviceWorker' in navigator && 
        'PushManager' in window;
      
      console.log('[Push] Browser support:', supported);
      setIsSupported(supported);

      if (supported) {
        try {
          const registration = await navigator.serviceWorker.ready;
          console.log('[Push] Service Worker ready:', registration);
          
          const subscription = await registration.pushManager.getSubscription();
          console.log('[Push] Current subscription:', subscription);
          
          setIsSubscribed(!!subscription);

          // Проверяем не истекла ли подписка
          if (subscription) {
            const { data: user } = await supabase.auth.getUser();
            if (user.user) {
              // Проверяем есть ли подписка в базе
              const { data: dbSub } = await supabase
                .from('push_subscriptions')
                .select('*')
                .eq('endpoint', subscription.endpoint)
                .single();

              if (!dbSub) {
                console.log('[Push] Subscription not in DB, re-subscribing');
                // Подписка есть в браузере но нет в БД - пересоздаем
                await subscription.unsubscribe();
                setIsSubscribed(false);
              }
            }
          }
        } catch (error) {
          console.error('[Push] Error checking subscription:', error);
        }
      }
    };

    checkSupport();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Не поддерживается',
        description: 'Ваш браузер не поддерживает push-уведомления',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        return true;
      } else if (permission === 'denied') {
        toast({
          title: 'Разрешение отклонено',
          description: 'Вы отклонили разрешение на уведомления. Измените настройки браузера.',
          variant: 'destructive',
        });
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось запросить разрешение на уведомления',
        variant: 'destructive',
      });
      return false;
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      console.log('[Push] Push notifications not supported');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Push] Starting subscription process...');
      
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        console.log('[Push] Permission denied');
        setIsLoading(false);
        return;
      }

      console.log('[Push] Permission granted, waiting for service worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] Service worker ready');
      
      // Удаляем старую подписку если есть
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log('[Push] Unsubscribing from old subscription');
        await subscription.unsubscribe();
      }

      // Создаем новую подписку
      console.log('[Push] Creating new subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[Push] Subscription created:', subscription);

      // Сохраняем подписку в базу данных
      const subscriptionJSON = subscription.toJSON();
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      console.log('[Push] Saving subscription to database...');
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.user.id,
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys?.p256dh,
        auth: subscriptionJSON.keys?.auth,
      }, {
        onConflict: 'endpoint'
      });

      if (error) {
        console.error('[Push] Database error:', error);
        throw error;
      }

      console.log('[Push] Subscription saved successfully');
      setIsSubscribed(true);
      toast({
        title: 'Уведомления включены',
        description: 'Вы будете получать уведомления о новых задачах даже когда приложение закрыто',
      });
    } catch (error) {
      console.error('[Push] Error subscribing to push notifications:', error);
      toast({
        title: 'Ошибка подписки',
        description: error instanceof Error ? error.message : 'Не удалось подписаться на уведомления',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        
        // Удаляем подписку из базы данных
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

        if (error) throw error;
      }

      setIsSubscribed(false);
      toast({
        title: 'Уведомления отключены',
        description: 'Вы больше не будете получать уведомления',
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отключить уведомления',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
};
