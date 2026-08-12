import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anon-key client: only touches tables/functions that have public RLS
// policies (public reads, take_queue/verify_admin_login RPCs). Never holds
// elevated privileges. Safe to import from client components (Realtime,
// public reads) or from API routes (calling public RPCs) — persistSession
// is off since we never use Supabase Auth sessions, only our own JWT cookie.
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
