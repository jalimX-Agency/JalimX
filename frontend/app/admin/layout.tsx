import type { Metadata } from "next";

import { chakra, plexMono, plexSans } from "../fonts";
import "../globals.css";

/**
 * Root layout for the dashboard.
 *
 * There is no app/layout.tsx — the marketing site's [locale] segment owns its
 * own <html> so `lang` can be right per locale — so the dashboard needs a root
 * of its own. It shares the fonts and tokens and nothing else: no Lenis, no
 * header, no translations.
 */

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · JalimX dashboard" },
  // robots.txt asks; this insists. A login page in a search index is an
  // invitation.
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="surface-light min-h-screen">{children}</body>
    </html>
  );
}
