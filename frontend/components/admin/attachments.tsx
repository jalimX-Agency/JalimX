"use client";

import { useRef, useState } from "react";

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
 * "scan_002.pdf" answers no question anyone ever asks. Files live in a
 * bucket with no public address and come back out only through the
 * dashboard, so a contract is never one guessed URL away.
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
  const [message, setMessage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const files = engagement.attachments;

  const replaceFiles = (next: Attachment[]) => onChanged({ ...engagement, attachments: next });

  async function upload(file: File) {
    setMessage(null);
    setProgress(0);
    try {
      const added = await admin.uploadAttachment(engagement.id, kind, file, setProgress);
      replaceFiles([added, ...files]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
      // Cleared so choosing the same file twice still fires a change.
      if (picker.current) picker.current.value = "";
    }
  }

  async function remove(file: Attachment) {
    if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return;
    try {
      await admin.removeAttachment(file.id);
      replaceFiles(files.filter((f) => f.id !== file.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
    }
  }

  return (
    <div className="mt-6 border-t border-[var(--hairline)] pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
          Files
        </span>
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
            className="border border-[var(--hairline)] px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-40"
          >
            {progress === null ? "+ Upload" : `${Math.round(progress * 100)}%`}
          </button>
        </div>
      </div>

      {message && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-signal)]">
          {message}
        </p>
      )}

      {files.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--fg-faint)]">
          The signed contract, the brief, anything that arrived by email and
          would otherwise only live in a mailbox.
        </p>
      ) : (
        <ul className="mt-3 border border-[var(--hairline)] bg-[var(--panel)]">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="w-16 shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                  {KIND_LABEL[file.kind]}
                </span>
                <a
                  href={admin.attachmentDownload(file.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {file.name}
                </a>
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                <span className="tabular-nums text-xs text-[var(--fg-faint)]">
                  {size(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(file)}
                  className="text-xs text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
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
