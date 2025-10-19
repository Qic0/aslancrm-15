# Настройка Web Push Уведомлений

## Проблема
Web Push уведомления не работают, потому что не настроены VAPID ключи в Supabase.

## Решение

### 1. Генерация VAPID ключей

Выполните следующую команду в терминале:

```bash
npx web-push generate-vapid-keys
```

Вы получите пару ключей:
```
Public Key: BOYtTog9s7v-mnwq8K-LTSiiFNFX6ts4pkriNC85I9UQBN3hFnwk47DNPHWh_vPzCzB-709cWP2lVpqtdQF1tBw
Private Key: [ваш приватный ключ]
```

### 2. Добавление ключей в Supabase

1. Откройте Lovable Cloud (вкладка Cloud)
2. Перейдите в раздел "Secrets"
3. Добавьте два секрета:
   - `VAPID_PUBLIC_KEY` - публичный ключ из шага 1
   - `VAPID_PRIVATE_KEY` - приватный ключ из шага 1

### 3. Обновление публичного ключа в коде

Откройте файл `src/hooks/usePushNotifications.ts` и замените значение `VAPID_PUBLIC_KEY` на ваш публичный ключ из шага 1:

```typescript
const VAPID_PUBLIC_KEY = 'ваш_публичный_ключ';
```

### 4. Подписка на уведомления

После настройки ключей:

1. Откройте страницу "Задачи" (`/zadachi`)
2. Найдите карточку "Push-уведомления"
3. Нажмите кнопку "Включить уведомления"
4. Разрешите уведомления в браузере

Или откройте профиль пользователя (клик на аватар) и включите уведомления там.

### 5. Проверка

После подписки создайте новую задачу. Вы должны получить:
1. Toast-уведомление внизу справа экрана (если страница открыта)
2. Системное push-уведомление Windows (если страница закрыта или в фоне)

## Как это работает

1. **Подписка**: Пользователь разрешает уведомления, браузер создает подписку с endpoint
2. **Сохранение**: Подписка сохраняется в таблицу `push_subscriptions`
3. **Отправка**: При создании задачи вызывается edge function `send-push-notification`
4. **Получение**: Service Worker получает push и показывает системное уведомление
5. **Клик**: При клике на уведомление открывается страница с задачей и popup

## Отладка

Проверьте console logs в браузере:
- `[Push] Browser support: true` - браузер поддерживает push
- `[Push] Service Worker ready` - service worker готов
- `[Push] Current subscription:` - текущая подписка (не должно быть null)
- `[SW] Push notification received` - получено push-уведомление
- `[SW] Showing notification` - показ уведомления

Проверьте edge function logs в Supabase:
- `Sending push notification` - отправка начата
- `Found N subscription(s) for user` - найдены подписки
- `Notification sent successfully` - успешная отправка
