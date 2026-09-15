"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JxMark } from "@/components/brand/logo";
import { admin, ApiError } from "@/lib/admin/client";

const FIELDS = [
  { name: "email", label: "Email", type: "email", auto: "username" },
  { name: "password", label: "Password", type: "password", auto: "current-password" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setError(null);

    try {
      await admin.login(String(form.get("email")), String(form.get("password")));
      router.replace("/admin/projects");
    } catch (e) {
      // Laravel answers a wrong password and an unknown email with the same
      // message on purpose; show it as it comes rather than guessing which.
      setError(
        e instanceof ApiError
          ? (e.errors.email?.[0] ?? e.message)
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
          <span className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.075em]">
            JalimX
          </span>
          <span className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            Dashboard
          </span>
        </div>

        <form onSubmit={onSubmit} className="mt-8">
          <div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
            {FIELDS.map((f) => (
              <div
                key={f.name}
                className="group flex flex-col gap-2 bg-[var(--panel)] px-4 py-3.5 transition-colors focus-within:bg-[color-mix(in_oklab,var(--link)_5%,var(--panel))]"
              >
                <label
                  htmlFor={f.name}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] transition-colors group-focus-within:text-[var(--link)]"
                >
                  {f.label}
                </label>
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type}
                  autoComplete={f.auto}
                  required
                  disabled={busy}
                  className="field"
                />
              </div>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--color-signal)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="cta mt-6 w-full justify-center"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
