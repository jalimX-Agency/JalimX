import type { Translated } from "@/lib/api/client";

/**
 * Readers for the `settings` key/value store.
 *
 * The store is deliberately loose — it holds the copy that has no table of its
 * own — so every read goes through here rather than reaching into the object
 * directly. A missing or malformed key falls back instead of rendering an
 * empty heading, which is the failure mode that actually reaches production.
 */

/** A translated field, or the shipped fallback if the key is absent. */
export function pick(
  settings: Record<string, unknown>,
  key: string,
  fallback: Translated
): Translated {
  const value = settings[key];

  if (
    value &&
    typeof value === "object" &&
    typeof (value as Translated).en === "string"
  ) {
    return value as Translated;
  }

  return fallback;
}

/**
 * A plain string. Contact details are stored as `{ value: "..." }` so they can
 * be edited as one field in the dashboard; an empty string means "render
 * nothing", not "render a gap".
 */
export function text(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];

  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value: unknown }).value;
    return typeof inner === "string" ? inner : "";
  }

  return typeof value === "string" ? value : "";
}
