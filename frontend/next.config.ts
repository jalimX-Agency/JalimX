import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /*
   * /development became /approach when the page stopped being about
   * technologies. Permanent rather than temporary: the old path is in the
   * sitemap Google has already crawled, and a 301 is what moves that ranking
   * across instead of stranding it.
   */
  async redirects() {
    return [
      { source: "/development", destination: "/approach", permanent: true },
      { source: "/fr/development", destination: "/fr/approach", permanent: true },

      /*
       * The dashboard split in two: the agency's own work at the top level,
       * and everything jalimx.com renders under /admin/settings. Temporary
       * redirects, not permanent — these are private URLs in one person's
       * bookmarks, not addresses anything else links to, and a 308 would sit
       * in that browser's cache long after it stopped being useful.
       */
      { source: "/admin/settings", destination: "/admin/settings/site", permanent: false },
      { source: "/admin/settings/billing", destination: "/admin/settings/invoicing", permanent: false },
      { source: "/admin/services", destination: "/admin/settings/services", permanent: false },
      { source: "/admin/projects", destination: "/admin/settings/case-studies", permanent: false },
      {
        source: "/admin/projects/:slug",
        destination: "/admin/settings/case-studies/:slug",
        permanent: false,
      },
    ];
  },

  images: {
    /*
     * Narrowed from the defaults, which run up to 3840px.
     *
     * The screenshots are captured at 2160px wide and never render wider than
     * about 1120 CSS px, so the larger default breakpoints only ever produced
     * upscaled variants nobody requests. Generating them cost roughly half a
     * minute per page in development and the same work again on every build.
     *
     * These are the widths the layout actually asks for: full-bleed mobile,
     * the two-column work cards, and the lead card at 2x.
     */
    deviceSizes: [640, 828, 1080, 1440, 2160],
    imageSizes: [256, 384],

    /*
     * Images uploaded from the dashboard live on Cloudflare R2 behind this
     * host. Named exactly rather than wildcarded: the optimiser fetches
     * whatever it is pointed at, and an open pattern turns it into a free
     * image proxy for anyone who finds the endpoint.
     */
    remotePatterns: [{ protocol: "https", hostname: "cdn.jalimx.com" }],
  },
};

export default withNextIntl(nextConfig);
