export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

export function requireSupabaseEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add the variables documented in .env.example.");
  }
  return publicEnv;
}
