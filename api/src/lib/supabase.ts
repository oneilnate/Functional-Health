import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

/**
 * Service-role Supabase client — bypasses RLS.
 * Used for Storage operations (presigned URLs) and privileged DB access.
 * Never expose to the client.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

