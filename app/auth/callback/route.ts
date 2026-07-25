import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

// Magic-link landing route. Exchanges the one-time code for a session, then
// enforces the allowlist: the signed-in email must exist in `allowed_users`.
// A non-listed user is signed straight back out — this is the real access gate.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Auth is off — nothing to exchange, just go home.
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/`);
  }
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();

  let allowed = false;
  if (email) {
    // RLS lets a user read only their own allowlist row, so this confirms
    // membership without exposing the rest of the list.
    const { data } = await supabase
      .from("allowed_users")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    allowed = Boolean(data);
  }

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
