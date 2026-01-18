
import { createClient } from '@supabase/supabase-js';

// Backward-compatible Supabase client.
// Prefer importing { supabase } from '@/services/supabaseClient'.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
        