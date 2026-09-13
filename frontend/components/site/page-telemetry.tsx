"use client";

import { useEffect, useState } from "react";

/**
 * What this page cost the visitor, read out of their own browser.
 *
 * /approach used to claim the sites we build are fast and then ask to be
 * believed. Every other agency page makes the same claim, so it carries no
 * information. This is the one version of it a reader cannot dismiss: the
 * numbers come from the Performance API in *their* browser, on *their*
 * connection, for the page they are looking at. We are not a party to the
 * measurement, which is exactly why it counts.
 *
 * It is also the only honest proof available to us. The figures for a client's
 * site depend on the images that client uploads afterwards; the figures for
 * this page depend only on how it was built.
 */

type Reading = {
  bytes: number;
  requests: number;
  thirdParty: number;
  lcp: number;
};

type Props = {
  label: string;
  rows: { bytes: string; requests: string; thirdParty: string; lcp: string };
  note: string;
};

/** A dash rather than a zero: nothing has been measured yet, and 0 would lie. */
const PENDING = "—";

function kb(bytes: number) {
  if (bytes <= 0) return PENDING;
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1048576).toFixed(2)} MB`;
}

export function PageTelemetry({ label, rows, note }: Props) {
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    const read = () => {
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const navigation = performance.getEntriesByType(
        "navigation",
      ) as PerformanceResourceTiming[];

      /*
       * Resource timing does not include the HTML document — that lives on the
       * navigation entry — so counting only resources undercounts both the
       * bytes and the request count by exactly one, the most important one.
       */
      const entries = [...navigation, ...resources];

      const bytes = entries.reduce((sum, e) => sum + (e.transferSize || 0), 0);

      const here = location.host;
      const thirdParty = new Set(
        resources
          .map((e) => {
            try {
              return new URL(e.name).host;
            } catch {
              // data: and blob: URLs have no host and are not third parties.
              return here;
            }
          })
          .filter((host) => host !== here),
      );

      setReading((prev) => ({
        bytes,
        requests: entries.length,
        thirdParty: thirdParty.size,
        // LCP arrives on its own schedule; keep whatever the observer has.
        lcp: prev?.lcp ?? 0,
      }));
    };

    let stop = () => {};
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) {
          setReading((prev) =>
            prev
              ? { ...prev, lcp: latest.startTime }
              : {
                  bytes: 0,
                  requests: 0,
                  thirdParty: 0,
                  lcp: latest.startTime,
                },
          );
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      stop = () => observer.disconnect();
    } catch {
      // Not supported here. The other three figures still read.
    }

    // Late resources keep arriving after mount, so take a second look rather
    // than reporting whatever happened to have landed by the first frame.
    read();
    const settle = setTimeout(read, 1200);

    return () => {
      clearTimeout(settle);
      stop();
    };
  }, []);

  /*
   * Ordered strongest first, and not by accident. The byte count is the least
   * impressive figure here — three self-hosted families and the motion library
   * the whole site runs on put it around 370 KB, which is respectable and not
   * remarkable. The paint time and the third-party count are the remarkable
   * ones, so they lead. All four are shown either way; a readout that hid the
   * weakest number would deserve the scepticism it got.
   */
  const display: { label: string; value: string }[] = [
    {
      label: rows.lcp,
      value: reading?.lcp ? `${(reading.lcp / 1000).toFixed(2)} s` : PENDING,
    },
    {
      label: rows.thirdParty,
      // The one row where zero is the point, so it must not read as "not
      // measured". Once anything has been read at all, print the number.
      value: reading ? String(reading.thirdParty) : PENDING,
    },
    {
      label: rows.requests,
      value: reading?.requests ? String(reading.requests) : PENDING,
    },
    { label: rows.bytes, value: reading ? kb(reading.bytes) : PENDING },
  ];

  return (
    <div>
      <p className="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.14em] text-signal">
        {label}
      </p>

      <dl className="mt-3">
        {display.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-6 py-1.5"
          >
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
              {row.label}
            </dt>
            {/* Fixed-width digits, or the row twitches every time a figure
                settles from three characters to four. */}
            <dd className="font-mono text-sm tabular-nums text-[var(--fg)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-[30ch] border-t border-[var(--hairline)] pt-3 text-[0.72rem] leading-relaxed text-[var(--fg-faint)]">
        {note}
      </p>
    </div>
  );
}
