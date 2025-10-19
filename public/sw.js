// Service Worker для push-уведомлений и кэширования
const CACHE_NAME = 'aslan-crm-v2';

// Кэширование ресурсов при установке
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon-a.png',
        '/favicon-a-large.png'
      ]);
    })
  );
  self.skipWaiting();
});

// Очистка старого кэша
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
    console.log('[SW] Push data:', data);
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const title = data.title || 'Новая задача';
  const options = {
    body: data.body || 'У вас новая задача',
    icon: '/favicon-a-large.png',
    badge: '/favicon-a.png',
    data: {
      taskId: data.taskId,
      orderId: data.orderId,
      url: data.url || '/worker'
    },
    vibrate: [200, 100, 200],
    tag: data.taskId ? `task-${data.taskId}` : `notification-${Date.now()}`,
    requireInteraction: false, // Автоматически исчезает на Windows
    renotify: true, // Позволяет повторные уведомления с тем же tag
    timestamp: Date.now(),
    actions: [
      {
        action: 'open',
        title: 'Открыть',
        icon: '/favicon-a.png'
      },
      {
        action: 'close',
        title: 'Позже'
      }
    ]
  };

  console.log('[SW] Showing notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      console.log('[SW] Notification displayed successfully');
    }).catch((error) => {
      console.error('[SW] Error displaying notification:', error);
    })
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  // Если нажата кнопка "Позже", ничего не делаем
  if (event.action === 'close') {
    console.log('[SW] User clicked "Later" - closing notification');
    return;
  }

  // Формируем URL с taskId для автоматического открытия popup
  let urlToOpen = event.notification.data.url || '/worker';
  if (event.notification.data.taskId) {
    urlToOpen = `/worker?taskId=${event.notification.data.taskId}`;
  }
  const fullUrl = new URL(urlToOpen, self.location.origin).href;
  console.log('[SW] Opening URL:', fullUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('[SW] Found client windows:', clientList.length);
      
      // Проверяем есть ли уже открытое окно приложения
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(fullUrl);
        
        // Если домен совпадает, фокусируемся и переходим на нужную страницу
        if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
          console.log('[SW] Focusing existing window and navigating');
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(fullUrl);
            }
          });
        }
      }
      
      // Иначе открываем новое окно
      if (clients.openWindow) {
        console.log('[SW] Opening new window');
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Стратегия кэширования: сначала сеть, затем кэш
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Кэшируем успешные GET-запросы
        if (event.request.method === 'GET' && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // При ошибке сети возвращаем из кэша
        return caches.match(event.request);
      })
  );
});
