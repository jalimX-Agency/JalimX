import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

/**
 * The card a shared link shows when a page has no picture of its own: the
 * homepage, the work index, About, Approach, Contact. Case studies bring their
 * own.
 *
 * Drawn here rather than saved as a file so the line under the name follows the
 * language and the tagline and cannot drift from what the site says. Served at
 * /og-en.png and /og-fr.png — addresses with a dot, which the language
 * middleware leaves alone, so a crawler gets the image on the first request
 * instead of a redirect.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export async function renderOgCard(locale: "en" | "fr") {
  const footer = await getTranslations({ locale, namespace: "footer" });
  const seo = await getTranslations({ locale, namespace: "seo" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#101318",
          color: "#f5f3ee",
          padding: "72px 80px",
          borderBottom: "10px solid #2e7fb8",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#8e8a83",
          }}
        >
          {locale === "fr"
            ? "Studio de développement web · Marrakech"
            : "Web development studio · Marrakech"}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            JalimX
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 48, color: "#5b9bb5" }}>
            {footer("tagline")}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#8e8a83", maxWidth: 940 }}>
          {seo("workTitle")}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
