import { supabase } from './supabaseClient';
import type { Directory, Template, TelegramUser, User } from '../types';

/**
 * DatabaseService is a thin data-access layer for the app tables.
 *
 * Notes:
 * - This service assumes you use Supabase Auth as identity source.
 * - During development (non-Telegram), we sign in anonymously so Storage/RLS can work.
 */
export class DatabaseService {
  /** Ensures there is an authenticated Supabase user (anonymous in dev). */
  static async ensureSignedIn(): Promise<string> {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw sessionErr;

    if (sessionData.session?.user?.id) {
      return sessionData.session.user.id;
    } 

    // Anonymous sign-in enables RLS policies that rely on auth.uid().
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user?.id) throw new Error('Failed to create anonymous session');
    return data.user.id;
  }

  /**
   * Ensures the profile row exists in public.users for the current auth user.
   * The telegramUser is used to populate telegram fields (or dev mock values).
   */
  static async ensureUserProfile(telegramUser: TelegramUser): Promise<User> {
    const authUserId = await this.ensureSignedIn();

    // Try fetch profile by auth user id
    const { data: existing, error: selErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing) {
      // Optionally backfill missing fields
      const updates: Partial<User> = {};
      if (!existing.telegram_id) updates.telegram_id = telegramUser.id;
      if (!existing.first_name) updates.first_name = telegramUser.first_name;
      if (existing.username == null && telegramUser.username) updates.username = telegramUser.username;
      if (existing.last_name == null && telegramUser.last_name) updates.last_name = telegramUser.last_name;

      if (Object.keys(updates).length > 0) {
        const { data: updated, error: updErr } = await supabase
          .from('users')
          .update(updates)
          .eq('id', authUserId)
          .select('*')
          .single();
        if (updErr) throw updErr;
        return updated as User;
      }

      return existing as User;
    }

    // Create profile (matches recommended RLS: auth.uid() = id)
    const { data: created, error: insErr } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        telegram_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name ?? null,
        subscription_type: 'free',
      })
      .select('*')
      .single();

    if (insErr) throw insErr;
    return created as User;
  }

  static async getTemplates(): Promise<Template[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Template[];
  }

  static async getDirectories(ownerId: string): Promise<Directory[]> {
    const { data, error } = await supabase
      .from('directories')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Directory[];
  }

  static async createDirectory(input: Omit<Directory, 'id' | 'created_at' | 'view_count'> & Partial<Pick<Directory, 'view_count' | 'created_at'>>): Promise<Directory> {
    const payload = {
      ...input,
      view_count: input.view_count ?? 0,
    };

    const { data, error } = await supabase
      .from('directories')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as Directory;
  }
}
