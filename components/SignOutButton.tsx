"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Small text button that signs the user out and returns them to /login.
// Renders nothing when Supabase isn't configured (auth is off).
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  if (!isSupabaseConfigured()) return null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className={`text-sm text-ink/50 transition-colors hover:text-ink ${className}`}
    >
      Sign out
    </button>
  );
}
