import { supabase } from './supabaseClient';
import { User } from '../types';

export class SupabaseUserService {
  static async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  static async updateProfile(
    updates: Partial<Pick<User, 'username' | 'first_name' | 'last_name'>>
  ): Promise<User> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}
