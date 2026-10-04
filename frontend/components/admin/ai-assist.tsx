"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/components/admin/toast";
import { admin, ApiError, type AiAction, type AiAssistInput } from "@/lib/admin/client";

/**
 * Writing help in every text field of the dashboard, without touching the
 * forms themselves.
 *
 * It listens for focus on the page: when a text field is focused, a small AI
 * button appears above its corner with what can be done to it — write it,
 * continue it, improve, shorten, fix or translate what is there. In a
 * multi-line field it can also suggest how the sentence goes on after a
 * pause in typing; Tab takes the suggestion, Esc or typing drops it.
 *
 * A request asked for by hand belongs to its field, not to the focus: click
 * somewhere else while it is writing and it keeps going, and the suggestion
 * waits under its field until it is used or dismissed. Only the suggestions
 * made from typing are dropped when the field is left — those are cheap and
 * would otherwise pile up.
 *
 * Nothing is written into a field without a click or a Tab. Suggestions are
 * shown first, because a model can be wrong and the dashboard's words go to
 * clients and onto the public site.
 *
 * Fields stay out of it when they are passwords, keys, usernames, e-mails,
 * phone numbers, numbers or codes (monospace), or sit anywhere inside an
 * element marked data-ai="off".
 */

type Target = HTMLInputElement | HTMLTextAreaElement;
type Lang = "en" | "fr" | "ar";

type Job = {
  el: Target;
  action: AiAction;
  target?: Lang;
  /** Started by typing, not by a click: quieter, and dropped when left. */
  auto: boolean;
  loading: boolean;
  /** "append" continues the text; "replace" swaps it. */
  suggestion: { text: string; mode: "append" | "replace" } | null;
};

// Whole words only: "tel" must not catch "hotel".
const SENSITIVE = /\b(pass(word)?|secret|token|api.?key|iban|rib|swift|cvv|user.?name|logins?|e-?mail|phone|tel|whatsapp|slug)\b/i;
const AUTO_KEY = "jx.ai.autocomplete";
const AUTO_DELAY = 1200;
const AUTO_GAP = 4000;

function eligible(el: Element | null): el is Target {
  if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return false;
  if (el instanceof HTMLInputElement && !["text", "search"].includes(el.type)) return false;
  if (el.readOnly || el.disabled) return false;
  if (el.closest('[data-ai="off"]')) return false;
  if (["numeric", "decimal", "tel", "email", "url"].includes(el.inputMode)) return false;
  // Monospace fields hold codes, slugs, model names and addresses.
  if (el.classList.contains("font-mono") || el.classList.contains("tabular-nums")) return false;
  if (SENSITIVE.test(`${el.name} ${el.id} ${el.autocomplete} ${labelOf(el)}`)) return false;
  return true;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** What the field is called, as a person reading the form would say it. */
function labelOf(el: Target): string {
  const label = el.labels?.[0];
  const own = clean(label?.querySelector("span")?.textContent);
  const languageOnly = /^(english|français|francais|arabic|العربية)$/i.test(own);

  if (own && !languageOnly) return own;

  // Side-by-side translations (the case study form): the row's heading sits
  // in an ancestor, before the field.
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const heading = node.querySelector("p.font-medium, h2, h3");
    if (heading && !heading.contains(el)) {
      return clean(`${heading.textContent}${own ? ` (${own})` : ""}`);
    }
  }

  return clean(el.getAttribute("aria-label") || el.placeholder || el.name || own);
}

function hintOf(el: Target): string | undefined {
  const spans = el.labels?.[0]?.querySelectorAll(":scope > span");
  const last = spans && spans.length > 1 ? clean(spans[spans.length - 1].textContent) : "";
  return last || undefined;
}

function langOf(el: Target): Lang | undefined {
  // Only a language the form itself declares — the page's own <html lang>
  // says nothing about what this field holds.
  const code = (el.lang || el.closest<HTMLElement>("main [lang]")?.lang || "").slice(0, 2);
  return code === "en" || code === "fr" || code === "ar" ? code : undefined;
}

/**
 * The name of a group of choices: the first small heading inside the nearest
 * ancestor that holds both the heading and the choice.
 */
function groupOf(choice: HTMLElement): string {
  let node: HTMLElement | null = choice.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const heading = Array.from(node.children).find(
      (c) => (c.tagName === "SPAN" || c.tagName === "LEGEND" || c.tagName === "P") && !c.contains(choice),
    );
    const text = clean(heading?.textContent);
    if (text) return text.slice(0, 120);
  }
  return "";
}

/**
 * What else the form says, for "write" to work from: the other filled text
 * fields, the chosen option of each select, and — of the choices made with
 * checkboxes, radios or toggle buttons — only the ones that are on, grouped
 * under their heading ("Kind of work: Website, SEO").
 */
function contextOf(el: Target): AiAssistInput["context"] {
  const scope = el.closest("form") ?? el.closest("dialog") ?? el.closest("section") ?? el.closest("main");
  if (!scope) return [];

  const out: AiAssistInput["context"] = [];
  const add = (label: string, value: string) => {
    if (value && out.length < 12) out.push({ label: label.slice(0, 200), value: value.slice(0, 300) });
  };

  scope.querySelectorAll<HTMLElement>("input, textarea, select").forEach((other) => {
    if (other === el || other.closest('[data-ai="off"]')) return;

    if (other instanceof HTMLSelectElement) {
      add(clean(other.labels?.[0]?.querySelector("span")?.textContent), clean(other.selectedOptions[0]?.textContent));
    } else if (eligible(other)) {
      add(labelOf(other), clean(other.value));
    }
  });

  // Checked boxes, chosen radios and pressed toggles; the rest is not sent.
  const groups = new Map<string, string[]>();
  scope
    .querySelectorAll<HTMLElement>('input[type="checkbox"]:checked, input[type="radio"]:checked, [aria-pressed="true"]')
    .forEach((choice) => {
      if (choice.closest('[data-ai="off"]') || choice.closest("[data-jx-ai]")) return;
      const name =
        choice instanceof HTMLInputElement
          ? clean(choice.labels?.[0]?.textContent || choice.getAttribute("aria-label"))
          : clean(choice.textContent || choice.getAttribute("aria-label"));
      if (!name) return;
      const group = groupOf(choice);
      groups.set(group, [...(groups.get(group) ?? []), name.slice(0, 80)]);
    });
  groups.forEach((names, group) => add(group || "Selected", names.join(", ")));

  return out;
}

/**
 * Writes into a field React controls. Setting `.value` alone would be
 * overwritten on the next render; going through the native setter and
 * firing `input` makes React's onChange see it as typing.
 */
function writeInto(el: Target, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  el.setSelectionRange(value.length, value.length);
}

function joined(current: string, addition: string): string {
  if (!current || /\s$/.test(current) || /^[\s.,;:!?)]/.test(addition)) return current + addition;
  return `${current} ${addition}`;
}

/**
 * Where the overlay has to live. A field inside a modal <dialog> sits in the
 * browser's top layer, above everything on the page — an overlay mounted on
 * <body> would be drawn underneath it, invisible. So it goes into the dialog.
 */
function hostOf(el: Target): HTMLElement {
  return el.closest("dialog") ?? document.body;
}

const MENU: { action: AiAction; label: string; needsText: boolean; target?: Lang }[] = [
  { action: "write", label: "Write it for me", needsText: false },
  { action: "complete", label: "Continue writing", needsText: true },
  { action: "improve", label: "Improve", needsText: true },
  { action: "shorten", label: "Make shorter", needsText: true },
  { action: "expand", label: "Make longer", needsText: true },
  { action: "fix", label: "Fix spelling & grammar", needsText: true },
  { action: "translate", label: "Translate to English", needsText: true, target: "en" },
  { action: "translate", label: "Traduire en français", needsText: true, target: "fr" },
  { action: "translate", label: "ترجم إلى العربية", needsText: true, target: "ar" },
];

export function AiAssist() {
  const toast = useToast();
  // The field that has focus: where the AI button is.
  const [focus, setFocus] = useState<Target | null>(null);
  const [menu, setMenu] = useState(false);
  // The one request in progress or waiting to be used, and its field.
  const [job, setJob] = useState<Job | null>(null);
  // Bumped whenever the page moves, so positions are read again.
  const [, setTick] = useState(0);
  // Remembered per browser; a private window falls back to on.
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "off";
    } catch {
      return true;
    }
  });

  const focusRef = useRef<Target | null>(null);
  const jobRef = useRef<Job | null>(null);
  const autoRef = useRef(true);
  const inflight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuto = useRef(0);
  const quietUntil = useRef(0);

  // The listeners below outlive renders; they read the latest values here.
  useEffect(() => {
    focusRef.current = focus;
    jobRef.current = job;
    autoRef.current = auto;
  }, [focus, job, auto]);

  const drop = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    if (timer.current) clearTimeout(timer.current);
    setJob(null);
  }, []);

  const ask = useCallback(
    async (el: Target, action: AiAction, opts: { auto?: boolean; target?: Lang } = {}) => {
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      setMenu(false);
      setJob({ el, action, target: opts.target, auto: !!opts.auto, loading: true, suggestion: null });

      const input: AiAssistInput = {
        action,
        text: el.value,
        target_lang: opts.target,
        field: {
          label: labelOf(el) || undefined,
          hint: hintOf(el),
          page: clean(document.querySelector("main h1")?.textContent) || undefined,
          lang: langOf(el),
          max_length: el.maxLength > 0 ? el.maxLength : undefined,
          multiline: el instanceof HTMLTextAreaElement,
        },
        context: contextOf(el),
      };

      // Checked now, not inside the state update: React runs updaters later,
      // after `finally` below has already let go of the controller.
      const mine = () => inflight.current === controller;
      const finish = (suggestion: Job["suggestion"]) => {
        if (mine()) setJob((j) => (j && j.el === el ? { ...j, loading: false, suggestion } : j));
      };

      try {
        const res = await admin.aiAssist(input, controller.signal);
        if (controller.signal.aborted) return;

        const text = action === "complete" ? res.text.replace(/^\s+/, (m) => (m.includes("\n") ? "\n" : " ")) : res.text;
        if (!text.trim()) {
          if (!opts.auto) toast.error("The model returned nothing. Try again.");
          if (mine()) setJob(null);
          return;
        }
        finish({ text, mode: action === "complete" ? "append" : "replace" });
      } catch (e) {
        if (controller.signal.aborted) return;
        if (mine()) setJob(null);
        if (opts.auto) {
          // Typing must never produce error toasts. Back off instead, so a
          // dashboard with no working key does not ask on every pause.
          quietUntil.current = Date.now() + 60_000;
          return;
        }
        toast.error(
          e instanceof ApiError && e.status === 429
            ? "Too many AI requests — wait a moment."
            : e instanceof Error
              ? e.message
              : "The AI request failed.",
        );
      } finally {
        if (inflight.current === controller) inflight.current = null;
      }
    },
    [toast],
  );

  const accept = useCallback(() => {
    const j = jobRef.current;
    if (!j?.suggestion || !j.el.isConnected) return;

    let next = j.suggestion.mode === "append" ? joined(j.el.value, j.suggestion.text.trimEnd()) : j.suggestion.text;
    if (j.el.maxLength > 0) next = next.slice(0, j.el.maxLength);

    writeInto(j.el, next);
    setJob(null);
  }, []);

  // Which field has focus. Leaving a field drops a typing suggestion, never
  // a request asked for by hand.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (el === focusRef.current) return;
      setMenu(false);
      const j = jobRef.current;
      if (j?.auto && j.el !== el) drop();
      setFocus(eligible(el) ? el : null);
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next instanceof Element && next.closest("[data-jx-ai]")) return;
      // Let the focus land first: focusin on another field replaces it.
      setTimeout(() => {
        if (eligible(document.activeElement)) return;
        setFocus(null);
        setMenu(false);
        if (jobRef.current?.auto) drop();
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [drop]);

  // Positions follow the page as it scrolls, resizes or reflows; a field
  // that left the page (a dialog closed) takes its request with it.
  useEffect(() => {
    if (!focus && !job) return;
    const move = () => {
      if (job && !job.el.isConnected) {
        drop();
        return;
      }
      setTick((t) => t + 1);
    };
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", move);
    const observer = new ResizeObserver(move);
    if (focus) observer.observe(focus);
    if (job) observer.observe(job.el);
    const check = setInterval(move, 1000);
    return () => {
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", move);
      observer.disconnect();
      clearInterval(check);
    };
  }, [focus, job, drop]);

  // Typing in the focused field: drop a typing suggestion, maybe ask for the next.
  useEffect(() => {
    if (!focus) return;

    const onInput = (e: Event) => {
      // Our own insert fires `input` too; it is not typing.
      if (!(e as InputEvent).inputType) return;

      const j = jobRef.current;
      if (j?.auto && j.el === focus) drop();
      if (timer.current) clearTimeout(timer.current);
      if (!(focus instanceof HTMLTextAreaElement) || !autoRef.current) return;

      timer.current = setTimeout(() => {
        const value = focus.value;
        const atEnd = focus.selectionStart === value.length;
        const now = Date.now();
        if (
          document.activeElement !== focus ||
          !atEnd ||
          value.trim().length < 20 ||
          /\n\s*$/.test(value) ||
          now < quietUntil.current ||
          now - lastAuto.current < AUTO_GAP ||
          // A request asked for by hand is never replaced by a typing one.
          (jobRef.current && !jobRef.current.auto)
        ) {
          return;
        }
        lastAuto.current = now;
        ask(focus, "complete", { auto: true });
      }, AUTO_DELAY);
    };

    const el: HTMLElement = focus;
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("input", onInput);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [focus, ask, drop]);

  // Tab takes the suggestion and Esc drops it, while its field has focus.
  // Captured before a dialog sees the key, so Esc closes the suggestion,
  // not the whole dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const j = jobRef.current;
      if (!j || document.activeElement !== j.el) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        drop();
      } else if (e.key === "Tab" && j.suggestion && !e.shiftKey) {
        e.preventDefault();
        accept();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [accept, drop]);

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    try {
      localStorage.setItem(AUTO_KEY, next ? "on" : "off");
    } catch {
      /* not remembered, still applied */
    }
  }

  // Keeps focus in the field: every control here acts on mousedown.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  const button = (() => {
    if (!focus) return null;
    const rect = focus.getBoundingClientRect();
    if (rect.width === 0) return null;
    const busyHere = job?.el === focus && job.loading && !job.auto;
    const hasText = focus.value.trim().length > 0;
    const top = Math.max(4, rect.top - 22);

    return createPortal(
      <div data-jx-ai className="pointer-events-none fixed inset-0 z-[60]">
        {/* Above the field's top-right corner, on the label's line, so it
            never sits on top of what is being typed. */}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={keep}
          onClick={() => setMenu((m) => !m)}
          title="Writing help"
          aria-label="Writing help"
          aria-expanded={menu}
          className="pointer-events-auto fixed flex h-5 -translate-x-full items-center gap-1 px-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--link)] hover:text-[var(--fg)]"
          style={{ top, left: rect.right }}
        >
          <Sparkle className={`h-3 w-3 ${busyHere ? "animate-spin" : ""}`} />
          {busyHere ? "Writing…" : "AI"}
        </button>

        {menu && (
          <div
            role="menu"
            onMouseDown={keep}
            className="pointer-events-auto fixed w-60 border border-[var(--hairline)] bg-[var(--panel)] py-1 text-sm shadow-lg"
            style={{ top: top + 22, left: Math.max(8, rect.right - 240) }}
          >
            {MENU.filter((m) => hasText || !m.needsText).map((m) => (
              <button
                key={`${m.action}-${m.target ?? ""}`}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => ask(focus, m.action, { target: m.target })}
                className="block w-full px-3.5 py-1.5 text-left hover:bg-[color-mix(in_oklab,var(--link)_8%,transparent)]"
                dir={m.target === "ar" ? "rtl" : undefined}
              >
                {m.action === "write" && hasText ? "Rewrite from scratch" : m.label}
              </button>
            ))}
            {focus instanceof HTMLTextAreaElement && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={auto}
                tabIndex={-1}
                onClick={toggleAuto}
                className="mt-1 flex w-full items-center justify-between border-t border-[var(--hairline)] px-3.5 pb-1 pt-2 text-left text-xs text-[var(--fg-dim)]"
              >
                Suggest while I type
                <span className="font-mono">{auto ? "on" : "off"}</span>
              </button>
            )}
          </div>
        )}
      </div>,
      hostOf(focus),
    );
  })();

  const panel = (() => {
    if (!job || !job.el.isConnected) return null;
    // A typing suggestion only shows while its field is being typed in.
    if (job.auto && (!job.suggestion || focus !== job.el)) return null;
    const rect = job.el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const width = Math.max(280, Math.min(rect.width, 560));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const s = job.suggestion;

    return createPortal(
      <div
        data-jx-ai
        role="status"
        onMouseDown={keep}
        className="fixed z-[60] border border-[var(--hairline)] bg-[var(--panel)] shadow-lg"
        style={{ top: rect.bottom + 6, left, width }}
      >
        {s ? (
          <p
            dir="auto"
            className={`max-h-56 overflow-auto whitespace-pre-wrap px-3.5 py-2.5 text-sm ${
              job.auto ? "text-[var(--fg-dim)]" : "text-[var(--fg)]"
            }`}
          >
            {s.mode === "append" && <span className="text-[var(--fg-faint)]">…</span>}
            {s.text.trim()}
          </p>
        ) : (
          <p className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-[var(--fg-dim)]">
            <Sparkle className="h-3 w-3 animate-spin text-[var(--link)]" />
            Writing… you can keep working; it will wait here.
          </p>
        )}
        <div className="flex items-center gap-4 border-t border-[var(--hairline)] px-3.5 py-2 text-xs">
          {s && (
            <button type="button" tabIndex={-1} onClick={accept} className="font-medium text-[var(--link)] hover:underline">
              {s.mode === "append" ? "Add" : "Use this"} <span className="font-mono text-[var(--fg-faint)]">Tab</span>
            </button>
          )}
          {s && !job.auto && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => ask(job.el, job.action, { target: job.target })}
              className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Try again
            </button>
          )}
          <button type="button" tabIndex={-1} onClick={drop} className="text-[var(--fg-dim)] hover:text-[var(--fg)]">
            {s ? "Dismiss" : "Cancel"} <span className="font-mono text-[var(--fg-faint)]">Esc</span>
          </button>
        </div>
      </div>,
      hostOf(job.el),
    );
  })();

  return (
    <>
      {button}
      {panel}
    </>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6Zm5 10c.2 1.9 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1-2.8-3-3 2-.2 2.8-1.1 3-3Z" />
    </svg>
  );
}
