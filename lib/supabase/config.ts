// Whether Supabase is wired up. When false, the auth layer no-ops so local dev
// (and offline mode) keeps working before Supabase is configured — same
// philosophy as hasApiKey() for the generator. PRODUCTION MUST set both vars,
// or the site ships with no login gate at all.
//
// AUTH IS CURRENTLY DISABLED: flip to true to re-enable the invite-only
// Supabase login gate (it was turned off because the Supabase project became
// unreachable, breaking the site with "Failed to fetch"). While false, every
// check below no-ops and the site is open to everyone.
const AUTH_ENABLED = false;

export function isSupabaseConfigured(): boolean {
  if (!AUTH_ENABLED) return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
