import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { CinematicHero } from "@/components/site/cinematic-hero";
import { ClientStrip } from "@/components/site/client-strip";
import { ProcessSection } from "@/components/site/process-section";
import { ServicesSection } from "@/components/site/services-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { WorkSection } from "@/components/site/work-section";
import { routing } from "@/i18n/routing";
import type {
  Locale,
  Project,
  Service,
  Testimonial,
  Translated,
} from "@/lib/api/client";
import { api, t as tr } from "@/lib/api/client";
import { getWorkShots } from "@/lib/work-shots";
import { pick, text } from "@/lib/settings";

/**
 * Section order follows the questions a business owner actually asks, in the
 * order they ask them: what is this → what do you do → is it real → how does it
 * go → let's talk.
 *
 * Work sits after services on purpose. A portfolio means nothing until you know
 * what you are looking at.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const FALLBACK = {
  headline: { en: "Made, not assembled", fr: "Conçu, pas assemblé" },
  body: {
    en: "We build websites from an empty file — no templates, no page builders.",
    fr: "Nous construisons des sites à partir d'un fichier vide — sans gabarit ni page builder.",
  },
} satisfies Record<string, Translated>;

/*
 * Every fetch is tag-cached, never `no-store`: one uncached call would opt the
 * whole route into dynamic rendering and cost us the static build. Each is
 * wrapped separately so a backend hiccup degrades one section rather than
 * blanking the page.
 */
async function getSettings(): Promise<Record<string, unknown>> {
  try {
    return await api.settings.all();
  } catch {
    return {};
  }
}

async function getServices(): Promise<Service[]> {
  try {
    return await api.services.list();
  } catch {
    return [];
  }
}

async function getFeatured(): Promise<Project[]> {
  try {
    return await api.projects.list({ featured: true });
  } catch {
    return [];
  }
}

async function getTestimonials(): Promise<Testimonial[]> {
  try {
    return await api.testimonials.list();
  } catch {
    return [];
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const hero = await getTranslations("hero");
  const nav = await getTranslations("nav");

  const [settings, services, projects, testimonials, shots] = await Promise.all([
    getSettings(),
    getServices(),
    getFeatured(),
    getTestimonials(),
    getWorkShots(),
  ]);

  const active = locale as Locale;

  return (
    <>
      <div className="surface-light">
        <Header />
        <main>
          <CinematicHero
            headline={tr(pick(settings, "hero_headline", FALLBACK.headline), active)}
            body={tr(pick(settings, "hero_body", FALLBACK.body), active)}
            labels={{
              eyebrow: hero("eyebrow"),
              cta: nav("cta"),
              seeWork: hero("seeWork"),
            }}
          />
          <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:px-10 md:pb-28">
            <ClientStrip />
          </div>
          <ServicesSection services={services} locale={active} />
          <WorkSection projects={projects} shots={shots} locale={active} />
          <ProcessSection />
          <TestimonialsSection testimonials={testimonials} locale={active} />
        </main>
      </div>

      <ClosingBlock
        email={text(settings, "contact_email")}
        phone={text(settings, "contact_phone")}
        location={text(settings, "contact_location")}
      />
    </>
  );
}
