/* Force CSS reload v2 */
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Регистрация Service Worker для push-уведомлений
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[Main] Service Worker зарегистрирован:', registration);
        console.log('[Main] Service Worker scope:', registration.scope);
        
        // Проверяем обновления SW каждые 60 секунд
        setInterval(() => {
          registration.update();
        }, 60000);
      })
      .catch((error) => {
        console.error('[Main] Ошибка регистрации Service Worker:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
