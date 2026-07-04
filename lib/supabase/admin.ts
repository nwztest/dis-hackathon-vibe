import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

export function createAdminClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is required for privileged demo writes.");
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
