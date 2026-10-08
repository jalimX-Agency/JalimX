import { formatPhone, waLink } from "@/lib/phone";

/**
 * The studio's WhatsApp numbers, one link each, opening a chat.
 *
 * Shared by the footer and the contact page, which style their lines
 * differently; the numbers and the link are the same in both. Renders nothing
 * for an empty list, so a page never shows a "WhatsApp" label with nothing
 * after it.
 */
export function WhatsAppLinks({
  numbers,
  className,
}: {
  numbers: string[];
  className?: string;
}) {
  return numbers.map((digits) => (
    <a
      key={digits}
      href={waLink(digits)}
      target="_blank"
      rel="noopener"
      className={className}
    >
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] opacity-60">
        WhatsApp
      </span>{" "}
      <span className="tabular-nums">{formatPhone(digits)}</span>
    </a>
  ));
}
