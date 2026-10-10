/**
 * Ready-made replies to an enquiry. Plain text with {{name}}, {{company}}
 * and {{service}} placeholders, filled when one is picked; the person then
 * reads it and changes whatever the particular enquiry needs, by hand or
 * with the AI.
 *
 * Nothing here promises a price or a date: the quote is written after the
 * call, and these only open the conversation.
 */
export type ReplyTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** Shipped with the dashboard, not editable or deletable. */
  builtin?: boolean;
};

export const BUILTIN_TEMPLATES: ReplyTemplate[] = [
  {
    id: "builtin-fr-first",
    builtin: true,
    name: "Premier contact (FR)",
    subject: "Votre projet de site — JalimX",
    body: `Bonjour {{name}},

Merci pour votre message et pour l'intérêt que vous portez à JalimX.

J'ai bien lu votre demande{{service}}. Pour vous répondre précisément, j'ai besoin de comprendre votre activité, vos clients et ce que votre site actuel ne fait pas. Le plus simple est un appel de 15 minutes, à l'horaire qui vous convient.

Après cet appel, je vous envoie un cadrage écrit avec un prix fixe, sans engagement.

Bien cordialement,
Mohamed
JalimX`,
  },
  {
    id: "builtin-en-first",
    builtin: true,
    name: "First reply (EN)",
    subject: "Your website project — JalimX",
    body: `Hello {{name}},

Thank you for your message and for your interest in JalimX.

I have read your request{{service}}. To answer you properly I need to understand your business, who buys from you, and what your current site fails to do. The simplest way is a 15-minute call at a time that suits you.

After the call I will send a written scope with a fixed price, no obligation.

Best regards,
Mohamed
JalimX`,
  },
  {
    id: "builtin-fr-details",
    builtin: true,
    name: "Demander des précisions (FR)",
    subject: "Quelques questions sur votre projet",
    body: `Bonjour {{name}},

Merci pour votre message. Avant de vous proposer quoi que ce soit, deux ou trois précisions m'aideraient :

- Quelle est votre activité, et qui sont vos clients ?
- Avez-vous déjà un site ? Qu'est-ce qui ne fonctionne pas aujourd'hui ?
- Une échéance particulière, par exemple une saison à venir ?

Vous pouvez répondre directement à ce message.

Bien cordialement,
Mohamed
JalimX`,
  },
  {
    id: "builtin-en-details",
    builtin: true,
    name: "Ask for details (EN)",
    subject: "A few questions about your project",
    body: `Hello {{name}},

Thank you for your message. Before suggesting anything, a few details would help me:

- What does the business do, and who are your customers?
- Do you already have a site? What is not working today?
- Is there a deadline, such as an upcoming season?

You can reply directly to this message.

Best regards,
Mohamed
JalimX`,
  },
  {
    id: "builtin-fr-followup",
    builtin: true,
    name: "Relance (FR)",
    subject: "Où en êtes-vous de votre projet ?",
    body: `Bonjour {{name}},

Je reviens vers vous au sujet de votre demande. Votre projet est-il toujours d'actualité ?

Si oui, un appel de 15 minutes suffit pour avancer. Sinon, aucun souci : dites-le moi simplement et je clôture de mon côté.

Bien cordialement,
Mohamed
JalimX`,
  },
];

/** Fills the placeholders from the lead. A missing value leaves no gap. */
export function fillTemplate(
  text: string,
  lead: { name: string; company: string | null; service_interest: string | null },
): string {
  const first = lead.name.trim().split(/\s+/)[0] ?? lead.name;
  const service = lead.service_interest ? ` (${lead.service_interest})` : "";

  return text
    .replaceAll("{{name}}", first)
    .replaceAll("{{company}}", lead.company ?? "")
    .replaceAll("{{service}}", service);
}
