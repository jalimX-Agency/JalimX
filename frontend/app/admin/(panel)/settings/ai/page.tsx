"use client";

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import { RowsSkeleton } from "@/components/admin/skeleton";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  ApiError,
  isSignedOut,
  type AiCredential,
  type AiCredentialInput,
  type AiProviderInfo,
  type AiStatus,
  type AiTest,
} from "@/lib/admin/client";

/**
 * The keys the dashboard's AI runs on.
 *
 * Several keys, several providers, in priority order: the first available one
 * answers, and one that hits its quota rests while the next takes over. A key
 * goes in here and never comes back out — the list shows its last four
 * characters, and editing one means typing a new key or leaving it as it is.
 */

const STATUS: Record<AiStatus, { label: string; tone: string }> = {
  active: { label: "Active", tone: "text-[var(--link)]" },
  cooling_down: { label: "Resting", tone: "text-[var(--color-signal-dim,var(--fg-dim))]" },
  invalid: { label: "Invalid", tone: "text-[var(--color-signal)]" },
  disabled: { label: "Disabled", tone: "text-[var(--fg-faint)]" },
};

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

export default function AiProvidersPage() {
  const [rows, setRows] = useState<AiCredential[] | null>(null);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null closed · 0 new · otherwise the id being edited
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const ask = useConfirm();
  const toast = useToast();

  const load = () =>
    admin.aiCredentials().then(setRows, (e) => !isSignedOut(e) && setError(e.message));

  useEffect(() => {
    let live = true;
    admin.aiCredentials().then(
      (r) => live && setRows(r),
      (e) =>
        live &&
        !isSignedOut(e) &&
        setError(e instanceof ApiError && e.status === 403 ? "Your account cannot manage AI keys." : e.message),
    );
    admin.aiProviders().then((p) => live && setProviders(p), () => {});
    return () => {
      live = false;
    };
  }, []);

  function replace(next: AiCredential) {
    setRows((list) => list?.map((r) => (r.id === next.id ? next : r)) ?? null);
  }

  function report(test: AiTest | null | undefined) {
    if (!test) return;
    if (test.ok) toast.success("The provider answered — this key is in the rotation.");
    else toast.error(test.message);
  }

  async function act(row: AiCredential, action: "test" | "enable" | "disable" | "retry") {
    setBusy(row.id);
    try {
      const res =
        action === "test"
          ? await admin.testAiCredential(row.id)
          : await admin.setAiCredentialState(row.id, action);
      replace(res.data);
      if (action === "disable") toast.success(`${row.label} is out of the rotation.`);
      else report(res.test);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: AiCredential) {
    if (
      !(await ask({
        title: `Delete ${row.label}?`,
        body: "The key is removed for good. To only take it out of the rotation, disable it instead.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    await admin.removeAiCredential(row.id);
    setRows((list) => list?.filter((r) => r.id !== row.id) ?? null);
  }

  async function move(index: number, by: -1 | 1) {
    if (!rows) return;
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    try {
      setRows(await admin.reorderAiCredentials(next.map((r) => r.id)));
    } catch {
      setRows(rows);
    }
  }

  return (
    // The assistant never touches this page: it is where the keys are typed.
    <div data-ai="off">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">AI providers</h1>
        {open === null && !error && (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
          >
            + Add a key
          </button>
        )}
      </div>
      <p className="mt-2 max-w-[64ch] text-sm text-[var(--fg-dim)]">
        The keys the dashboard&apos;s writing help runs on, in the order they are tried. When one
        reaches its limit it rests and the next one answers; it comes back on its own once the
        provider allows it again. Keys are stored encrypted and never shown again.
      </p>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {open === 0 && (
        <Editor
          providers={providers}
          onDone={(saved) => {
            setOpen(null);
            if (saved) load();
          }}
        />
      )}

      {!rows && !error && <RowsSkeleton rows={3} />}

      {rows && rows.length === 0 && open !== 0 && (
        <p className="mt-10 text-sm text-[var(--fg-faint)]">
          No keys yet. Add one from Google AI Studio, Groq, OpenRouter or any OpenAI-compatible
          provider.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ol className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
          {rows.map((row, i) => (
            <li key={row.id} className="bg-[var(--panel)]">
              {open === row.id ? (
                <Editor
                  providers={providers}
                  existing={row}
                  onDone={(saved) => {
                    setOpen(null);
                    if (saved) load();
                  }}
                />
              ) : (
                <div className="flex items-stretch">
                  <div className="flex shrink-0 flex-col items-center justify-center border-r border-[var(--hairline)] px-2 text-[var(--fg-faint)]">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${row.label} up`} className="px-1 hover:text-[var(--fg)] disabled:opacity-25">↑</button>
                    <span className="font-mono text-[0.6rem] tabular-nums">{i + 1}</span>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${row.label} down`} className="px-1 hover:text-[var(--fg)] disabled:opacity-25">↓</button>
                  </div>

                  <div className="min-w-0 flex-1 px-5 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-medium">{row.label}</p>
                      <span className={`font-mono text-[0.62rem] uppercase tracking-[0.12em] ${STATUS[row.status].tone}`}>
                        {STATUS[row.status].label}
                        {row.status === "cooling_down" && row.available_at ? ` until ${time(row.available_at)}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[0.7rem] text-[var(--fg-dim)]">
                      {row.provider_name} · {row.model} · {row.key_hint}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fg-faint)]">
                      {row.requests_today} request{row.requests_today === 1 ? "" : "s"} today
                      {row.requests_today > 0 ? ` (${row.successes_today} answered)` : ""}
                      {row.last_success_at ? ` · last answer ${time(row.last_success_at)}` : ""}
                    </p>
                    {row.last_error_note && row.status !== "active" && (
                      <p className="mt-1.5 text-xs text-[var(--color-signal)]">{row.last_error_note}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 px-5 py-4 text-sm">
                    {row.status === "active" && (
                      <button type="button" disabled={busy === row.id} onClick={() => act(row, "test")} className="text-[var(--link)] hover:underline disabled:opacity-40">
                        {busy === row.id ? "Testing…" : "Test"}
                      </button>
                    )}
                    {(row.status === "cooling_down" || row.status === "invalid") && (
                      <button type="button" disabled={busy === row.id} onClick={() => act(row, "retry")} className="text-[var(--link)] hover:underline disabled:opacity-40">
                        {busy === row.id ? "Trying…" : "Retry now"}
                      </button>
                    )}
                    {row.status === "disabled" ? (
                      <button type="button" disabled={busy === row.id} onClick={() => act(row, "enable")} className="text-[var(--link)] hover:underline disabled:opacity-40">
                        {busy === row.id ? "Testing…" : "Enable"}
                      </button>
                    ) : (
                      <button type="button" disabled={busy === row.id} onClick={() => act(row, "disable")} className="text-[var(--fg-dim)] hover:text-[var(--fg)]">
                        Disable
                      </button>
                    )}
                    <button type="button" onClick={() => setOpen(row.id)} className="text-[var(--fg-dim)] hover:text-[var(--fg)]">
                      Edit
                    </button>
                    <button type="button" onClick={() => remove(row)} className="text-[var(--fg-faint)] hover:text-[var(--color-signal)]">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Editor({
  providers,
  existing,
  onDone,
}: {
  providers: AiProviderInfo[];
  existing?: AiCredential;
  onDone: (saved: boolean) => void;
}) {
  const [input, setInput] = useState<AiCredentialInput>({
    label: existing?.label ?? "",
    provider: existing?.provider ?? "gemini",
    model: existing?.model ?? "",
    base_url: existing?.base_url ?? null,
    api_key: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [test, setTest] = useState<AiTest | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const toast = useToast();

  const provider = providers.find((p) => p.key === input.provider);
  const set = <K extends keyof AiCredentialInput>(key: K, value: AiCredentialInput[K]) => {
    setInput((i) => ({ ...i, [key]: value }));
    setTest(null);
    setRefused(false);
  };
  const err = (key: string) => errors[key]?.[0];

  async function runTest() {
    setBusy("test");
    setErrors({});
    try {
      setTest(
        await admin.testAiDraft({
          id: existing?.id,
          provider: input.provider,
          model: input.model,
          base_url: input.base_url,
          api_key: input.api_key,
        }),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.errors);
      else toast.error(e instanceof Error ? e.message : "The test could not run.");
    } finally {
      setBusy(null);
    }
  }

  async function save(saveAnyway = false) {
    setBusy("save");
    setErrors({});
    try {
      const res = await admin.saveAiCredential({ ...input, save_anyway: saveAnyway }, existing?.id);
      if (res.test && !res.test.ok) toast.error(`Saved, but: ${res.test.message}`);
      else toast.success(saveAnyway ? "Saved as disabled." : "Saved — the key is in the rotation.");
      onDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const body = (e.body ?? {}) as { test?: AiTest };
        setErrors(e.errors);
        if (!Object.keys(e.errors).length) {
          // Refused by the provider: show why, offer to keep it disabled.
          setRefused(true);
          setTest(body.test ?? { ok: false, error_type: null, message: e.message, checks: [], latency_ms: null });
        }
      } else {
        toast.error(e instanceof Error ? e.message : "Saving failed.");
      }
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5 border border-[var(--hairline)] bg-[var(--panel)] p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" hint="How it shows in the list, e.g. Gemini #2" error={err("label")}>
          <input className="admin-input" value={input.label} maxLength={80} onChange={(e) => set("label", e.target.value)} />
        </Field>
        <Field label="Provider" error={err("provider")}>
          <select
            className="admin-input"
            value={input.provider}
            onChange={(e) => {
              set("provider", e.target.value);
              set("base_url", null);
            }}
          >
            {providers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {provider?.needs_base_url && (
          <Field label="API address" hint="The OpenAI-compatible base URL, e.g. https://api.example.com/v1" error={err("base_url")}>
            <input
              className="admin-input font-mono text-sm"
              type="url"
              placeholder="https://"
              value={input.base_url ?? ""}
              onChange={(e) => set("base_url", e.target.value.trim() || null)}
            />
          </Field>
        )}
        <Field label="Model" hint={provider?.models.length ? `e.g. ${provider.models.join(", ")}` : "The model name the provider expects"} error={err("model")}>
          <input
            className="admin-input font-mono text-sm"
            list={`models-${input.provider}`}
            value={input.model}
            maxLength={160}
            onChange={(e) => set("model", e.target.value)}
          />
          <datalist id={`models-${input.provider}`}>
            {provider?.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>
        <Field
          label="API key"
          hint={
            existing
              ? `Stored key ${existing.key_hint}. Leave blank to keep it.`
              : provider?.keys_at
                ? `Create one at ${provider.keys_at.replace(/^https:\/\//, "")}`
                : "Stored encrypted; never shown again."
          }
          error={err("api_key")}
        >
          <input
            className="admin-input font-mono text-sm"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={input.api_key}
            placeholder={existing ? "••••••••••••" : ""}
            onChange={(e) => set("api_key", e.target.value)}
          />
        </Field>
      </div>

      {test && (
        <div role="status" className="border border-[var(--hairline)] bg-[var(--ground)] px-4 py-3 text-sm">
          <ul className="flex flex-col gap-1">
            {test.checks.map((c) => (
              <li key={c.label} className={c.ok ? "text-[var(--link)]" : c.ok === false ? "text-[var(--color-signal)]" : "text-[var(--fg-faint)]"}>
                {c.ok ? "✓" : c.ok === false ? "✕" : "–"} {c.label}
              </li>
            ))}
          </ul>
          {!test.ok && <p className="mt-2 text-xs text-[var(--fg-dim)]">{test.message}</p>}
          {test.ok && test.latency_ms !== null && (
            <p className="mt-2 text-xs text-[var(--fg-faint)]">Answered in {(test.latency_ms / 1000).toFixed(1)} s.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={runTest}
          disabled={busy !== null || !input.model || (!existing && !input.api_key)}
          className="border border-[var(--hairline)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-40"
        >
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy !== null}
          className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-40"
        >
          {busy === "save" ? "Testing and saving…" : "Save"}
        </button>
        {refused && (
          <button type="button" onClick={() => save(true)} disabled={busy !== null} className="text-sm text-[var(--fg-dim)] underline-offset-4 hover:underline">
            Save it disabled anyway
          </button>
        )}
        <button type="button" onClick={() => onDone(false)} disabled={busy !== null} className="ml-auto text-sm text-[var(--fg-dim)]">
          Cancel
        </button>
      </div>
    </div>
  );
}
