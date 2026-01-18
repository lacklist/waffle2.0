import { useState, useEffect } from 'react';
import { TelegramService } from '../services/telegram';
import { Wifi, WifiOff, Smartphone } from 'lucide-react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTelegramApp, setIsTelegramApp] = useState(TelegramService.isTelegramApp());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && isTelegramApp) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40">
      {!isOnline && (
        <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2 justify-center">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Нет интернета. Работа в оффлайн режиме.</span>
        </div>
      )}
      {isOnline && !isTelegramApp && (
        <div className="bg-yellow-500 text-white px-4 py-2 flex items-center gap-2 justify-center">
          <Smartphone className="w-4 h-4" />
          <span className="text-sm font-medium">Режим разработки. Откройте в Telegram.</span>
        </div>
      )}
    </div>
  );
}
