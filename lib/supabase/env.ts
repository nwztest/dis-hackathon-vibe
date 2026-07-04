export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
export const inferenceWorkerUrl = process.env.INFERENCE_WORKER_URL;
export const demoWorkerSecret = process.env.DEMO_WORKER_SECRET;

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function hasSupabaseAdminEnv() {
  return Boolean(supabaseUrl && supabaseSecretKey);
}
