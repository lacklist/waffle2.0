import { TelegramUser, ConnectionStatus } from '../types';

export class TelegramService {
  static getTelegramUser(): TelegramUser {
    const tg = (window as any).Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user as TelegramUser | undefined;

    // Running inside Telegram WebApp
    if (user && typeof user.id === 'number') {
      return user;
    }

    // Development fallback (browser). Persist a stable mock user id.
    const key = 'waffle_dev_telegram_id';
    let devId = Number(localStorage.getItem(key));
    if (!devId || Number.isNaN(devId)) {
      devId = Math.floor(100000000 + Math.random() * 900000000);
      localStorage.setItem(key, String(devId));
    }

    return {
      id: devId,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
    };
  }

  static getInitData(): string {
    const tg = (window as any).Telegram?.WebApp;
    return typeof tg?.initData === 'string' ? tg.initData : '';
  }

  static initTelegramApp(): void {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }

  static hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium'): void {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(type);
    }
  }

  static isTelegramApp(): boolean {
    return !!(window as any).Telegram?.WebApp;
  }

  static getConnectionStatus(): ConnectionStatus {
    return {
      isOnline: navigator.onLine,
      isTelegramApp: this.isTelegramApp(),
      isSupabaseConnected: !!import.meta.env.VITE_SUPABASE_URL,
    };
  }

  static logDebugInfo(): void {
    if (!this.isTelegramApp()) {
      console.log(
        '%c⚠️ DEVELOPMENT MODE',
        'color: #ff6b6b; font-size: 16px; font-weight: bold;'
      );
      console.log('%cТестирование в браузере. Некоторые функции могут работать иначе.', 'color: #ff6b6b;');
      console.log('%cТелеграм пользователь (мок):', 'color: #4dabf7; font-weight: bold;', this.getTelegramUser());
      console.log('%cСтатус подключения:', 'color: #4dabf7; font-weight: bold;', this.getConnectionStatus());
    }
  }
}
