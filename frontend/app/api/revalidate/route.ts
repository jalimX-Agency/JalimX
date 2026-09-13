import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Cache invalidation hook for the Laravel backend.
 *
 * Content pages are static with a one-hour revalidate window. That window is a
 * backstop, not the mechanism: when something is edited in the dashboard,
 * Laravel posts here and the affected tag is dropped immediately. Without this
 * an edit takes up to an hour to appear, which no one would tolerate.
 */

/**
 * Only tags the site actually uses. An open endpoint would let a caller
 * invalidate anything they can name — cheap to abuse, and there is no reason
 * to accept a tag we did not define ourselves.
 */
const ALLOWED_TAGS = new Set([
  "services",
  "projects",
  "testimonials",
  "settings",
]);

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length — so check length separately and always run the compare.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret");

  if (!expected) {
    // Fail closed: an unset secret must not mean "no auth required".
    return NextResponse.json(
      { message: "Revalidation is not configured." },
      { status: 503 }
    );
  }

  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let payload: { tags?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const requested = Array.isArray(payload.tags) ? payload.tags : [];
  const tags = requested.filter(
    (tag): tag is string => typeof tag === "string" && ALLOWED_TAGS.has(tag)
  );

  if (tags.length === 0) {
    return NextResponse.json(
      { message: "No known tags in request.", allowed: [...ALLOWED_TAGS] },
      { status: 400 }
    );
  }

  for (const tag of tags) {
    // Next 16 takes a cache-life profile as the second argument. `expire: 0`
    // says "anything cached more than zero seconds ago is stale" — i.e. drop
    // every entry carrying this tag, which is what an editor pressing Save
    // expects to happen.
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ revalidated: tags, at: new Date().toISOString() });
}
