/**
 * What a page does when the API does not answer.
 *
 * The content pages are static and regenerated in the background every hour.
 * A regeneration that hit a failing API used to swallow the error, render an
 * empty list and store that page for the next hour: the case studies, the
 * services and the WhatsApp numbers all disappeared from the site until the
 * next edit in the dashboard flushed the cache.
 *
 * Rethrowing instead makes Next keep the last good page and try again at the
 * next request. Only the build itself falls back to empty — a deploy must not
 * depend on the API being up at that moment.
 */
export function degrade<T>(error: unknown, fallback: T): T {
  if (process.env.NEXT_PHASE === "phase-production-build") return fallback;
  throw error;
}
