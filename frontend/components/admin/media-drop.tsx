"use client";

/* eslint-disable @next/next/no-img-element -- previews come straight from the
   R2 CDN or from a local blob; neither benefits from next/image here. */

import { useRef, useState } from "react";

import { admin, ApiError, type Media } from "@/lib/admin/client";

/**
 * One media collection: what is in it, and a place to add more.
 *
 * Files are checked here before they leave the browser — type and size — so a
 * wrong file fails in a second instead of after a slow upload. The server
 * checks all of it again by content; this is courtesy, not security.
 */

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

type Upload = { id: string; name: string; preview: string; progress: number; error?: string };

type Props = {
  slug: string;
  collection: "cover" | "gallery" | "dashboard";
  title: string;
  hint: string;
  warning?: string;
  items: Media[];
  single?: boolean;
  onChange: () => void;
};

export function MediaDrop({ slug, collection, title, hint, warning, items, single, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const patch = (id: string, change: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...change } : u)));

  async function take(files: FileList | null) {
    if (!files?.length) return;

    // A cover holds one image; dropping five on it would upload five and keep
    // only the last, so take the first and ignore the rest.
    const chosen = single ? [files[0]] : Array.from(files);

    await Promise.all(
      chosen.map(async (file) => {
        const id = crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        setUploads((list) => [...list, { id, name: file.name, preview, progress: 0 }]);

        if (!ACCEPT.includes(file.type)) {
          patch(id, { error: "JPEG, PNG, WebP or AVIF only." });
          return;
        }
        if (file.size > MAX_BYTES) {
          patch(id, { error: `${(file.size / 1048576).toFixed(1)} MB — the limit is 10 MB.` });
          return;
        }

        try {
          await admin.upload(slug, collection, file, (p) => patch(id, { progress: p }));
          setUploads((list) => list.filter((u) => u.id !== id));
          URL.revokeObjectURL(preview);
          onChange();
        } catch (e) {
          patch(id, {
            error: e instanceof ApiError ? (e.errors.file?.[0] ?? e.message) : "Upload failed.",
          });
        }
      }),
    );

    if (input.current) input.current.value = "";
  }

  async function remove(media: Media) {
    if (!window.confirm(`Remove this image? It will disappear from the site.`)) return;
    setRemoving(media.id);
    try {
      await admin.removeMedia(media.id);
      onChange();
    } finally {
      setRemoving(null);
    }
  }

  const dismiss = (id: string) =>
    setUploads((list) => {
      const gone = list.find((u) => u.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((u) => u.id !== id);
    });

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">{title}</h2>
        <p className="text-xs text-[var(--fg-faint)]">{hint}</p>
      </header>

      {warning && (
        <p className="border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--color-signal)_8%,var(--panel))] px-5 py-2.5 text-xs text-[var(--fg-dim)]">
          <span className="font-mono uppercase tracking-[0.1em] text-[var(--color-signal-dim)]">Public · </span>
          {warning}
        </p>
      )}

      <div className="grid gap-4 p-5 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
        {items.map((m) => (
          <figure key={m.id} className="group relative overflow-hidden border border-[var(--hairline)] bg-[var(--ground)]">
            <a href={m.url} target="_blank" rel="noreferrer" className="block aspect-[4/3]">
              <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
            </a>
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="font-mono text-[0.6rem] tabular-nums text-[var(--fg-faint)]">
                {m.width && m.height ? `${m.width} × ${m.height}` : "—"}
              </span>
              <button
                type="button"
                onClick={() => remove(m)}
                disabled={removing === m.id}
                className="text-[0.7rem] text-[var(--fg-dim)] hover:text-[var(--color-signal)] disabled:opacity-50"
              >
                {removing === m.id ? "Removing…" : "Remove"}
              </button>
            </figcaption>
          </figure>
        ))}

        {uploads.map((u) => (
          <figure key={u.id} className="relative overflow-hidden border border-[var(--hairline)] bg-[var(--ground)]">
            <div className="relative aspect-[4/3]">
              <img src={u.preview} alt="" className={`h-full w-full object-cover ${u.error ? "opacity-30" : "opacity-60"}`} />
              {!u.error && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-[var(--hairline)]">
                  <span
                    className="block h-full bg-[var(--link)] transition-[width] duration-150"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </span>
              )}
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
              {u.error ? (
                <>
                  <span role="alert" className="text-[0.7rem] leading-snug text-[var(--color-signal)]">{u.error}</span>
                  <button type="button" onClick={() => dismiss(u.id)} className="text-[0.7rem] text-[var(--fg-dim)]">
                    Dismiss
                  </button>
                </>
              ) : (
                <span className="font-mono text-[0.6rem] tabular-nums text-[var(--fg-faint)]">
                  {u.progress < 1 ? `Uploading ${Math.round(u.progress * 100)}%` : "Processing…"}
                </span>
              )}
            </figcaption>
          </figure>
        ))}

        {/* A single-image slot hides its drop target while its one upload runs. */}
        {!(single && uploads.length > 0) && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files);
            }}
            className={`flex aspect-[4/3] flex-col items-center justify-center gap-1.5 border border-dashed px-3 text-center transition-colors ${
              dragging
                ? "border-[var(--link)] bg-[color-mix(in_oklab,var(--link)_7%,transparent)]"
                : "border-[var(--hairline)] hover:border-[var(--fg-faint)]"
            }`}
          >
            <span className="text-sm text-[var(--fg)]">
              {single && items.length ? "Replace" : "Add"} {single ? "image" : "images"}
            </span>
            <span className="text-[0.7rem] text-[var(--fg-faint)]">Drop here or click · max 10 MB</span>
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        multiple={!single}
        className="sr-only"
        onChange={(e) => take(e.target.files)}
      />
    </section>
  );
}
