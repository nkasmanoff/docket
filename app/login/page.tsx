"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Wordmark } from "@/components/PageShell";

const ERROR_COPY: Record<string, string> = {
  not_authorized:
    "That email isn't on the access list. Ask the owner to add you.",
  missing_code: "The sign-in link was invalid or expired. Request a new one.",
};

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const urlError = params.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const configured = isSupabaseConfigured();

  // Auth is off — the site is open, so /login has no purpose. Send people home.
  useEffect(() => {
    if (!configured) router.replace("/");
  }, [configured, router]);

  if (!configured) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="min-h-dvh bg-parchment">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-lg items-center px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-sm px-4 py-16">
        <h1 className="font-serif text-2xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink/60">
          Docket is invite-only. Enter your email and we&apos;ll send you a
          one-time sign-in link.
        </p>

        {urlError && (
          <p className="mt-4 rounded-lg border border-incorrect/30 bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
            {ERROR_COPY[urlError] ?? "Sign-in failed. Please try again."}
          </p>
        )}

        {status === "sent" ? (
          <div className="mt-6 rounded-lg border border-correct/30 bg-correct/10 px-3 py-3 text-sm text-ink/80">
            Check <span className="font-medium">{email}</span> for a sign-in
            link. You can close this tab.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={!configured || status === "sending"}
              className="w-full rounded-lg border border-ink/20 bg-surface px-3 py-2.5 text-ink outline-none transition-colors focus:border-brass disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!configured || status === "sending"}
              className="w-full rounded-lg bg-ink px-3 py-2.5 font-medium text-parchment transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-incorrect">{message}</p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
