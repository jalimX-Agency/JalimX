import { formatPhone, waLink } from "@/lib/phone";

/**
 * The studio's WhatsApp numbers, one link each, opening a chat.
 *
 * Shared by the footer and the contact page, which style their lines
 * differently; the numbers and the link are the same in both. Only the number
 * is shown: the word "WhatsApp" is left to screen readers, who would otherwise
 * hear a bare phone number that opens a chat instead of a call.
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
      aria-label={`WhatsApp ${formatPhone(digits)}`}
      className={`tabular-nums ${className ?? ""}`}
    >
      {formatPhone(digits)}
    </a>
  ));
}
