/**
 * The dashboard's line to Laravel.
 *
 * Session auth over cookies: every request carries `credentials: "include"`,
 * and every write carries the XSRF token Laravel set as a readable cookie. The
 * session cookie itself is httpOnly and never touched from here — which is the
 * point of choosing it over a token in localStorage.
 *
 * Runs in the browser only. The API base must be on the same site as the page
 * (localhost with localhost, jalimx.com with api.jalimx.com) or the browser
 * will not send the session cookie at all.
 */

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Translated = { en: string; fr: string };

export type Media = {
  id: number;
  url: string;
  name: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type ProjectSummary = {
  slug: string;
  client_name: string;
  title: Translated;
  year: number | null;
  is_published: boolean;
  is_featured: boolean;
  cover: Media | null;
  counts: { gallery: number; dashboard: number };
};

export type ProjectDetail = ProjectSummary & {
  project_url: string | null;
  gallery: Media[];
  dashboard: Media[];
};

export type User = { id: number; name: string; email: string };

export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service_interest: string | null;
  budget_range: string | null;
  message: string;
  note: string | null;
  status: LeadStatus;
  locale: string;
  source: string | null;
  is_read: boolean;
  created_at: string;
};

export type LeadPage = {
  data: Lead[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    counts: Record<LeadStatus, number>;
    unread: number;
  };
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

function xsrf(): string {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Sets the XSRF cookie. Laravel rotates it, so call before any first write. */
export async function csrf(): Promise<void> {
  await fetch(`${API}/sanctum/csrf-cookie`, { credentials: "include" });
}

async function parse<T>(res: Response): Promise<T> {
  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.message ?? `Request failed (${res.status})`,
      body?.errors ?? {},
    );
  }

  return body as T;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const write = init.method && init.method !== "GET";
  if (write && !xsrf()) await csrf();

  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(write ? { "X-XSRF-TOKEN": xsrf() } : {}),
      ...init.headers,
    },
  });

  return parse<T>(res);
}

export const admin = {
  me: () => request<{ data: User }>("/api/v1/auth/me").then((r) => r.data),

  async login(email: string, password: string) {
    await csrf();
    return request<{ data: User }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((r) => r.data);
  },

  logout: () => request("/logout", { method: "POST" }),

  projects: () =>
    request<{ data: ProjectSummary[] }>("/api/v1/admin/projects").then(
      (r) => r.data,
    ),

  project: (slug: string) =>
    request<{ data: ProjectDetail }>(`/api/v1/admin/projects/${slug}`).then(
      (r) => r.data,
    ),

  leads(params: { status?: LeadStatus; q?: string; page?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    if (params.page && params.page > 1) query.set("page", String(params.page));
    const qs = query.toString();
    return request<LeadPage>(`/api/v1/admin/leads${qs ? `?${qs}` : ""}`);
  },

  lead: (id: number | string) =>
    request<{ data: Lead }>(`/api/v1/admin/leads/${id}`).then((r) => r.data),

  updateLead: (
    id: number,
    change: Partial<Pick<Lead, "status" | "note" | "is_read">>,
  ) =>
    request<{ data: Lead }>(`/api/v1/admin/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(change),
    }).then((r) => r.data),

  removeLead: (id: number) =>
    request(`/api/v1/admin/leads/${id}`, { method: "DELETE" }),

  removeMedia: (id: number) =>
    request(`/api/v1/admin/media/${id}`, { method: "DELETE" }),

  /*
   * XMLHttpRequest rather than fetch, for one reason: fetch still cannot report
   * upload progress, and a 6 MB photo on a hotel's wifi with no bar looks the
   * same as a dashboard that has frozen.
   */
  upload(
    slug: string,
    collection: "cover" | "gallery" | "dashboard",
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<Media> {
    return new Promise((resolve, reject) => {
      const send = () => {
        const form = new FormData();
        form.append("collection", collection);
        form.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/api/v1/admin/projects/${slug}/media`);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-XSRF-TOKEN", xsrf());

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
        xhr.onerror = () => reject(new ApiError(0, "Network error — check the connection."));
        xhr.onload = () => {
          const body = (() => {
            try {
              return JSON.parse(xhr.responseText);
            } catch {
              return null;
            }
          })();
          if (xhr.status >= 200 && xhr.status < 300) resolve(body.data);
          else
            reject(
              new ApiError(
                xhr.status,
                body?.message ?? `Upload failed (${xhr.status})`,
                body?.errors ?? {},
              ),
            );
        };
        xhr.send(form);
      };

      if (xsrf()) send();
      else csrf().then(send, reject);
    });
  },
};
