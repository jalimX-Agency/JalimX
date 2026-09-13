import { api } from "@/lib/api/client";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { JxLockup, JxMark } from "@/components/brand/logo";

/**
 * Internal reference: every token, face and brand asset in one place, pulling
 * the same live content the site runs on. Not linked from the site — it exists
 * so a design decision can be checked against what actually renders.
 */

const SURFACES = [
  { name: "graphite", hex: "#111214", role: "page ground" },
  { name: "surface", hex: "#1B1D20", role: "cards, panels" },
  { name: "surface-2", hex: "#23262A", role: "raised" },
  { name: "rule", hex: "#282C31", role: "hairlines" },
];

const BRAND = [
  { name: "jx", hex: "#2E7FB8", role: "identity — logo, links" },
  { name: "jx-deep", hex: "#1E64A8", role: "logo on light" },
  { name: "signal", hex: "#E8823A", role: "action — CTA only" },
  { name: "bone", hex: "#F5F3EE", role: "text" },
];

function Swatch({ name, hex, role }: { name: string; hex: string; role: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-[3/2] rounded-lg border border-rule"
        style={{ background: hex }}
      />
      <div>
        <p className="font-mono text-xs text-bone">{name}</p>
        <p className="font-mono text-[0.65rem] text-faint">{hex}</p>
        <p className="mt-0.5 text-xs text-dim">{role}</p>
      </div>
    </div>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule py-14">
      <p className="eyebrow text-faint">
        {index} — {title}
      </p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/**
 * Pulls the real content the marketing site will run on.
 *
 * Every call is tag-cached, never `no-store`: one uncached fetch would opt the
 * whole route into dynamic rendering and cost us the static build. Freshness
 * comes from Laravel revalidating the tag on save, not from refetching per
 * visitor.
 *
 * Wrapped because the backend is a separate process in development — a dead API
 * should degrade this page, not blank it.
 */
async function getContent() {
  try {
    const [services, projects] = await Promise.all([
      api.services.list(),
      api.projects.list({ featured: true }),
    ]);
    return { up: true as const, services, projects };
  } catch (error) {
    return { up: false as const, reason: (error as Error).message };
  }
}

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function DesignSystem({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const content = await getContent();

  return (
    <main className="surface-dark mx-auto min-h-screen max-w-4xl px-6 sm:px-10">
      <header className="flex items-center justify-between py-6">
        <JxLockup />
        <span className="eyebrow text-faint">M0 · foundation</span>
      </header>

      <div className="py-16">
        <p className="eyebrow text-signal">JalimX · design system</p>
        <h1 className="h-display mt-4 text-5xl sm:text-6xl">
          Made,
          <br />
          not assembled
        </h1>
        <p className="mt-6 max-w-lg text-dim">
          Tokens, type and brand assets are wired. This page is the reference —
          the real homepage lands in M4.
        </p>
      </div>

      <Section index="01" title="surfaces">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SURFACES.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>

      <Section index="02" title="brand">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BRAND.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>

      <Section index="03" title="type">
        <div className="flex flex-col gap-7">
          <div>
            <p className="font-mono text-[0.65rem] text-faint">
              display · Chakra Petch 700
            </p>
            <p className="h-display mt-2 text-4xl">Built to perform</p>
          </div>
          <div>
            <p className="font-mono text-[0.65rem] text-faint">
              body · IBM Plex Sans 400
            </p>
            <p className="mt-2 max-w-lg">
              Websites engineered for load time, not just looks. Every project
              starts from an empty file.
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.65rem] text-faint">
              mono · IBM Plex Mono 400
            </p>
            <p className="mt-2 font-mono text-sm text-jx">
              $ pnpm build — 0 errors
            </p>
          </div>
        </div>
      </Section>

      <Section index="04" title="mark">
        <div className="flex flex-wrap items-end gap-10">
          {[64, 40, 24, 16].map((size) => (
            <div key={size} className="flex flex-col items-center gap-3">
              <JxMark style={{ height: size }} className="w-auto" />
              <span className="font-mono text-[0.65rem] text-faint">
                {size}px
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-center rounded-xl border border-rule bg-surface py-10">
            <JxMark className="h-14 w-auto" />
          </div>
          <div
            className="flex items-center justify-center rounded-xl py-10 text-navy"
            style={{ background: "#F4F3F0", ["--jx-accent" as string]: "#1E64A8" }}
          >
            <JxMark className="h-14 w-auto" />
          </div>
        </div>
        <p className="mt-3 text-xs text-dim">
          One file, both grounds — the mark inherits currentColor.
        </p>
      </Section>

      <Section index="05" title="live content">
        {!content.up ? (
          <div className="rounded-xl border border-signal/40 bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-signal" />
              <span className="font-mono text-sm">backend unreachable</span>
            </div>
            <pre className="mt-4 overflow-x-auto font-mono text-xs text-dim">
              {content.reason}
              {"\n\nStart it with:  cd backend && php artisan serve"}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-[#4ADE80]" />
              <span className="font-mono text-sm text-dim">
                {content.services.length} services · {content.projects.length}{" "}
                featured projects · static + ISR
              </span>
            </div>

            <div>
              <p className="font-mono text-[0.65rem] text-faint">services</p>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {content.services.map((service) => (
                  <li
                    key={service.slug}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                  >
                    <span className="font-display font-semibold uppercase tracking-wide">
                      {service.title.en}
                    </span>
                    <span className="font-mono text-xs text-faint">
                      {service.title.fr}
                    </span>
                    <span className="ml-auto text-sm text-dim">
                      {service.tagline.en}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-[0.65rem] text-faint">
                featured case studies
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {content.projects.map((project) => (
                  <article
                    key={project.slug}
                    className="flex flex-col gap-2 rounded-xl border border-rule bg-surface p-4"
                  >
                    <p className="font-mono text-[0.65rem] text-jx">
                      {project.client_name}
                    </p>
                    <h3 className="font-display text-base font-semibold leading-tight">
                      {project.title.en}
                    </h3>
                    <p className="text-xs text-dim">{project.summary.en}</p>
                    <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      {project.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded border border-rule px-1.5 py-0.5 font-mono text-[0.6rem] text-faint"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
              <p className="mt-3 text-xs text-faint">
                Outcomes and metrics are intentionally empty — those are real
                numbers, and they have to come from you.
              </p>
            </div>
          </div>
        )}
      </Section>

      <footer className="border-t border-rule py-10">
        <p className="font-mono text-xs text-faint">
          jalimx.com · MACHINED · see brand/BRAND.md
        </p>
      </footer>
    </main>
  );
}
