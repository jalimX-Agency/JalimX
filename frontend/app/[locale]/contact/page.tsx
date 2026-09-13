import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/components/site/contact-form";
import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { routing } from "@/i18n/routing";
import type { Locale, Service } from "@/lib/api/client";
import { api } from "@/lib/api/client";
import { text } from "@/lib/settings";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { en: "/contact", fr: "/fr/contact" } },
  };
}

async function getServices(): Promise<Service[]> {
  try {
    return await api.services.list();
  } catch {
    return [];
  }
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("contact");
  const active = locale as Locale;

  const [services, settings] = await Promise.all([
    getServices(),
    api.settings.all().catch(() => ({}) as Record<string, unknown>),
  ]);

  const email = text(settings, "contact_email");
  const phone = text(settings, "contact_phone");
  const location = text(settings, "contact_location");

  const steps = [t("next1"), t("next2"), t("next3")];

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <div className="grid gap-14 lg:grid-cols-[1fr_minmax(0,38%)] lg:gap-20">
            <div>
              <h1 className="font-display text-[clamp(2.4rem,5.5vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance">
                {t("heading")}
              </h1>

              <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-[var(--fg-dim)]">
                {t("intro")}
              </p>

              <div className="mt-12">
                <ContactForm services={services} locale={active} />
              </div>
            </div>

            <aside className="flex flex-col gap-10 lg:pt-4">
              <div>
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("nextHeading")}
                </h2>
                <ol className="mt-5 flex flex-col gap-4">
                  {steps.map((step, i) => (
                    <li
                      key={step}
                      className="flex gap-3 text-sm text-[var(--fg-dim)]"
                    >
                      <span className="font-mono text-[var(--link)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {(email || phone || location) && (
                <div>
                  <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                    {t("directHeading")}
                  </h2>
                  <address className="mt-5 flex flex-col gap-2 not-italic text-sm">
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="text-[var(--link)] underline-offset-4 hover:underline"
                      >
                        {email}
                      </a>
                    )}
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
                      >
                        {phone}
                      </a>
                    )}
                    {location && (
                      <span className="text-[var(--fg-faint)]">{location}</span>
                    )}
                  </address>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>

      <ClosingBlock
        email={email}
        phone={phone}
        location={location}
        showCta={false}
      />
    </>
  );
}
