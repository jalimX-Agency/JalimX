import type { components, paths } from "./schema";

/**
 * Typed client for the Laravel API.
 *
 * Types in ./schema.d.ts are generated from the backend's OpenAPI document
 * (`pnpm api:types`) — never edit them by hand. If a field changes in Laravel
 * and the frontend isn't regenerated, `tsc` fails. That check is the only thing
 * holding a headless split together, so keep it in CI.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/* -------------------------------------------------------------------------- */
/* Domain types — re-exported so pages import from here, not from the schema.  */
/* -------------------------------------------------------------------------- */

type Schemas = components["schemas"];

export type Project = Schemas["ProjectResource"];
export type Service = Schemas["ServiceResource"];
export type Testimonial = Schemas["TestimonialResource"];
export type Media = Schemas["MediaResource"];

export type Locale = "en" | "fr";
export type Translated = { en: string; fr: string };

/** Pick one locale out of a translated field, falling back to English. */
export function t(field: Translated | undefined, locale: Locale): string {
  if (!field) return "";
  return field[locale] || field.en || "";
}

/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type CacheOptions = {
  /**
   * Next's fetch cache. Marketing pages pass tags so Laravel can revalidate
   * them by webhook; anything user-specific passes `no-store` instead.
   */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
};

type RequestOptions = CacheOptions & {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...rest,
    credentials: "include", // Sanctum cookies
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      payload.message ?? `Request failed with ${response.status}`,
      payload.errors
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Content reads are static and revalidated by tag from the dashboard. */
const cached = (tag: string): CacheOptions => ({
  next: { tags: [tag], revalidate: 3600 },
});

type HealthResponse =
  paths["/v1/health"]["get"]["responses"][200]["content"]["application/json"];

type LeadPayload = Schemas["StoreLeadRequest"];

export const api = {
  /** Liveness probe. Also the smoke test that frontend↔backend wiring works. */
  health: () => request<HealthResponse>("/v1/health", { cache: "no-store" }),

  services: {
    list: () =>
      request<{ data: Service[] }>("/v1/services", cached("services")).then(
        (r) => r.data
      ),
    get: (slug: string) =>
      request<{ data: Service }>(
        `/v1/services/${encodeURIComponent(slug)}`,
        cached("services")
      ).then((r) => r.data),
  },

  projects: {
    list: (params: { featured?: boolean; tag?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.featured) query.set("featured", "1");
      if (params.tag) query.set("tag", params.tag);
      const qs = query.size ? `?${query}` : "";

      return request<{ data: Project[] }>(
        `/v1/projects${qs}`,
        cached("projects")
      ).then((r) => r.data);
    },
    get: (slug: string) =>
      request<{ data: Project }>(
        `/v1/projects/${encodeURIComponent(slug)}`,
        cached("projects")
      ).then((r) => r.data),
  },

  testimonials: {
    list: () =>
      request<{ data: Testimonial[] }>(
        "/v1/testimonials",
        cached("testimonials")
      ).then((r) => r.data),
  },

  settings: {
    all: () =>
      request<{ data: Record<string, unknown> }>(
        "/v1/settings",
        cached("settings")
      ).then((r) => r.data),
  },

  leads: {
    /** Contact form. Throws ApiError with `.errors` on a 422. */
    create: (payload: LeadPayload) =>
      request<{ message: string }>("/v1/leads", {
        method: "POST",
        body: payload,
        cache: "no-store",
      }),
  },
};
