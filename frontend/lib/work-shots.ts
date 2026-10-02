import { readFile } from "node:fs/promises";
import path from "node:path";

import { api } from "@/lib/api/client";

/**
 * Which client sites we hold screenshots for.
 *
 * The dashboard is the source of truth: captures uploaded to a case study
 * (or imported with `php artisan projects:import-captures`) come from the API.
 * The manifest `pnpm capture:work` writes is the fallback for a project that
 * has none in the dashboard yet. Either way a missing framing is simply absent,
 * never a guessed filename: a card that renders a missing image is worse than
 * a card with no image.
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

const VIEWPORTS = ["full", "desktop", "mobile"] as const;

let manifestCache: Map<string, WorkShot[]> | null = null;

async function readManifest(): Promise<Map<string, WorkShot[]>> {
  if (manifestCache) return manifestCache;

  const file = path.join(process.cwd(), "public", "work", "manifest.json");

  try {
    const manifest = JSON.parse(await readFile(file, "utf8")) as Manifest;
    const bySlug = new Map<string, WorkShot[]>();

    for (const shot of manifest.shots) {
      const list = bySlug.get(shot.slug) ?? [];
      list.push(shot);
      bySlug.set(shot.slug, list);
    }

    manifestCache = bySlug;
  } catch {
    // No captures yet — the work section falls back to text-only cards.
    manifestCache = new Map();
  }
  return manifestCache;
}

export async function getWorkShots(): Promise<Map<string, WorkShot[]>> {
  const fallback = await readManifest();

  // Not cached here: the API call is already tagged and revalidated when a
  // capture is uploaded, and a module-level copy would outlive that.
  const projects = await api.projects.list().catch(() => []);
  const bySlug = new Map<string, WorkShot[]>();

  for (const project of projects) {
    const shots: WorkShot[] = [];

    for (const viewport of VIEWPORTS) {
      const media = project.captures?.[viewport];
      const own = fallback.get(project.slug)?.find((s) => s.viewport === viewport);

      if (media) {
        shots.push({
          slug: project.slug,
          viewport,
          url: project.project_url ?? own?.url ?? "",
          src: media.url,
          width: media.width ?? undefined,
          height: media.height ?? undefined,
        });
      } else if (own) {
        shots.push(own);
      }
    }
    if (shots.length) bySlug.set(project.slug, shots);
  }

  // Projects the API did not return (unpublished, or the API is down) still
  // get whatever the manifest holds.
  for (const [slug, shots] of fallback) {
    if (!bySlug.has(slug)) bySlug.set(slug, shots);
  }

  return bySlug;
}

export function shotFor(
  shots: Map<string, WorkShot[]>,
  slug: string,
  viewport: WorkShot["viewport"] = "desktop",
): WorkShot | undefined {
  return shots.get(slug)?.find((s) => s.viewport === viewport);
}
