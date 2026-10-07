import { renderOgCard } from "@/lib/og-card";

export async function GET() {
  return renderOgCard("en");
}
