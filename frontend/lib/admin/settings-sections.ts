/**
 * The settings pages, and the permission each needs.
 *
 * Shared by the settings sub-navigation and the main menu, which links
 * "Settings" to the first page the person may actually open.
 */
export type SettingsSection = {
  href: string;
  label: string;
  hint: string;
  permission: string;
};

export const SETTINGS_SECTIONS: { group: string; items: SettingsSection[] }[] = [
  {
    group: "The agency",
    items: [
      { href: "/admin/settings/team", label: "Team", hint: "Who can sign in, and what they can do", permission: "team.manage" },
      { href: "/admin/settings/invoicing", label: "Invoicing", hint: "What goes on an invoice", permission: "settings.manage" },
      { href: "/admin/settings/work-types", label: "Work types", hint: "What kinds of work you do", permission: "settings.manage" },
      { href: "/admin/settings/task-templates", label: "Task templates", hint: "The steps a job always takes", permission: "settings.manage" },
      { href: "/admin/settings/whatsapp", label: "WhatsApp", hint: "Where reminders go, and what they say", permission: "settings.manage" },
      { href: "/admin/settings/ai", label: "AI providers", hint: "The keys the writing help runs on", permission: "ai.manage" },
    ],
  },
  {
    group: "The site",
    items: [
      { href: "/admin/settings/site", label: "Homepage & contact", hint: "The words that open jalimx.com", permission: "site.manage" },
      { href: "/admin/settings/services", label: "Services", hint: "What the site says you do", permission: "site.manage" },
      { href: "/admin/settings/case-studies", label: "Case studies", hint: "The work shown publicly", permission: "site.manage" },
      { href: "/admin/settings/testimonials", label: "Testimonials", hint: "What clients say about you", permission: "site.manage" },
    ],
  },
];

export function allowedSettings(permissions: string[] | undefined) {
  const has = new Set(permissions ?? []);
  return SETTINGS_SECTIONS.map((group) => ({
    ...group,
    items: group.items.filter((item) => has.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}
