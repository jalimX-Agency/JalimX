import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Internal reference page — useful to us, noise in an index.
      disallow: ["/design-system", "/api/"],
    },
    sitemap: "https://jalimx.com/sitemap.xml",
  };
}
