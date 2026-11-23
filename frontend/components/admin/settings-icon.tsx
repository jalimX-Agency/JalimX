/**
 * Line icons for the settings sections: 24-unit paths drawn at 16px with the
 * text color, so they follow the theme and the active state for free.
 */
const PATHS: Record<string, string[]> = {
  team: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 .01", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  invoicing: ["M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2l-3 2-3-2-3 2-3-2-3 2z", "M8 8h8", "M8 12h8", "M8 16h5"],
  "work-types": ["M10 2h4a2 2 0 0 1 2 2v2H8V4a2 2 0 0 1 2-2z", "M3 6h18v14H3z", "M3 12h18"],
  "task-templates": ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6l1 1 2-2", "M4 12l1 1 2-2", "M4 18l1 1 2-2"],
  whatsapp: ["M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5z"],
  ai: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"],
  site: ["M3 10l9-7 9 7", "M5 9v12h14V9", "M10 21v-6h4v6"],
  services: ["M12 2l10 5-10 5L2 7z", "M2 12l10 5 10-5", "M2 17l10 5 10-5"],
  "case-studies": ["M3 5h18v14H3z", "M3 15l5-5 4 4 3-3 6 6", "M15 9a1 1 0 1 0 0 .01"],
  testimonials: ["M7 7h4v4H7c0 3 1 4 3 5", "M14 7h4v4h-4c0 3 1 4 3 5"],
};

export function SettingsIcon({ name, className = "" }: { name: string; className?: string }) {
  const paths = PATHS[name] ?? PATHS.site;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
