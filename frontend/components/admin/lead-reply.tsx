"use client";

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { useToast } from "@/components/admin/toast";
import { admin, type Lead, type ReplyTone } from "@/lib/admin/client";
import { BUILTIN_TEMPLATES, fillTemplate, type ReplyTemplate } from "@/lib/admin/reply-templates";

/**
 * Answering an enquiry by email from the dashboard.
 *
 * The AI draft is a starting point written into the two fields; nothing is
 * sent until the person has read it and pressed Send, and the confirmation
 * names the address it is going to. The WhatsApp option adds a button under
 * the email that opens a chat with the agency's own number, so the client
 * can carry on there.
 */

const TONES: { value: ReplyTone; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
];

const LANGS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
] as const;

type Lang = (typeof LANGS)[number]["value"];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function LeadReply({ lead, onSent }: { lead: Lead; onSent: (lead: Lead) => void }) {
  const toast = useToast();
  const ask = useConfirm();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<ReplyTone>("warm");
  const [language, setLanguage] = useState<Lang>(lead.locale === "fr" ? "fr" : "en");
  const [instruction, setInstruction] = useState("");
  const [whatsapp, setWhatsapp] = useState(Boolean(lead.reply_whatsapp));
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const [saved, setSaved] = useState<ReplyTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [tweak, setTweak] = useState("");
  const [tweaking, setTweaking] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    admin.leadReplyTemplates().then(
      (items) => live && setSaved(items),
      () => undefined, // the built-in ones still work
    );
    return () => {
      live = false;
    };
  }, [open]);

  const templates = [...BUILTIN_TEMPLATES, ...saved];
  const replies = lead.replies ?? [];
  const ready = subject.trim() !== "" && body.trim().length >= 5;

  async function draft() {
    if (body.trim() !== "" && !(await ask({
      title: "Replace what you wrote?",
      body: "A new draft overwrites the subject and the message below.",
      confirmLabel: "Write a new draft",
    }))) {
      return;
    }

    setDrafting(true);
    try {
      const d = await admin.draftLeadReply(lead.id, {
        tone,
        language,
        instruction: instruction.trim() || undefined,
        whatsapp: whatsapp && Boolean(lead.reply_whatsapp),
      });
      setSubject(d.subject);
      setBody(d.body);
      toast.success("Draft ready.", "Read it and change what you like before sending.");
    } catch (e) {
      toast.error(e, "Could not write a draft.");
    } finally {
      setDrafting(false);
    }
  }

  async function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (body.trim() !== "" && !(await ask({
      title: "Replace what you wrote?",
      body: "The template overwrites the subject and the message below.",
      confirmLabel: "Use the template",
    }))) {
      setTemplateId("");
      return;
    }
    setSubject(fillTemplate(t.subject, lead));
    setBody(fillTemplate(t.body, lead));
  }

  /** Changes the text in the box as asked, in the person's own words. */
  async function applyTweak() {
    const request = tweak.trim();
    if (!request || body.trim() === "") return;
    setTweaking(true);
    try {
      const res = await admin.aiAssist({
        action: "custom",
        text: body,
        instruction: request,
        field: {
          label: "Email reply to a website enquiry",
          hint: "Keep the greeting and the sign-off. Do not invent prices or dates.",
          lang: language,
          max_length: 8000,
          multiline: true,
        },
        context: [{ label: "What the visitor wrote", value: lead.message.slice(0, 600) }],
      });
      setBody(res.text);
      setTweak("");
      toast.success("Changed.", "Read it before sending.");
    } catch (e) {
      toast.error(e, "Could not change the text.");
    } finally {
      setTweaking(false);
    }
  }

  async function saveAsTemplate() {
    if (!ready) return;
    const name = window.prompt("Name this template", subject.trim().slice(0, 60));
    if (!name?.trim()) return;
    try {
      const next = await admin.saveLeadReplyTemplates([
        ...saved.map(({ id, name: n, subject: s, body: b }) => ({ id, name: n, subject: s, body: b })),
        { name: name.trim(), subject: subject.trim(), body: body.trim() },
      ]);
      setSaved(next);
      toast.success("Template saved.", "It is in the list above for the next enquiry.");
    } catch (e) {
      toast.error(e, "Could not save the template.");
    }
  }

  async function send() {
    const sure = await ask({
      title: `Send this to ${lead.email}?`,
      body: whatsapp && lead.reply_whatsapp
        ? `It goes out with a button that opens WhatsApp on ${lead.reply_whatsapp}.`
        : "It goes out without a WhatsApp button.",
      confirmLabel: "Send email",
    });
    if (!sure) return;

    setSending(true);
    try {
      const updated = await admin.sendLeadReply(lead.id, {
        subject: subject.trim(),
        body: body.trim(),
        whatsapp: whatsapp && Boolean(lead.reply_whatsapp),
      });
      onSent(updated);
      setSubject("");
      setBody("");
      setInstruction("");
      setOpen(false);
      toast.success(`Sent to ${lead.email}.`);
    } catch (e) {
      toast.error(e, "Could not send the email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">Reply by email</h2>
        <p className="text-xs text-[var(--fg-faint)]">
          {replies.length > 0 ? `${replies.length} sent` : "Not answered yet"}
        </p>
      </header>

      {!open ? (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
          >
            {replies.length > 0 ? "Write another reply" : "Write a reply"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
              Start from a template
            </span>
            <select
              value={templateId}
              onChange={(e) => pickTemplate(e.target.value)}
              className="border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm"
            >
              <option value="">Choose one…</option>
              <optgroup label="Ready-made">
                {BUILTIN_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              {saved.length > 0 && (
                <optgroup label="Yours">
                  {saved.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {/* The draft controls: what to write and in which voice. */}
          <div className="flex flex-col gap-3 border border-[var(--hairline)] p-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-[var(--fg-dim)]">
                Tone
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ReplyTone)}
                  className="border border-[var(--hairline)] bg-transparent px-2 py-1 text-sm text-[var(--fg)]"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--fg-dim)]">
                Language
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Lang)}
                  className="border border-[var(--hairline)] bg-transparent px-2 py-1 text-sm text-[var(--fg)]"
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={500}
              data-ai="off"
              placeholder="Optional: what to say, e.g. “propose a call Thursday”"
              aria-label="What the draft should say"
              className="w-full border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-faint)]"
            />
            <button
              type="button"
              onClick={draft}
              disabled={drafting}
              className="self-start border border-[var(--hairline)] px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)] hover:border-[var(--link)] disabled:opacity-40"
            >
              {drafting ? "Writing…" : "Draft with AI"}
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={190}
              data-ai="off"
              className="border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              maxLength={8000}
              dir="auto"
              className="resize-y border border-[var(--hairline)] bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none"
            />
          </label>

          <div className="flex flex-col gap-2 border border-[var(--hairline)] p-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
              Change the text with AI
            </p>
            <div className="flex gap-2">
              <input
                value={tweak}
                onChange={(e) => setTweak(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyTweak();
                  }
                }}
                maxLength={500}
                data-ai="off"
                placeholder="e.g. make it shorter, add that we build in Next.js, mention Villa Elk"
                aria-label="What to change"
                className="min-w-0 flex-1 border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-faint)]"
              />
              <button
                type="button"
                onClick={applyTweak}
                disabled={tweaking || tweak.trim() === "" || body.trim() === ""}
                className="shrink-0 border border-[var(--hairline)] px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)] hover:border-[var(--link)] disabled:opacity-40"
              >
                {tweaking ? "Working…" : "Apply"}
              </button>
            </div>
            <button
              type="button"
              onClick={saveAsTemplate}
              disabled={!ready}
              className="self-start text-xs text-[var(--fg-dim)] underline-offset-4 hover:text-[var(--fg)] hover:underline disabled:opacity-40"
            >
              Save this text as a template
            </button>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={whatsapp && Boolean(lead.reply_whatsapp)}
              disabled={!lead.reply_whatsapp}
              onChange={(e) => setWhatsapp(e.target.checked)}
              className="mt-1"
            />
            <span>
              Add a button to continue on WhatsApp
              <span className="block text-xs text-[var(--fg-faint)]">
                {lead.reply_whatsapp
                  ? `Opens a chat with ${lead.reply_whatsapp}, with a first line already written.`
                  : "No WhatsApp number set. Add one in Settings → Site."}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]">
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!ready || sending}
              className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {sending ? "Sending…" : "Send email"}
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <ul className="border-t border-[var(--hairline)]">
          {replies.map((r) => (
            <li key={r.id} className="border-b border-[var(--hairline)] px-5 py-3 last:border-b-0">
              <details>
                <summary className="flex cursor-pointer items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{r.subject}</span>
                  <span className="shrink-0 text-xs text-[var(--fg-faint)]">
                    {when(r.created_at)}
                    {r.with_whatsapp ? " · WhatsApp button" : ""}
                  </span>
                </summary>
                <p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-dim)]">{r.body}</p>
                <p className="mt-2 text-xs text-[var(--fg-faint)]">To {r.sent_to}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
