import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Which client sites we hold screenshots for.
 *
 * Read from the manifest `pnpm capture:work` writes rather than guessing at
 * filenames: a project can be published without a live site to photograph, and
 * a card that renders a missing image is worse than a card with no image.
 */

export type WorkShot = {
  slug: string;
  /**
   * `full` is the whole page in one tall image — what the work index scrolls
   * inside its frame. `desktop` and `mobile` are single folds, for anywhere a
   * fixed crop is wanted instead.
   */
  viewport: "desktop" | "mobile" | "full";
  url: string;
  src: string;
  /** Natural pixel size, recorded at capture time. */
  width?: number;
  height?: number;
};

type Manifest = { captured_at: string; shots: WorkShot[] };

let cached: Map<string, WorkShot[]> | null = null;

export async function getWorkShots(): Promise<Map<string, WorkShot[]>> {
  if (cached) return cached;

  const file = path.join(process.cwd(), "public", "work", "manifest.json");

  try {
    const manifest = JSON.parse(await readFile(file, "utf8")) as Manifest;
    const bySlug = new Map<string, WorkShot[]>();

    for (const shot of manifest.shots) {
      const list = bySlug.get(shot.slug) ?? [];
      list.push(shot);
      bySlug.set(shot.slug, list);
    }

    cached = bySlug;
    return bySlug;
  } catch {
    // No captures yet — the work section falls back to text-only cards.
    cached = new Map();
    return cached;
  }
}

export function shotFor(
  shots: Map<string, WorkShot[]>,
  slug: string,
  viewport: WorkShot["viewport"] = "desktop",
): WorkShot | undefined {
  return shots.get(slug)?.find((s) => s.viewport === viewport);
}
