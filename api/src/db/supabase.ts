import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

/**
 * Supabase client initialised with the service-role key so it can bypass RLS.
 * Used exclusively for Storage signed-URL generation.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

