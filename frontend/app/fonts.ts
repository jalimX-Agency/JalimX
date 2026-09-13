import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * next/font/google self-hosts at build time: the files are served from our own
 * domain and no request ever reaches Google. This satisfies the "self-hosted"
 * requirement in BRAND.md without shipping font binaries in the repo.
 */

export const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
