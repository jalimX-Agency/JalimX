import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /*
   * Everything except API routes, Next internals, and any path that looks like
   * a file.
   *
   * Note the doubled backslash: `\\.` is what puts a literal dot in the regex.
   * Written as `\.` the string collapses to a bare `.`, the alternative matches
   * nearly every path, and the middleware silently stops running — which shows
   * up as every unprefixed English route 404ing while /fr/* keeps working,
   * because those match the [locale] segment on their own.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
