"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { JxMark } from "@/components/brand/logo";
import { admin, ApiError } from "@/lib/admin/client";

/**
 * Where an invite link lands: the person chooses their password and is
 * signed straight in. The token is good once and for a week.
 */
export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <Invite />
    </Suspense>
  );
}

function Invite() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);
  const [dead, setDead] = useState<string | null>(token ? null : "This link is incomplete. Open it again from the email.");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    admin.inviteInfo(token).then(setWho, (e) =>
      setDead(e instanceof ApiError ? (e.errors?.token?.[0] ?? e.message) : "Could not reach the server."),
    );
  }, [token]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password !== confirmation) {
      setError("The two passwords are not the same.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await admin.acceptInvite(token, password, confirmation);
      router.replace("/admin");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (e.errors?.password?.[0] ?? e.errors?.token?.[0] ?? e.message)
          : "Could not reach the server.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <JxMark className="h-6 w-auto" />
          <span className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.075em]">JalimX</span>
        </div>

        {dead ? (
          <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
            {dead}
          </p>
        ) : !who ? (
          <p className="mt-8 text-sm text-[var(--fg-faint)]">Checking the link…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <h1 className="font-display text-xl font-semibold">Welcome, {who.name}</h1>
              <p className="mt-1 text-sm text-[var(--fg-dim)]">
                Choose a password for <span className="text-[var(--fg)]">{who.email}</span>. At least 10 characters.
              </p>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
              Password
              <input name="password" type="password" autoComplete="new-password" minLength={10} required disabled={busy} className="field border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2.5" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
              The same password again
              <input name="confirmation" type="password" autoComplete="new-password" minLength={10} required disabled={busy} className="field border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2.5" />
            </label>
            {error && (
              <p role="alert" className="text-sm text-[var(--color-signal)]">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="cta w-full justify-center">
              {busy ? "Signing you in…" : "Set password and sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
