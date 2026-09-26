"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useInboxPulse } from "@/components/admin/inbox-pulse";
import { PageSkeleton, RowsSkeleton } from "@/components/admin/skeleton";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  isSignedOut,
  type Client,
  type InboxContact,
  type InboxMessage,
} from "@/lib/admin/client";

/**
 * The WhatsApp inbox.
 *
 * The agency's number lives on the Cloud API only — no phone has it open —
 * so this is the one place its messages are read and answered. The list
 * and the open conversation refresh by themselves every few seconds; a
 * reply is allowed for 24 hours after the person last wrote, which is
 * WhatsApp's rule, not ours.
 */


const who = (c: InboxContact) =>
  c.is_self ? "You — reminders" : (c.client?.name ?? c.name ?? `+${c.wa_id}`);

const TYPE_LABEL: Record<string, string> = {
  image: "📷 Photo",
  video: "🎬 Video",
  audio: "🎤 Voice message",
  document: "📄 Document",
  sticker: "Sticker",
  location: "📍 Location",
  contacts: "👤 Contact",
  reaction: "Reaction",
  unsupported: "Message",
};

const SOURCE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  logins: "Logins",
  reminder: "Reminder",
  test: "Test",
};

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function left(until: string, now: number): string {
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** WhatsApp's *bold*, as the person sees it on their phone. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <strong key={i}>{part.slice(1, -1)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const size = (bytes: number | null) =>
  bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export default function InboxPage() {
  const [contacts, setContacts] = useState<InboxContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The conversation named in the address — the link in the alert email.
  const [openId, setOpenId] = useState<number | null>(() =>
    typeof window === "undefined" ? null : Number(new URLSearchParams(window.location.search).get("c")) || null,
  );

  const choose = (id: number | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", String(id));
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  };

  const loadList = useCallback(
    () =>
      admin.inbox().then(
        (r) => {
          setContacts(r.data);
          setError(null);
        },
        (e) => {
          if (!isSignedOut(e)) setError(e instanceof Error ? e.message : "The inbox did not load.");
        },
      ),
    [],
  );

  /*
   * Loaded once, then again only when the pulse says something happened —
   * a message, a receipt — instead of on a timer of its own.
   */
  const pulse = useInboxPulse();
  useEffect(() => {
    let live = true;
    admin.inbox().then(
      (r) => {
        if (!live) return;
        setContacts(r.data);
        setError(null);
      },
      (e) => live && !isSignedOut(e) && setError(e instanceof Error ? e.message : "The inbox did not load."),
    );
    return () => {
      live = false;
    };
  }, [pulse.version]);

  /** A conversation just opened is read; its badge goes at once. */
  const opened = (c: InboxContact) =>
    setContacts((list) => list?.map((x) => (x.id === c.id ? { ...c, unread: 0 } : x)) ?? list);

  if (error && !contacts) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }

  if (!contacts) {
    return (
      <PageSkeleton>
        <RowsSkeleton rows={6} />
      </PageSkeleton>
    );
  }

  const current = contacts.find((c) => c.id === openId) ?? null;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-xs text-[var(--fg-faint)]">WhatsApp · refreshes by itself</p>
      </div>

      <div className="mt-6 grid h-[calc(100dvh-11rem)] min-h-[28rem] border border-[var(--hairline)] bg-[var(--panel)] lg:grid-cols-[20rem_1fr]">
        {/* The list. On a phone it gives way to the open conversation. */}
        <aside
          className={`min-h-0 overflow-y-auto border-[var(--hairline)] lg:border-r ${openId ? "hidden lg:block" : ""}`}
        >
          {contacts.length === 0 ? (
            <p className="px-5 py-10 text-sm text-[var(--fg-faint)]">
              No messages yet. When someone writes to the agency&apos;s WhatsApp number, the conversation
              appears here — and you get an email.
            </p>
          ) : (
            <ul>
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c.id)}
                    className={`flex w-full items-start gap-3 border-b border-[var(--hairline)] px-4 py-3 text-left ${
                      c.id === openId
                        ? "bg-[color-mix(in_oklab,var(--link)_9%,transparent)]"
                        : "hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread ? "font-semibold" : ""}`}>{who(c)}</span>
                        <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--fg-faint)]">
                          {shortTime(c.last_message_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-[var(--fg-dim)]">
                          {c.last?.direction === "out" && "You: "}
                          {c.last?.body || (c.last ? (TYPE_LABEL[c.last.type] ?? "") : "")}
                        </span>
                        {c.unread > 0 && (
                          <span className="min-w-5 shrink-0 rounded-full bg-[#25d366] px-1.5 text-center font-mono text-[0.6rem] leading-[1.15rem] tabular-nums text-white">
                            {c.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`min-h-0 ${openId ? "flex" : "hidden lg:flex"} flex-col`}>
          {openId ? (
            <Thread
              key={openId}
              contactId={openId}
              version={pulse.version}
              initial={current}
              onBack={() => choose(null)}
              onOpened={opened}
              onChanged={loadList}
            />
          ) : (
            <p className="m-auto px-6 text-center text-sm text-[var(--fg-faint)]">Choose a conversation.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  contactId,
  version,
  initial,
  onBack,
  onOpened,
  onChanged,
}: {
  contactId: number;
  /** The inbox pulse: when it moves, the conversation is read again. */
  version: string | null;
  initial: InboxContact | null;
  onBack: () => void;
  onOpened: (c: InboxContact) => void;
  onChanged: () => void;
}) {
  const [contact, setContact] = useState<InboxContact | null>(initial);
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: InboxMessage[]) => {
    if (!incoming.length) return;
    setMessages((list) => {
      const map = new Map((list ?? []).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id - b.id);
    });
  }, []);

  /*
   * The whole conversation when it opens, and again each time the pulse
   * moves — a new message, or a receipt turning an old one's ticks blue.
   * Nothing is fetched while nothing happens.
   */
  useEffect(() => {
    let live = true;
    admin.inboxThread(contactId).then(
      (r) => {
        if (!live) return;
        setContact(r.contact);
        merge(r.messages);
        onOpened(r.contact);
      },
      (e) => live && setError(e instanceof Error ? e.message : "This conversation did not load."),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, version]);

  // Follow new messages down, unless the person has scrolled up to read.
  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const byWamid = useMemo(() => {
    const map = new Map<string, InboxMessage>();
    for (const m of messages ?? []) if (m.wamid) map.set(m.wamid, m);
    return map;
  }, [messages]);

  const reactions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of messages ?? []) {
      if (m.type === "reaction" && m.context_wamid && m.body) {
        map.set(m.context_wamid, [...(map.get(m.context_wamid) ?? []), m.body]);
      }
    }
    return map;
  }, [messages]);

  /*
   * What is drawn, with a day heading wherever the day changes. A reaction
   * to a message on screen is shown on that message, not as its own line.
   */
  const rows = useMemo(() => {
    const visible = (messages ?? []).filter(
      (m) => !(m.type === "reaction" && m.context_wamid && byWamid.has(m.context_wamid)),
    );
    return visible.map((m, i) => ({
      m,
      day: i === 0 || dayLabel(visible[i - 1].sent_at) !== dayLabel(m.sent_at) ? dayLabel(m.sent_at) : null,
    }));
  }, [messages, byWamid]);

  if (error) {
    return (
      <p role="alert" className="m-auto px-6 text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }

  return (
    <>
      {contact && (
        <ThreadHeader
          contact={contact}
          onBack={onBack}
          onLinked={(c) => {
            setContact(c);
            onChanged();
          }}
        />
      )}

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-[color-mix(in_oklab,var(--fg)_2.5%,var(--ground))] px-4 py-4"
      >
        {!messages ? (
          <p className="text-center text-xs text-[var(--fg-faint)]">Loading…</p>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {rows.map(({ m, day }) => {
              return (
                <div key={m.id} className="flex flex-col">
                  {day && (
                    <p className="my-3 self-center rounded bg-[var(--panel)] px-2.5 py-1 text-[0.68rem] text-[var(--fg-dim)] shadow-sm">
                      {day}
                    </p>
                  )}
                  <Bubble
                    message={m}
                    quoted={m.type !== "reaction" && m.context_wamid ? (byWamid.get(m.context_wamid) ?? null) : null}
                    reactions={m.wamid ? (reactions.get(m.wamid) ?? []) : []}
                  />
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {contact && (
        <Composer
          contact={contact}
          onSent={(sent) => {
            stick.current = true;
            merge(sent);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ThreadHeader({
  contact,
  onBack,
  onLinked,
}: {
  contact: InboxContact;
  onBack: () => void;
  onLinked: (c: InboxContact) => void;
}) {
  const [linking, setLinking] = useState(false);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function startLinking() {
    setLinking(true);
    if (!clients) {
      try {
        setClients(await admin.clients());
      } catch {
        setClients([]);
      }
    }
  }

  async function link(clientId: number | null) {
    setBusy(true);
    try {
      onLinked(await admin.inboxLink(contact.id, clientId));
      setLinking(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--hairline)] px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the list"
        className="text-lg text-[var(--fg-dim)] hover:text-[var(--fg)] lg:hidden"
      >
        ←
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{who(contact)}</p>
        <p className="truncate text-xs tabular-nums text-[var(--fg-faint)]">
          +{contact.wa_id}
          {contact.name && contact.name !== who(contact) ? ` · ${contact.name} on WhatsApp` : ""}
        </p>
      </div>
      {!contact.is_self &&
        (linking ? (
          <div className="flex items-center gap-2">
            <select
              className="admin-input w-auto py-1.5 text-xs"
              aria-label="Client"
              disabled={busy || !clients}
              defaultValue={contact.client?.id ?? ""}
              onChange={(e) => link(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{clients ? "Not a client" : "Loading…"}</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setLinking(false)}
              className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Cancel
            </button>
          </div>
        ) : contact.client ? (
          <span className="flex items-center gap-3 text-xs">
            <Link href={`/admin/clients/${contact.client.id}`} className="text-[var(--link)] hover:underline">
              Open client ↗
            </Link>
            <button type="button" onClick={startLinking} className="text-[var(--fg-faint)] hover:text-[var(--fg)]">
              Change
            </button>
          </span>
        ) : (
          <button type="button" onClick={startLinking} className="text-xs text-[var(--link)] hover:underline">
            Link to a client
          </button>
        ))}
    </header>
  );
}

function Ticks({ status }: { status: string }) {
  if (status === "failed") return <span className="text-[var(--color-signal)]">⚠</span>;
  if (status === "read") return <span className="text-[#34b7f1]">✓✓</span>;
  if (status === "delivered") return <span>✓✓</span>;
  return <span>✓</span>;
}

function Bubble({
  message: m,
  quoted,
  reactions,
}: {
  message: InboxMessage;
  quoted: InboxMessage | null;
  reactions: string[];
}) {
  const mine = m.direction === "out";
  const url = m.media?.available ? admin.inboxMedia(m.id) : null;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
          mine ? "bg-[color-mix(in_oklab,#25d366_16%,var(--panel))]" : "bg-[var(--panel)]"
        }`}
      >
        {m.source && SOURCE_LABEL[m.source] && (
          <p className="mb-1 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            {SOURCE_LABEL[m.source]}
            {m.type === "template" ? " · template" : ""}
          </p>
        )}

        {quoted && (
          <p className="mb-1.5 border-l-2 border-[var(--link)] bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] px-2 py-1 text-xs text-[var(--fg-dim)]">
            {(quoted.body ?? TYPE_LABEL[quoted.type] ?? "").slice(0, 120)}
          </p>
        )}

        {/* The file, as WhatsApp would show it. */}
        {(m.type === "image" || m.type === "sticker") &&
          (url ? (
            <a href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={m.body ?? "Photo"}
                className={`rounded ${m.type === "sticker" ? "max-h-32" : "max-h-72"} max-w-full object-contain`}
              />
            </a>
          ) : (
            <p className="text-xs text-[var(--fg-faint)]">{TYPE_LABEL[m.type]}</p>
          ))}
        {m.type === "audio" &&
          (url ? (
            <audio controls preload="none" src={url} className="w-64 max-w-full" />
          ) : (
            <p className="text-xs text-[var(--fg-faint)]">{TYPE_LABEL.audio}</p>
          ))}
        {m.type === "video" &&
          (url ? (
            <video controls preload="none" src={url} className="max-h-72 max-w-full rounded" />
          ) : (
            <p className="text-xs text-[var(--fg-faint)]">{TYPE_LABEL.video}</p>
          ))}
        {(m.type === "document" || (m.type === "template" && m.media?.name)) && (
          <DocumentChip name={m.media?.name ?? "Document"} detail={size(m.media?.size ?? null)} url={url} />
        )}
        {m.type === "location" && m.extra?.latitude != null && (
          <a
            href={`https://www.google.com/maps?q=${m.extra.latitude},${m.extra.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--link)] hover:underline"
          >
            📍 {m.extra.name || m.extra.address || "Open the location"} ↗
          </a>
        )}
        {m.type === "reaction" && <p className="text-xs text-[var(--fg-dim)]">Reacted {m.body}</p>}
        {m.type === "unsupported" && (
          <p className="text-xs italic text-[var(--fg-faint)]">A kind of message the dashboard cannot show.</p>
        )}

        {m.body && m.type !== "reaction" && m.type !== "location" && (
          <p
            dir="auto"
            className={`whitespace-pre-wrap break-words ${m.type !== "text" && m.type !== "template" && m.type !== "contacts" && m.type !== "button" && m.type !== "interactive" ? "mt-1.5" : ""}`}
          >
            <Formatted text={m.body} />
          </p>
        )}
        {m.type === "location" && m.body && <p className="mt-1 text-xs text-[var(--fg-dim)]">{m.body}</p>}

        {m.error && <p className="mt-1 text-xs text-[var(--color-signal)]">{m.error}</p>}

        <p className="mt-1 flex items-center justify-end gap-1.5 text-[0.62rem] tabular-nums text-[var(--fg-faint)]">
          {new Date(m.sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          {mine && <Ticks status={m.status} />}
        </p>

        {reactions.length > 0 && (
          <span className="absolute -bottom-2.5 left-2 rounded-full bg-[var(--panel)] px-1.5 text-xs shadow">
            {reactions.join("")}
          </span>
        )}
      </div>
    </div>
  );
}

function DocumentChip({ name, detail, url }: { name: string; detail: string; url: string | null }) {
  const inner = (
    <span className="flex items-center gap-2.5 rounded bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-2.5 py-2">
      <span className="font-mono text-[0.6rem] font-bold text-[var(--color-signal)]">
        {name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs">{name}</span>
        {detail && <span className="block text-[0.65rem] text-[var(--fg-faint)]">{detail}</span>}
      </span>
      {url && <span className="ml-auto text-xs text-[var(--link)]">↓</span>}
    </span>
  );
  return url ? (
    <a href={url} className="block hover:opacity-90">
      {inner}
    </a>
  ) : (
    <span className="block">{inner}</span>
  );
}

function Composer({ contact, onSent }: { contact: InboxContact; onSent: (sent: InboxMessage[]) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // The countdown moves on its own.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const open = !!contact.reply_until && new Date(contact.reply_until).getTime() > now;

  if (!open) {
    return (
      <p className="border-t border-[var(--hairline)] px-4 py-3 text-xs text-[var(--fg-faint)]">
        Free replies are allowed for 24 hours after they write, and they have not written in that time.
        Until they do, WhatsApp only accepts an approved template — an invoice or logins from their client
        page.
      </p>
    );
  }

  async function send() {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    try {
      const sent = await admin.inboxReply(contact.id, text.trim(), file);
      setText("");
      setFile(null);
      onSent(sent);
    } catch (e) {
      // What was typed stays in the box, to send again.
      toast.error(e, "It was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--hairline)] px-4 py-3">
      {file && (
        <p className="mb-2 flex items-center gap-3 text-xs">
          <span className="truncate">📎 {file.name}</span>
          <span className="text-[var(--fg-faint)]">{size(file.size)}</span>
          <button type="button" onClick={() => setFile(null)} className="text-[var(--fg-faint)] hover:text-[var(--color-signal)]">
            Remove
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          aria-label="Attach a file"
          className="shrink-0 border border-[var(--hairline)] px-2.5 py-2 text-sm hover:border-[var(--fg)]"
        >
          📎
        </button>
        <input
          ref={picker}
          type="file"
          hidden
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <textarea
          dir="auto"
          rows={1}
          maxLength={4096}
          className="admin-input max-h-40 min-h-[2.4rem] flex-1 resize-y"
          placeholder="Write a reply — Enter sends, Shift+Enter for a new line"
          aria-label="Reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || (!text.trim() && !file)}
          className="shrink-0 bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <p className="mt-1.5 text-[0.68rem] text-[var(--fg-faint)]">
        Free replies are open: {left(contact.reply_until!, now)} of the 24 hours since their last message.
      </p>
    </div>
  );
}
