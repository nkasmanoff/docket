// Whether Supabase is wired up. When false, the auth layer no-ops so local dev
// (and offline mode) keeps working before Supabase is configured — same
// philosophy as hasApiKey() for the generator. PRODUCTION MUST set both vars,
// or the site ships with no login gate at all.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
