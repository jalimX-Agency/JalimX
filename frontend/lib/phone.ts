/**
 * Phone numbers as the public site shows them.
 *
 * The dashboard stores a WhatsApp number as digits with the country code and
 * nothing else — 212620569446 — because that is the one form wa.me and every
 * dialler accept. Everything people see is made from it here.
 */

/** "+212 620 569 446" for a Moroccan number; "+" and the digits otherwise. */
export function formatPhone(digits: string): string {
  const m = /^212(\d{3})(\d{3})(\d{3})$/.exec(digits);

  return m ? `+212 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}

/** A link that opens a WhatsApp chat with the number. */
export function waLink(digits: string): string {
  return `https://wa.me/${digits}`;
}
