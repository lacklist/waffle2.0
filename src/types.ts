export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  subscription_type: 'free' | 'premium';
  created_at: string;
}

export interface Directory {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  type: 'private' | 'public';
  storage_type: string;
  template_type: string;
  theme: 'light' | 'dark';
  view_count: number;
  is_published: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  is_premium: boolean;
}

export interface StoredFile {
  id: string;
  owner_id: string;
  bucket_id: string;
  object_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: 'uploaded' | 'deleted';
  created_at: string;
  deleted_at?: string | null;
  metadata: Record<string, unknown>;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface ConnectionStatus {
  isOnline: boolean;
  isTelegramApp: boolean;
  isSupabaseConnected: boolean;
}
