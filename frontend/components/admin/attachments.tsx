"use client";

import { useRef, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  ATTACHMENT_KINDS,
  type Attachment,
  type AttachmentKind,
  type Engagement,
} from "@/lib/admin/client";

/**
 * The paperwork kept against a piece of work.
 *
 * Filed by what it is rather than by filename, because a folder of
 * "scan_002.pdf" answers no question anyone ever asks. A PDF or an image
 * opens in a tab; everything else is handed over as a download, because
 * previewing a Word file means asking the browser to guess.
 *
 * The files are encrypted in the bucket, so the name shown here is the
 * only readable thing about them outside this page.
 */

const KIND_LABEL: Record<AttachmentKind, string> = {
  contract: "Contract",
  quote: "Quote",
  brief: "Brief",
  image: "Image",
  invoice: "Invoice",
  other: "Other",
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({
  engagement,
  onChanged,
}: {
  engagement: Engagement;
  onChanged: (next: Engagement) => void;
}) {
  const [kind, setKind] = useState<AttachmentKind>("contract");
  const [progress, setProgress] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const ask = useConfirm();
  const toast = useToast();

  const files = engagement.attachments;

  const replaceFiles = (next: Attachment[]) => onChanged({ ...engagement, attachments: next });

  async function upload(file: File) {
    setProgress(0);
    try {
      const added = await admin.uploadAttachment(engagement.id, kind, file, setProgress);
      replaceFiles([added, ...files]);
      toast.success(`${added.name} uploaded.`);
    } catch (e) {
      toast.error(e, "The upload failed.");
    } finally {
      setProgress(null);
      // Cleared so choosing the same file twice still fires a change.
      if (picker.current) picker.current.value = "";
    }
  }

  async function remove(file: Attachment) {
    if (
      !(await ask({
        title: `Delete ${file.name}?`,
        body: "The file is removed from storage, not just from this list.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await admin.removeAttachment(file.id);
      replaceFiles(files.filter((f) => f.id !== file.id));
      toast.success(`${file.name} deleted.`);
    } catch (e) {
      toast.error(e, "Could not delete it.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-[52ch] text-sm text-[var(--fg-dim)]">
          The signed contract, the brief, anything that arrived by email and
          would otherwise only live in a mailbox.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor={`kind-${engagement.id}`}>
            What kind of file
          </label>
          <select
            id={`kind-${engagement.id}`}
            className="admin-input w-auto py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as AttachmentKind)}
          >
            {ATTACHMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            ref={picker}
            type="file"
            className="sr-only"
            aria-label="Choose a file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.avif,.heic"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={progress !== null}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-40"
          >
            {progress === null ? "+ Upload" : `${Math.round(progress * 100)}%`}
          </button>
        </div>
      </div>


      {files.length === 0 ? (
        <p className="mt-6 border border-dashed border-[var(--hairline)] px-5 py-10 text-center text-sm text-[var(--fg-faint)]">
          No files yet.
        </p>
      ) : (
        <ul className="mt-5 border border-[var(--hairline)] bg-[var(--panel)]">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3 text-sm last:border-b-0"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="w-16 shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                  {KIND_LABEL[file.kind]}
                </span>
                {/* The name opens it where opening it makes sense, and is
                    a plain download where it does not. */}
                <a
                  href={
                    file.viewable
                      ? admin.attachmentPreview(file.id)
                      : admin.attachmentDownload(file.id)
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {file.name}
                </a>
              </span>
              <span className="flex shrink-0 items-baseline gap-4 text-xs">
                <span className="tabular-nums text-[var(--fg-faint)]">{size(file.size)}</span>
                {file.viewable && (
                  <a
                    href={admin.attachmentPreview(file.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  >
                    Open ↗
                  </a>
                )}
                <a
                  href={admin.attachmentDownload(file.id)}
                  className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => remove(file)}
                  className="text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
