import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Internal pages — useful to us, noise in an index. The dashboard also
      // sends noindex itself; robots.txt alone is a request, not a lock.
      disallow: ["/design-system", "/api/", "/admin"],
    },
    sitemap: "https://jalimx.com/sitemap.xml",
  };
}
