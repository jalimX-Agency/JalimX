"use client";

import { useState } from "react";

import { Field } from "@/components/admin/fields";
import {
  admin,
  ApiError,
  type Client,
  type Credential,
  type CredentialInput,
} from "@/lib/admin/client";

/**
 * The logins a client's work needs: their hosting, their CMS, the booking
 * platform, the social accounts.
 *
 * Kept against the client rather than one job, because the hosting for a
 * riad is the same hosting whether this month's work is a rebuild or a
 * retainer. Each one can say which work it belongs to, and most do.
 *
 * Passwords are encrypted in the database and are not in the list at all —
 * the row says that one exists, and asks for it only when you press Show.
 * That keeps every password on the page out of the response, the browser
 * cache and anything watching the network, to draw a row of dots.
 */
export function Logins({ client }: { client: Client }) {
  const [rows, setRows] = useState<Credential[]>(client.credentials ?? []);
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [protect, setProtect] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [to, setTo] = useState(client.email ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handed, setHanded] = useState<{ password: string | null; sentTo?: string } | null>(null);

  const works = client.engagements ?? [];
  const ids = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const all = rows.length > 0 && ids.length === rows.length;

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Decoded in the browser and saved; the PDF never sits behind a URL. */
  async function downloadSheet() {
    setBusy(true);
    setError(null);
    setHanded(null);
    try {
      const sheet = await admin.credentialSheet(client.id, ids, protect);
      const bytes = Uint8Array.from(atob(sheet.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = sheet.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setHanded({ password: sheet.password });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function emailSheet() {
    const recipient = to.trim() || client.email || "";
    const count = `${ids.length} ${ids.length === 1 ? "login" : "logins"}`;
    if (
      !window.confirm(
        [
          `Email ${count} to ${recipient}?`,
          "They go as a password-protected PDF. The password is not in the email: you will see it here, to send by phone or WhatsApp.",
        ].join("\n\n"),
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setHanded(null);
    try {
      const sent = await admin.sendCredentials(
        client.id,
        ids,
        to.trim() || null,
        note.trim() || null,
      );
      setHanded({ password: sent.password, sentTo: sent.sent_to });
      setEmailing(false);
      setNote("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setError(Object.values(e.errors)[0]?.[0] ?? e.message);
      } else {
        setError(e instanceof Error ? e.message : "Could not send it.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <input
              type="checkbox"
              aria-label="Select every login"
              checked={all}
              onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
            />
          )}
          <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-dim)]">
            {rows.length === 0
              ? "Logins"
              : ids.length > 0
                ? `${ids.length} of ${rows.length} selected`
                : `${rows.length} ${rows.length === 1 ? "login" : "logins"}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? null : "new")}
          className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)]"
        >
          {open === "new" ? "Cancel" : "+ Add login"}
        </button>
      </header>

      {/* Handing logins over. Only shown once something is chosen, so the
          everyday view stays a plain list. */}
      {ids.length > 0 && (
        <div className="border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={downloadSheet}
              disabled={busy}
              className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {busy && !emailing ? "Making it…" : "Download PDF"}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-dim)]">
              <input
                type="checkbox"
                checked={protect}
                onChange={(e) => setProtect(e.target.checked)}
              />
              Protect with a password
            </label>
            <button
              type="button"
              onClick={() => setEmailing((v) => !v)}
              disabled={busy}
              className="border border-[var(--hairline)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
            >
              {emailing ? "Close" : "Email to client"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setEmailing(false);
              }}
              className="text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
            >
              Clear selection
            </button>
          </div>

          {emailing && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Send to" hint="Their address, or whoever you deal with">
                <input
                  type="email"
                  className="admin-input"
                  value={to}
                  placeholder={client.email ?? "name@company.ma"}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="A line of your own" hint="Optional, added to the email">
                <input
                  className="admin-input"
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <button
                  type="button"
                  onClick={emailSheet}
                  disabled={busy || !(to.trim() || client.email)}
                  className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
                <p className="text-xs text-[var(--fg-faint)]">
                  Always sent protected. The password stays here, never in the
                  email.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="border-b border-[var(--hairline)] px-5 py-3 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {handed && <Handed result={handed} onDone={() => setHanded(null)} />}

      {open === "new" && (
        <LoginEditor
          client={client}
          value={{ label: "", engagement_id: null, url: null, username: null, secret: "", notes: "" }}
          onCancel={() => setOpen(null)}
          onSave={async (input) => {
            const created = await admin.createCredential(client.id, input);
            setRows((r) => [...r, created].sort((a, b) => a.label.localeCompare(b.label)));
            setOpen(null);
          }}
        />
      )}

      {rows.length === 0 && open !== "new" ? (
        <div className="px-5 py-8">
          <p className="max-w-[60ch] text-sm text-[var(--fg-faint)]">
            Hosting, the CMS, the booking platform, the social accounts —
            whatever you have to sign into to do their work. Passwords are
            encrypted, and shown one at a time.
          </p>
          <p className="mt-3 max-w-[60ch] text-xs text-[var(--fg-faint)]">
            Not for anything that moves money: keep bank logins and payment
            details out of here.
          </p>
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="border-t border-[var(--hairline)]">
              {open === row.id ? (
                <LoginEditor
                  client={client}
                  credential={row}
                  value={{
                    label: row.label,
                    engagement_id: row.engagement_id,
                    url: row.url,
                    username: row.username,
                  }}
                  onCancel={() => setOpen(null)}
                  onSave={async (input) => {
                    const next = await admin.updateCredential(row.id, input);
                    setRows((r) => r.map((x) => (x.id === row.id ? next : x)));
                    setOpen(null);
                  }}
                  onDeleted={async () => {
                    await admin.removeCredential(row.id);
                    setRows((r) => r.filter((x) => x.id !== row.id));
                    setOpen(null);
                  }}
                />
              ) : (
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.label}`}
                    className="mt-[1.15rem] ml-5 shrink-0"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <LoginRow
                      credential={row}
                      work={works.find((w) => w.id === row.engagement_id)?.title ?? null}
                      onEdit={() => setOpen(row.id)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What just went out, and the password that did not go with it.
 *
 * Shown once. Closing it does not bring it back: a new PDF means a new
 * password, which is the point.
 */
function Handed({
  result,
  onDone,
}: {
  result: { password: string | null; sentTo?: string };
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="border-b border-[var(--hairline)] px-5 py-4" role="status">
      <p className="text-sm">
        {result.sentTo ? (
          <>
            Sent to <strong>{result.sentTo}</strong>.
          </>
        ) : (
          "The PDF is downloading."
        )}
      </p>
      {result.password && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            PDF password
          </span>
          <span className="select-all border border-[var(--hairline)] bg-[var(--panel)] px-3 py-1.5 font-mono text-base tracking-wider">
            {result.password}
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.password ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // The value is selectable, so copying by hand still works.
              }
            }}
            className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      {result.password && (
        <p className="mt-2 max-w-[60ch] text-xs text-[var(--color-signal)]">
          {result.sentTo
            ? "Send this by phone or WhatsApp, not by email. It is shown once."
            : "Keep it apart from the file. It is shown once."}
        </p>
      )}
      <button
        type="button"
        onClick={onDone}
        className="mt-3 text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        Done
      </button>
    </div>
  );
}

function LoginRow({
  credential,
  work,
  onEdit,
}: {
  credential: Credential;
  work: string | null;
  onEdit: () => void;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"user" | "secret" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    if (secret !== null) {
      setSecret(null);
      setNotes(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const got = await admin.revealCredential(credential.id);
      setSecret(got.secret);
      setNotes(got.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch it.");
    } finally {
      setBusy(false);
    }
  }

  /** Copies without showing: most of the time you want to paste, not read. */
  async function copy(what: "user" | "secret") {
    setError(null);
    try {
      const value =
        what === "user"
          ? (credential.username ?? "")
          : (secret ?? (await admin.revealCredential(credential.id)).secret);
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("The browser would not let me copy. Press Show and copy by hand.");
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {credential.label}
            {work && <span className="font-normal text-[var(--fg-faint)]"> · {work}</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-[var(--fg-faint)]">
            {credential.url && (
              <a
                href={credential.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--link)] underline-offset-4 hover:underline"
              >
                {credential.url.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
            {credential.username && <span>{credential.username}</span>}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs">
          {credential.username && (
            <button
              type="button"
              onClick={() => copy("user")}
              className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              {copied === "user" ? "Copied" : "Copy user"}
            </button>
          )}
          {credential.has_secret && (
            <>
              <button
                type="button"
                onClick={() => copy("secret")}
                className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                {copied === "secret" ? "Copied" : "Copy password"}
              </button>
              <button
                type="button"
                onClick={reveal}
                disabled={busy}
                className="text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
              >
                {busy ? "…" : secret !== null ? "Hide" : "Show"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Edit
          </button>
        </div>
      </div>

      {secret !== null && (
        <div className="mt-3 border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-4 py-3">
          <p className="font-mono text-sm break-all select-all">{secret || "— none stored —"}</p>
          {notes && (
            <p className="mt-2 text-xs whitespace-pre-wrap text-[var(--fg-dim)]">{notes}</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-signal)]">
          {error}
        </p>
      )}
    </div>
  );
}

function LoginEditor({
  client,
  credential,
  value,
  onSave,
  onCancel,
  onDeleted,
}: {
  client: Client;
  credential?: Credential;
  value: CredentialInput;
  onSave: (input: CredentialInput) => Promise<void>;
  onCancel: () => void;
  onDeleted?: () => Promise<void>;
}) {
  const [input, setInput] = useState<CredentialInput>(value);
  const [secret, setSecret] = useState("");
  const [notes, setNotes] = useState("");
  const [touchedSecret, setTouchedSecret] = useState(!credential);
  /* Typed in the open by default: a password you cannot read is a password
     you mistype, and nobody is reading over your shoulder here. */
  const [showSecret, setShowSecret] = useState(true);
  const [touchedNotes, setTouchedNotes] = useState(!credential);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const err = (key: string) => errors[key]?.[0];
  const works = client.engagements ?? [];

  async function submit() {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      /*
       * The password is sent only when it was typed. Sending an empty
       * field on every save would wipe the stored one each time the label
       * was corrected.
       */
      await onSave({
        ...input,
        ...(touchedSecret ? { secret: secret || null } : {}),
        ...(touchedNotes ? { notes: notes || null } : {}),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
        setMessage(Object.values(e.errors)[0]?.[0] ?? "Check the fields above.");
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDeleted) return;
    if (!window.confirm(`Delete "${input.label || "this login"}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDeleted();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What is it" hint="Hosting, WordPress, Instagram…" error={err("label")}>
          <input
            className="admin-input"
            maxLength={120}
            value={input.label}
            aria-invalid={!!err("label")}
            onChange={(e) => setInput((i) => ({ ...i, label: e.target.value }))}
          />
        </Field>

        {works.length > 0 && (
          <Field label="For which work" hint="Optional" error={err("engagement_id")}>
            <select
              className="admin-input"
              value={input.engagement_id ?? ""}
              onChange={(e) =>
                setInput((i) => ({
                  ...i,
                  engagement_id: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            >
              <option value="">Not tied to one</option>
              {works.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Where you sign in" error={err("url")}>
          <input
            className="admin-input"
            maxLength={190}
            placeholder="https://"
            value={input.url ?? ""}
            onChange={(e) => setInput((i) => ({ ...i, url: e.target.value.trim() || null }))}
          />
        </Field>

        <Field label="User" error={err("username")}>
          <input
            className="admin-input"
            maxLength={190}
            autoComplete="off"
            value={input.username ?? ""}
            onChange={(e) => setInput((i) => ({ ...i, username: e.target.value || null }))}
          />
        </Field>

        <Field
          label="Password"
          hint={
            credential
              ? "Leave empty to keep the one already stored"
              : "Encrypted before it is written down"
          }
          error={err("secret")}
        >
          <span className="relative block">
            <input
              type={showSecret ? "text" : "password"}
              className="admin-input pr-16 font-mono"
              maxLength={500}
              autoComplete="new-password"
              spellCheck={false}
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setTouchedSecret(true);
              }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              {showSecret ? "Hide" : "Show"}
            </button>
          </span>
        </Field>

        <Field
          label="Notes"
          hint={
            credential
              ? "Leave empty to keep what is there. Encrypted too."
              : "Recovery email, which account, anything else. Encrypted too."
          }
          error={err("notes")}
        >
          <textarea
            rows={2}
            maxLength={2000}
            className="admin-input resize-y leading-relaxed"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setTouchedNotes(true);
            }}
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[var(--color-signal)]">
          {message}
        </p>
        <div className="flex items-center gap-4">
          {onDeleted && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !input.label.trim()}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
