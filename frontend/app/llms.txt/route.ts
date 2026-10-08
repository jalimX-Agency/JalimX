import { api, t as pick } from "@/lib/api/client";
import { absoluteUrl, SITE_URL } from "@/lib/seo";
import { formatPhone } from "@/lib/phone";
import { numbers, text } from "@/lib/settings";

/**
 * A plain-text summary of the site for AI answer engines (the llms.txt
 * convention): what this is, which pages matter, and the work, in a form a
 * model can read in one go without rendering anything.
 *
 * Built from the same API as the pages, so a case study published from the
 * dashboard shows up here without anyone editing a file, and an unpublished
 * one leaves. Only facts the site already states: services and case studies
 * are the dashboard's own words, and the contact details are the public ones.
 */

export const revalidate = 3600;

export async function GET() {
  const [projects, services, settings] = await Promise.all([
    api.projects.list().catch(() => []),
    api.services.list().catch(() => []),
    api.settings.all().catch(() => ({}) as Record<string, unknown>),
  ]);

  const email = text(settings, "contact_email");
  const phone = text(settings, "contact_phone");
  const whatsapp = numbers(settings, "contact_whatsapp");
  const location = text(settings, "contact_location") || "Marrakech, Morocco";

  const lines: string[] = [
    "# JalimX",
    "",
    `> Web development studio in ${location}. We build custom websites, booking systems and admin dashboards for tour operators, desert camps and private villas. Fixed scope and fixed price; the client owns the code and the accounts.`,
    "",
    "The site is in English (the site root) and French (under /fr). Every page below has a French version at the same path after /fr.",
    "",
    "## Pages",
    "",
    `- [Home](${absoluteUrl("en", "/")}): what the studio does and who it works for`,
    `- [Work](${absoluteUrl("en", "/work")}): case studies of the websites we built`,
    `- [How we work](${absoluteUrl("en", "/approach")}): the whole process, step by step`,
    `- [About](${absoluteUrl("en", "/about")}): what we will not do to a site, and what we always do`,
    `- [Contact](${absoluteUrl("en", "/contact")}): tell us what the site has to do`,
  ];

  if (services.length > 0) {
    lines.push("", "## Services", "");
    for (const service of services) {
      lines.push(`- ${pick(service.title, "en")}: ${pick(service.tagline, "en")}`);
    }
  }

  if (projects.length > 0) {
    lines.push("", "## Case studies", "");
    for (const project of projects) {
      lines.push(
        `- [${project.client_name} — ${pick(project.title, "en")}](${absoluteUrl("en", `/work/${project.slug}`)}): ${pick(project.summary, "en")}`
      );
    }
  }

  lines.push("", "## Contact", "");
  lines.push(`- Website: ${SITE_URL}`);
  if (email) lines.push(`- Email: ${email}`);
  if (phone) lines.push(`- Phone: ${phone}`);
  for (const n of whatsapp) lines.push(`- WhatsApp: ${formatPhone(n)} (https://wa.me/${n})`);
  lines.push(`- Location: ${location}`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
