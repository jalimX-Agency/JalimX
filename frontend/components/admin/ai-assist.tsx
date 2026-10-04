"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/admin/toast";
import { admin, ApiError, type AiAction, type AiAssistInput } from "@/lib/admin/client";

/**
 * Writing help in every text field of the dashboard, without touching the
 * forms themselves.
 *
 * It listens for focus on the page: when a text field is focused, a small ✦
 * button appears in its corner with what can be done to it — write it,
 * continue it, improve, shorten, fix or translate what is there. In a
 * multi-line field it can also suggest how the sentence goes on after a
 * pause in typing; Tab takes the suggestion, Esc or typing drops it.
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

type Suggestion = {
  text: string;
  /** "append" continues the text; "replace" swaps it. */
  mode: "append" | "replace";
  /** Came from typing, not from a click: quieter, and any keystroke drops it. */
  auto: boolean;
  action: AiAction;
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

function langOf(el: Target): "en" | "fr" | "ar" | undefined {
  // Only a language the form itself declares — the page's own <html lang>
  // says nothing about what this field holds.
  const code = (el.lang || el.closest<HTMLElement>("main [lang]")?.lang || "").slice(0, 2);
  return code === "en" || code === "fr" || code === "ar" ? code : undefined;
}

/** The other filled fields of the same form, for "write" to work from. */
function contextOf(el: Target): AiAssistInput["context"] {
  const scope = el.closest("form") ?? el.closest("section") ?? el.closest("main");
  if (!scope) return [];

  const out: AiAssistInput["context"] = [];
  scope.querySelectorAll<HTMLElement>("input, textarea, select").forEach((other) => {
    if (out.length >= 10 || other === el) return;

    let value = "";
    if (other instanceof HTMLSelectElement) {
      value = clean(other.selectedOptions[0]?.textContent);
    } else if (eligible(other)) {
      value = clean(other.value);
    }
    if (!value) return;

    const label = other instanceof HTMLSelectElement ? clean(other.labels?.[0]?.querySelector("span")?.textContent) : labelOf(other as Target);
    out.push({ label: label.slice(0, 200), value: value.slice(0, 300) });
  });

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

const MENU: { action: AiAction; label: string; needsText: boolean; target?: "en" | "fr" | "ar" }[] = [
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
  const [target, setTarget] = useState<Target | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  // Remembered per browser; a private window falls back to on.
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [lastAsk, setLastAsk] = useState<{ action: AiAction; target?: "en" | "fr" | "ar" } | null>(null);

  const targetRef = useRef<Target | null>(null);
  const suggestionRef = useRef<Suggestion | null>(null);
  const autoRef = useRef(true);
  const inflight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuto = useRef(0);
  const quietUntil = useRef(0);

  // The listeners below outlive renders; they read the latest values here.
  useEffect(() => {
    targetRef.current = target;
    suggestionRef.current = suggestion;
    autoRef.current = auto;
  }, [target, suggestion, auto]);

  const reset = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    if (timer.current) clearTimeout(timer.current);
    setLoading(null);
    setSuggestion(null);
    setMenu(false);
  }, []);

  const ask = useCallback(
    async (action: AiAction, opts: { auto?: boolean; target?: "en" | "fr" | "ar" } = {}) => {
      const el = targetRef.current;
      if (!el) return;

      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      setMenu(false);
      setSuggestion(null);
      if (!opts.auto) {
        setLoading(action);
        setLastAsk({ action, target: opts.target });
      }

      const maxLength = el.maxLength > 0 ? el.maxLength : undefined;
      const input: AiAssistInput = {
        action,
        text: el.value,
        target_lang: opts.target,
        field: {
          label: labelOf(el) || undefined,
          hint: hintOf(el),
          page: clean(document.querySelector("main h1")?.textContent) || undefined,
          lang: langOf(el),
          max_length: maxLength,
          multiline: el instanceof HTMLTextAreaElement,
        },
        context: contextOf(el),
      };

      try {
        const res = await admin.aiAssist(input, controller.signal);
        if (controller.signal.aborted || targetRef.current !== el) return;

        const text = action === "complete" ? res.text.replace(/^\s+/, (m) => (m.includes("\n") ? "\n" : " ")) : res.text;
        if (!text.trim()) {
          if (!opts.auto) toast.error("The model returned nothing. Try again.");
          return;
        }
        setSuggestion({ text, mode: action === "complete" ? "append" : "replace", auto: !!opts.auto, action });
      } catch (e) {
        if (controller.signal.aborted) return;
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
        if (inflight.current === controller) {
          inflight.current = null;
          setLoading(null);
        }
      }
    },
    [toast],
  );

  const accept = useCallback(() => {
    const el = targetRef.current;
    const s = suggestionRef.current;
    if (!el || !s) return;

    let next = s.mode === "append" ? joined(el.value, s.text.trimEnd()) : s.text;
    if (el.maxLength > 0) next = next.slice(0, el.maxLength);

    writeInto(el, next);
    setSuggestion(null);
  }, []);

  // Which field is being worked on.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (el === targetRef.current) return;
      reset();
      setTarget(eligible(el) ? el : null);
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && document.getElementById("jx-ai-assist")?.contains(next)) return;
      // Let the focus land first: focusin on another field replaces the target.
      setTimeout(() => {
        if (!eligible(document.activeElement)) {
          reset();
          setTarget(null);
        }
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [reset]);

  // Where it is on screen, kept up to date while the page moves.
  useEffect(() => {
    if (!target) return;
    const place = () => setRect(target.getBoundingClientRect());
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(target);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [target]);

  // Typing: drop a suggestion made from typing, and maybe ask for the next one.
  useEffect(() => {
    if (!target) return;

    const onInput = (e: Event) => {
      // Our own insert fires `input` too; it is not typing.
      if (!(e as InputEvent).inputType) return;

      if (suggestionRef.current?.auto) setSuggestion(null);
      if (timer.current) clearTimeout(timer.current);
      if (!(target instanceof HTMLTextAreaElement) || !autoRef.current) return;

      timer.current = setTimeout(() => {
        const value = target.value;
        const atEnd = target.selectionStart === value.length;
        const now = Date.now();
        if (
          document.activeElement !== target ||
          !atEnd ||
          value.trim().length < 20 ||
          /\n\s*$/.test(value) ||
          now < quietUntil.current ||
          now - lastAuto.current < AUTO_GAP ||
          suggestionRef.current
        ) {
          return;
        }
        lastAuto.current = now;
        ask("complete", { auto: true });
      }, AUTO_DELAY);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = suggestionRef.current;
      if (e.key === "Escape" && (s || inflight.current)) {
        e.preventDefault();
        reset();
        return;
      }
      if (e.key === "Tab" && s && !e.shiftKey) {
        e.preventDefault();
        accept();
      }
    };

    const el: HTMLElement = target;
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [target, ask, accept, reset]);

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    try {
      localStorage.setItem(AUTO_KEY, next ? "on" : "off");
    } catch {
      /* not remembered, still applied */
    }
  }

  if (!target || !rect || rect.width === 0) return null;

  const hasText = target.value.trim().length > 0;
  const multiline = target instanceof HTMLTextAreaElement;
  const panelWidth = Math.max(280, Math.min(rect.width, 560));
  const panelLeft = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
  const below = rect.bottom + 6;
  // Keeps focus in the field: every control here acts on mousedown.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div id="jx-ai-assist" className="pointer-events-none fixed inset-0 z-50">
      {/* Above the field's top-right corner, on the label's line, so it never
          sits on top of what is being typed. */}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={keep}
        onClick={() => setMenu((m) => !m)}
        title="Writing help"
        aria-label="Writing help"
        aria-expanded={menu}
        className="pointer-events-auto fixed flex h-5 -translate-x-full items-center gap-1 px-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--link)] hover:text-[var(--fg)]"
        style={{ top: Math.max(4, rect.top - 22), left: rect.right }}
      >
        <Sparkle className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Writing…" : "AI"}
      </button>

      {menu && (
        <div
          role="menu"
          onMouseDown={keep}
          className="pointer-events-auto fixed w-60 border border-[var(--hairline)] bg-[var(--panel)] py-1 text-sm shadow-lg"
          style={{ top: Math.max(4, rect.top - 22) + 22, left: Math.max(8, rect.right - 240) }}
        >
          {MENU.filter((m) => hasText || !m.needsText).map((m) => (
            <button
              key={`${m.action}-${m.target ?? ""}`}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => ask(m.action, { target: m.target })}
              className="block w-full px-3.5 py-1.5 text-left hover:bg-[color-mix(in_oklab,var(--link)_8%,transparent)]"
              dir={m.target === "ar" ? "rtl" : undefined}
            >
              {m.action === "write" && hasText ? "Rewrite from scratch" : m.label}
            </button>
          ))}
          {multiline && (
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

      {suggestion && (
        <div
          role="status"
          onMouseDown={keep}
          className="pointer-events-auto fixed border border-[var(--hairline)] bg-[var(--panel)] shadow-lg"
          style={{ top: below, left: panelLeft, width: panelWidth }}
        >
          <p
            dir="auto"
            className={`max-h-56 overflow-auto whitespace-pre-wrap px-3.5 py-2.5 text-sm ${
              suggestion.auto ? "text-[var(--fg-dim)]" : "text-[var(--fg)]"
            }`}
          >
            {suggestion.mode === "append" && <span className="text-[var(--fg-faint)]">…</span>}
            {suggestion.text.trim()}
          </p>
          <div className="flex items-center gap-4 border-t border-[var(--hairline)] px-3.5 py-2 text-xs">
            <button type="button" tabIndex={-1} onClick={accept} className="font-medium text-[var(--link)] hover:underline">
              {suggestion.mode === "append" ? "Add" : "Use this"} <span className="font-mono text-[var(--fg-faint)]">Tab</span>
            </button>
            {!suggestion.auto && lastAsk && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => ask(lastAsk.action, { target: lastAsk.target })}
                className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                Try again
              </button>
            )}
            <button type="button" tabIndex={-1} onClick={() => setSuggestion(null)} className="text-[var(--fg-dim)] hover:text-[var(--fg)]">
              Dismiss <span className="font-mono text-[var(--fg-faint)]">Esc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6Zm5 10c.2 1.9 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1-2.8-3-3 2-.2 2.8-1.1 3-3Z" />
    </svg>
  );
}
