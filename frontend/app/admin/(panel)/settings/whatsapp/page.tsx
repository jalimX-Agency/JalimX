"use client";

import { useEffect, useRef, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  ApiError,
  isSignedOut,
  type ReminderTemplate,
  type WhatsAppSettings,
} from "@/lib/admin/client";

/**
 * Settings → WhatsApp.
 *
 * Which number the task reminders go to, and what they say. The
 * credentials that connect to Meta are not on this page and cannot be:
 * they live in the server's environment.
 *
 * Every change to a template's wording goes back to Meta for review. While
 * one is in review, reminders are not held up — they go out with the next
 * approved template down, so a task may briefly arrive without its notes
 * or checklist lines, but it arrives.
 */

const STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Approved", tone: "border-[var(--link)] text-[var(--link)]" },
  PENDING: {
    label: "In review",
    tone: "border-[color-mix(in_oklab,#c98a1b_70%,var(--fg))] text-[color-mix(in_oklab,#c98a1b_80%,var(--fg))]",
  },
  IN_APPEAL: {
    label: "In appeal",
    tone: "border-[color-mix(in_oklab,#c98a1b_70%,var(--fg))] text-[color-mix(in_oklab,#c98a1b_80%,var(--fg))]",
  },
  REJECTED: { label: "Rejected", tone: "border-[var(--color-signal)] text-[var(--color-signal)]" },
  PAUSED: { label: "Paused by Meta", tone: "border-[var(--color-signal)] text-[var(--color-signal)]" },
  DISABLED: { label: "Disabled by Meta", tone: "border-[var(--color-signal)] text-[var(--color-signal)]" },
};

function StatusPill({ status }: { status: string | null }) {
  const s = status
    ? (STATUS[status] ?? { label: status.toLowerCase(), tone: "border-[var(--hairline)] text-[var(--fg-faint)]" })
    : { label: "Not created", tone: "border-[var(--hairline)] text-[var(--fg-faint)]" };
  return (
    <span className={`inline-block border px-1.5 py-px font-mono text-[0.56rem] uppercase tracking-[0.12em] ${s.tone}`}>
      {s.label}
    </span>
  );
}

/** The same checks the server makes, so a mistake shows before it is sent. */
function problem(body: string, params: number): string | null {
  const text = body.trim();
  if (!text) return "The message cannot be empty.";
  if (text.length > 1024) return "WhatsApp allows at most 1024 characters.";
  const found = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  const wanted = Array.from({ length: params }, (_, i) => i + 1);
  if (found.join(",") !== wanted.join(",")) {
    return `Use each of ${wanted.map((n) => `{{${n}}}`).join(", ")} exactly once, and no others.`;
  }
  if (/^\{\{\d+\}\}|\{\{\d+\}\}$/.test(text)) {
    return "The message cannot start or end with a variable — add some words around it.";
  }
  if (/\}\}\s*\{\{/.test(text)) return "Two variables cannot sit side by side — put some words between them.";
  return null;
}

/** WhatsApp's own *bold*, rendered for the preview. */
function Formatted({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <strong key={i}>{p.slice(1, -1)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Roughly how it will look on the phone, with sample values filled in. */
function Preview({ body, template }: { body: string; template: ReminderTemplate }) {
  const filled = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => template.example[Number(n) - 1] ?? `{{${n}}}`);
  return (
    <div
      className="max-w-sm rounded-lg bg-[color-mix(in_oklab,#25d366_10%,var(--panel))] p-3"
      dir={template.language === "ar" ? "rtl" : "ltr"}
    >
      <div className="rounded-md bg-[var(--panel)] px-3 py-2.5 text-sm leading-relaxed shadow-sm">
        {template.document && (
          // The PDF sits above the words, the way WhatsApp shows it.
          <div className="mb-2.5 flex items-center gap-2 rounded bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-2.5 py-2 text-xs" dir="ltr">
            <span className="font-mono text-[0.6rem] font-bold text-[var(--color-signal)]">PDF</span>
            <span className="truncate">{template.document}</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">
          <Formatted text={filled} />
        </p>
        <p className="mt-2 text-xs text-[var(--fg-faint)]">{template.footer}</p>
      </div>
      {template.button && (
        <div className="mt-1 rounded-md bg-[var(--panel)] py-2 text-center text-sm text-[var(--link)] shadow-sm">
          ↗ {template.button}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppSettingsPage() {
  const [data, setData] = useState<WhatsAppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ask = useConfirm();
  const toast = useToast();

  useEffect(() => {
    let live = true;
    admin.whatsapp().then(
      (d) => live && setData(d),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <PageSkeleton>
        <PanelsSkeleton panels={3} />
      </PageSkeleton>
    );
  }

  const approved = (name: string) =>
    data.templates.find((t) => t.name === name)?.status === "APPROVED" ||
    (name === data.legacy.name && data.legacy.status === "APPROVED");
  const basic = data.templates.find((t) => t.key === "basic");
  const fallback = basic && approved(basic.name) ? basic.label : approved(data.legacy.name) ? "the first template" : null;
  const missing = data.templates.some((t) => t.status === null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e, "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    if (!data?.recipient) return;
    if (
      !(await ask({
        title: "Send a test reminder?",
        body: `A sample reminder will be sent on WhatsApp to +${data.recipient}.`,
        confirmLabel: "Send test",
      }))
    ) {
      return;
    }
    await run("test", async () => {
      const r = await admin.testWhatsApp();
      toast.success(`Test sent to +${r.to}.`, `Using “${r.template}”. Check WhatsApp.`);
    });
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-2 max-w-[62ch] text-sm text-[var(--fg-dim)]">
          Task reminders are sent from the agency&apos;s WhatsApp number to yours. Here you choose which number
          receives them and what they say. Any change to the wording goes back to Meta for review.
        </p>
      </div>


      {/* ——— Connection ——— */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)] px-5 py-5">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">Connection</h2>
        {!data.configured ? (
          <p className="mt-3 text-sm text-[var(--color-signal)]">
            Not connected. The WhatsApp credentials are missing from the server&apos;s environment.
          </p>
        ) : data.connection ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <span>
              Sending from <strong>{data.connection.name}</strong>{" "}
              <span className="tabular-nums text-[var(--fg-dim)]">{data.connection.number}</span>
            </span>
            <span className="text-xs text-[var(--fg-faint)]">
              Quality: {data.connection.quality === "GREEN" ? "good" : data.connection.quality.toLowerCase()}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-signal)]">{data.error}</p>
        )}
      </section>

      {/* ——— Recipient ——— */}
      <Recipient
        value={data.recipient}
        onSaved={(recipient) => setData((d) => (d ? { ...d, recipient } : d))}
        onTest={test}
        testing={busy === "test"}
        canTest={!!data.connection && !!fallback}
      />

      {/* ——— Templates ——— */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Reminders to you</h2>
            <p className="mt-1 max-w-[62ch] text-sm text-[var(--fg-dim)]">
              A task gets the message that matches it: with its notes, its checklist, both, or neither. WhatsApp
              does not allow empty lines in a template, which is why there are four.
            </p>
          </div>
          {missing && data.connection && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("missing", async () => {
                  setData(await admin.createMissingReminderTemplates());
                  toast.success("Sent to Meta for review.", "It usually takes from a few minutes to a few hours.");
                })
              }
              className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {busy === "missing" ? "Sending…" : "Create missing templates"}
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-[var(--fg-faint)]">
          {fallback
            ? `While a message is in review, reminders go out with ${fallback} instead — without the notes and checklist lines.`
            : "No reminder message is approved yet, so reminders are held until Meta approves one."}
        </p>

        <div className="mt-6 space-y-4">
          {data.templates
            .filter((t) => t.group === "reminders")
            .map((t) => (
              <TemplateCard
                key={t.key}
                template={t}
                disabled={!data.connection || busy !== null}
                onSaved={(next) => {
                  setData(next);
                  toast.success(`“${t.label}” sent to Meta for review.`);
                }}
              />
            ))}
        </div>
      </section>

      {/* ——— To clients ——— */}
      <section>
        <h2 className="font-display text-xl font-semibold">Messages to clients</h2>
        <p className="mt-1 max-w-[62ch] text-sm text-[var(--fg-dim)]">
          Sent from a client&apos;s page: an issued invoice from the Money tab, logins from the Logins tab. In
          French, with the PDF attached. When the logins PDF has a password, it is never in the message — you give it
          another way. A logins PDF sent without one goes with its own wording, which does not mention a password.
        </p>
        <p className="mt-4 text-xs text-[var(--fg-faint)]">
          Only send to clients who agreed to hear from you on WhatsApp. If people report the messages, Meta
          lowers the number&apos;s quality and can limit it.
        </p>
        <div className="mt-6 space-y-4">
          {data.templates
            .filter((t) => t.group === "clients")
            .map((t) => (
              <TemplateCard
                key={t.key}
                template={t}
                disabled={!data.connection || busy !== null}
                onSaved={(next) => {
                  setData(next);
                  toast.success(`“${t.label}” sent to Meta for review.`);
                }}
              />
            ))}
        </div>
      </section>
    </div>
  );
}

function Recipient({
  value,
  onSaved,
  onTest,
  testing,
  canTest,
}: {
  value: string | null;
  onSaved: (recipient: string) => void;
  onTest: () => void;
  testing: boolean;
  canTest: boolean;
}) {
  const [input, setInput] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const dirty = input.trim() !== (value ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await admin.updateWhatsAppRecipient(input);
      setInput(next);
      onSaved(next);
      setSaved(true);
      toast.success(`Reminders will go to +${next}.`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? (Object.values(e.errors)[0]?.[0] ?? e.message)
          : e instanceof Error
            ? e.message
            : "Saving failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)] px-5 py-5">
      <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
        Reminders go to
      </h2>
      <form
        className="mt-3 flex flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        <div className="min-w-0 flex-1 basis-60">
          <Field
            label="Your WhatsApp number"
            hint="With the country code — 0612345678 becomes 212612345678 on its own."
            error={error ?? undefined}
          >
            <input
              className="admin-input tabular-nums"
              inputMode="tel"
              maxLength={30}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={!canTest || !value || dirty || testing}
            title={dirty ? "Save the number first" : undefined}
            className="border border-[var(--hairline)] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-35"
          >
            {testing ? "Sending…" : "Send a test"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TemplateCard({
  template,
  disabled,
  onSaved,
}: {
  template: ReminderTemplate;
  disabled: boolean;
  onSaved: (next: WhatsAppSettings) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(template.body);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const ask = useConfirm();

  const local = problem(body, template.params.length);
  const changed = body.trim() !== template.body.trim();
  const inReview = template.status === "PENDING" || template.status === "IN_APPEAL";

  /** Puts {{n}} where the cursor is, since typing braces is fiddly. */
  function insert(n: number) {
    const el = area.current;
    const token = `{{${n}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    if (local || saving) return;
    if (
      template.status === "APPROVED" &&
      !(await ask({
        title: `Send “${template.label}” back to review?`,
        body: [
          template.group === "reminders"
            ? "Meta has to approve the new wording before it can be used. Until then, tasks that need this message get a simpler one."
            : "Meta has to approve the new wording before it can be used. Until then, this message cannot be sent to clients.",
          "Meta also limits how often an approved message can be changed — about once a day.",
        ],
        confirmLabel: "Send for review",
      }))
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await admin.updateReminderTemplate(template.key, body));
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? (Object.values(e.errors)[0]?.[0] ?? e.message)
          : e instanceof Error
            ? e.message
            : "Saving failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-medium">{template.label}</h3>
            <StatusPill status={template.status} />
          </div>
          <p className="mt-0.5 text-xs text-[var(--fg-faint)]">{template.hint}</p>
        </div>
        {!editing && (
          <button
            type="button"
            disabled={disabled || inReview}
            title={inReview ? "Meta is reviewing it — it can be changed once they answer." : undefined}
            onClick={() => {
              setBody(template.body);
              setError(null);
              setEditing(true);
            }}
            className="text-xs text-[var(--link)] hover:underline disabled:text-[var(--fg-faint)] disabled:no-underline"
          >
            Edit wording
          </button>
        )}
      </header>

      {template.status === "REJECTED" && (
        <p className="border-b border-[var(--hairline)] px-5 py-2.5 text-xs text-[var(--color-signal)]">
          Meta rejected this wording{template.rejected_reason ? ` (${template.rejected_reason.toLowerCase().replace(/_/g, " ")})` : ""}.
          Change it and send it again.
        </p>
      )}

      <div className={`grid gap-6 px-5 py-5 ${editing ? "lg:grid-cols-2" : ""}`}>
        {editing && (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--fg-faint)]">Insert:</span>
              {template.params.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insert(i + 1)}
                  className="border border-[var(--hairline)] px-2 py-1 text-xs hover:border-[var(--fg)]"
                >
                  <span className="font-mono">{`{{${i + 1}}}`}</span> {p}
                </button>
              ))}
            </div>
            <textarea
              ref={area}
              dir={template.language === "ar" ? "rtl" : "ltr"}
              rows={12}
              maxLength={1024}
              className="admin-input font-sans leading-relaxed"
              aria-label={`Wording of ${template.label}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-[var(--fg-faint)]">
              *Stars* make text bold on WhatsApp. {body.trim().length}/1024
            </p>
            {(error || (changed && local)) && (
              <p role="alert" className="mt-2 text-xs text-[var(--color-signal)]">
                {error ?? local}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setBody(template.default_body)}
                disabled={body === template.default_body}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-35"
              >
                Back to the original wording
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!changed || !!local || saving}
                  className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
                >
                  {saving ? "Sending…" : template.status ? "Send for review" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          {editing && (
            <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
              Preview
            </p>
          )}
          <Preview body={editing ? body : template.body} template={template} />
        </div>
      </div>
    </article>
  );
}
