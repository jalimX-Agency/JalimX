import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for next/link and friends. Importing `Link` from
 * here rather than from `next/link` means a French visitor clicking "Work"
 * lands on /fr/work instead of being thrown back to English.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
