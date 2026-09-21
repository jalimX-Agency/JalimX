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

export type Metric = { value: string; label: Translated };

export type ProjectDetail = ProjectSummary & {
  project_url: string | null;
  position: number;
  /** Has been published at least once, so its address is locked. */
  is_live: boolean;
  summary: Translated;
  challenge: Translated;
  solution: Translated;
  outcome: Translated;
  tags: string[];
  metrics: Metric[];
  gallery: Media[];
  dashboard: Media[];
};

export type ProjectInput = {
  slug: string;
  client_name: string;
  year: number | null;
  project_url: string | null;
  position: number;
  is_published: boolean;
  is_featured: boolean;
  title: Translated;
  summary: Translated;
  challenge: Translated;
  solution: Translated;
  outcome: Translated;
  tags: string[];
  metrics: Metric[];
};

export type User = { id: number; name: string; email: string };

export type ServiceRow = {
  slug: string;
  position: number;
  is_published: boolean;
  title: Translated;
  tagline: Translated;
  body: Translated;
};

export type SiteSettings = {
  hero_headline: Translated;
  hero_body: Translated;
  contact_email: string;
  contact_phone: string;
  contact_location: string;
};

export type Client = {
  id: number;
  name: string;
  legal_name: string | null;
  ice: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  currency: string;
  notes: string | null;
  lead_id: number | null;
  /** Loaded on the client's own page, absent from the list. */
  engagements?: Engagement[];
  documents?: BillingDocument[];
  credentials?: Credential[];
  engagements_count?: number;
  created_at: string;
};

export const DOCUMENT_TYPES = ["quote", "invoice"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentStatus = "draft" | "sent" | "accepted" | "declined" | "cancelled";

export const PAYMENT_METHODS = ["transfer", "cheque", "cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type LineItem = {
  id: number;
  position: number;
  description: string;
  /** Decimal strings throughout: money must not become a float on the way. */
  quantity: string;
  unit_price: string;
  total: string;
};

export type LineItemInput = Pick<LineItem, "description" | "quantity" | "unit_price">;

export type Payment = {
  id: number;
  amount: string;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
};

export type PaymentInput = Omit<Payment, "id">;

/**
 * A quote or an invoice. Named for the paper rather than "Document", which
 * in a browser already means something else entirely.
 */
export type BillingDocument = {
  id: number;
  client_id: number;
  engagement_id: number | null;
  type: DocumentType;
  status: DocumentStatus;
  /** Null until it is issued; drafts have no number on purpose. */
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  /** For a retainer's invoice: the first day of the month it covers. */
  period: string | null;
  currency: string;
  tva_rate: string;
  subject: string | null;
  notes: string | null;
  terms: string | null;
  items: LineItem[];
  payments: Payment[];
  totals: {
    subtotal: string;
    tva: string;
    total: string;
    paid: string;
    due: string;
  };
  settled: boolean;
  overdue: boolean;
  editable: boolean;
  created_at: string;
};

/** What the draft editor sends back. */
export type DocumentInput = {
  engagement_id: number | null;
  issue_date: string | null;
  due_date: string | null;
  period: string | null;
  tva_rate: string;
  subject: string | null;
  notes: string | null;
  terms: string | null;
  items: LineItemInput[];
};

/** Who the invoice is from. Every field but the name may be empty. */
export type BillingProfile = {
  name: string;
  legal_name: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  ice: string;
  if: string;
  rc: string;
  patente: string;
  bank_name: string;
  rib: string;
  tva_rate: string;
  payment_terms: string;
  footer_note: string;
};

export type WorkType = {
  id: number;
  name: string;
  slug: string;
  position: number;
  /** Whether work of this kind involves signing in somewhere. */
  needs_logins: boolean;
  is_active: boolean;
};

export type WorkTypeInput = Pick<WorkType, "name" | "needs_logins" | "is_active">;

export const ATTACHMENT_KINDS = [
  "contract",
  "quote",
  "brief",
  "image",
  "invoice",
  "other",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type Attachment = {
  id: number;
  engagement_id: number;
  kind: AttachmentKind;
  name: string;
  size: number;
  created_at: string;
};

/** A login. The secret is never in this shape — it is asked for on its own. */
export type Credential = {
  id: number;
  client_id: number;
  engagement_id: number | null;
  label: string;
  url: string | null;
  username: string | null;
  has_secret: boolean;
  has_notes: boolean;
  updated_at: string | null;
};

export type CredentialInput = {
  label: string;
  engagement_id: number | null;
  url: string | null;
  username: string | null;
  /** Left out entirely when unchanged, so saving a label keeps the password. */
  secret?: string | null;
  notes?: string | null;
};

export const ENGAGEMENT_STATUSES = ["planned", "active", "paused", "done", "cancelled"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

/** one_off: a job with an end. monthly: a retainer that runs on. */
export const BILLINGS = ["one_off", "monthly"] as const;
export type Billing = (typeof BILLINGS)[number];

/** A piece of work for a client — the internal side of a "project". */
export type Engagement = {
  id: number;
  client_id: number;
  title: string;
  status: EngagementStatus;
  billing: Billing;
  /**
   * A decimal string, in the client's currency. Never a float. The whole
   * price for a one-off, the monthly charge for a retainer.
   */
  budget: string | null;
  starts_on: string | null;
  ends_on: string | null;
  description: string | null;
  case_study_id: number | null;
  case_study: { slug: string; title: string; is_published: boolean } | null;
  work_types: { id: number; name: string; needs_logins: boolean }[];
  attachments: Attachment[];
  created_at: string;
};

export type EngagementInput = Omit<
  Engagement,
  | "id"
  | "client_id"
  | "case_study"
  | "case_study_id"
  | "work_types"
  | "attachments"
  | "created_at"
> & { work_type_ids: number[] };

export const emptyEngagement = (): EngagementInput => ({
  title: "",
  status: "planned",
  billing: "one_off",
  budget: null,
  starts_on: null,
  ends_on: null,
  description: null,
  work_type_ids: [],
});

/** What the form sends: everything editable, no id and no provenance. */
export type ClientInput = Omit<
  Client,
  | "id"
  | "lead_id"
  | "engagements"
  | "engagements_count"
  | "documents"
  | "credentials"
  | "created_at"
>;

export const emptyClient = (): ClientInput => ({
  name: "",
  legal_name: null,
  ice: null,
  contact_name: null,
  email: null,
  phone: null,
  website: null,
  address: null,
  city: null,
  country: "Morocco",
  currency: "MAD",
  notes: null,
});

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
  /** The client this enquiry became, or null if it hasn't been converted. */
  client: { id: number; name: string } | null;
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

/**
 * Signed out. The panel layout is already redirecting when this happens, so a
 * page keeps its skeleton rather than flashing "Unauthenticated." on the way
 * to the login screen.
 */
export const isSignedOut = (e: unknown) => e instanceof ApiError && e.status === 401;

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

  clients: (q?: string) =>
    request<{ data: Client[] }>(`/api/v1/admin/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(
      (r) => r.data,
    ),

  client: (id: number | string) =>
    request<{ data: Client }>(`/api/v1/admin/clients/${id}`).then((r) => r.data),

  createClient: (input: ClientInput) =>
    request<{ data: Client }>("/api/v1/admin/clients", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateClient: (id: number, input: ClientInput) =>
    request<{ data: Client }>(`/api/v1/admin/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removeClient: (id: number) =>
    request(`/api/v1/admin/clients/${id}`, { method: "DELETE" }),

  createEngagement: (clientId: number, input: EngagementInput) =>
    request<{ data: Engagement }>(`/api/v1/admin/clients/${clientId}/engagements`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateEngagement: (id: number, input: EngagementInput) =>
    request<{ data: Engagement }>(`/api/v1/admin/engagements/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removeEngagement: (id: number) =>
    request(`/api/v1/admin/engagements/${id}`, { method: "DELETE" }),

  /** Starts the public page about a piece of work, and links the two. */
  createCaseStudy: (engagementId: number) =>
    request<{ data: Engagement }>(`/api/v1/admin/engagements/${engagementId}/case-study`, {
      method: "POST",
    }).then((r) => r.data),

  workTypes: () =>
    request<{ data: WorkType[] }>("/api/v1/admin/work-types").then((r) => r.data),

  createWorkType: (input: WorkTypeInput) =>
    request<{ data: WorkType }>("/api/v1/admin/work-types", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateWorkType: (id: number, input: WorkTypeInput) =>
    request<{ data: WorkType }>(`/api/v1/admin/work-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removeWorkType: (id: number) =>
    request(`/api/v1/admin/work-types/${id}`, { method: "DELETE" }),

  createCredential: (clientId: number, input: CredentialInput) =>
    request<{ data: Credential }>(`/api/v1/admin/clients/${clientId}/credentials`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateCredential: (id: number, input: CredentialInput) =>
    request<{ data: Credential }>(`/api/v1/admin/credentials/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  /** Fetched only when the person asks to see one. */
  revealCredential: (id: number) =>
    request<{ data: { id: number; secret: string; notes: string } }>(
      `/api/v1/admin/credentials/${id}/reveal`,
    ).then((r) => r.data),

  removeCredential: (id: number) =>
    request(`/api/v1/admin/credentials/${id}`, { method: "DELETE" }),

  removeAttachment: (id: number) =>
    request(`/api/v1/admin/attachments/${id}`, { method: "DELETE" }),

  /** Followed as a link, so it goes to the session-backed web route. */
  attachmentDownload: (id: number) => `${API}/attachments/${id}/download`,

  createDocument: (
    clientId: number,
    body: {
      type: DocumentType;
      engagement_id?: number | null;
      preset?: "deposit" | "balance" | "full" | "month";
      /** Which month a retainer's invoice covers. */
      period?: string;
    },
  ) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/clients/${clientId}/documents`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  updateDocument: (id: number, input: DocumentInput) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  issueDocument: (id: number) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/documents/${id}/issue`, {
      method: "POST",
    }).then((r) => r.data),

  setDocumentStatus: (id: number, status: DocumentStatus) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/documents/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }).then((r) => r.data),

  removeDocument: (id: number) =>
    request(`/api/v1/admin/documents/${id}`, { method: "DELETE" }),

  /**
   * Opened in a tab rather than fetched: the browser renders the PDF.
   * Deliberately not under /api — a new tab sends no Origin header, and
   * Sanctum would refuse the session cookie on a request that has none.
   */
  documentPdf: (id: number) => `${API}/documents/${id}/pdf`,

  addPayment: (documentId: number, input: PaymentInput) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/documents/${documentId}/payments`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removePayment: (id: number) =>
    request<{ data: BillingDocument }>(`/api/v1/admin/payments/${id}`, {
      method: "DELETE",
    }).then((r) => r.data),

  billingProfile: () =>
    request<{ data: BillingProfile }>("/api/v1/admin/billing-profile").then((r) => r.data),

  updateBillingProfile: (input: BillingProfile) =>
    request<{ data: BillingProfile }>("/api/v1/admin/billing-profile", {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  /** Makes a client from an enquiry; returns the existing one if already converted. */
  convertLead: (leadId: number) =>
    request<{ data: Client }>(`/api/v1/admin/leads/${leadId}/convert`, {
      method: "POST",
    }).then((r) => r.data),

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

  createProject: (input: { client_name: string; title_en: string; slug?: string }) =>
    request<{ data: ProjectDetail }>("/api/v1/admin/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateProject: (slug: string, input: ProjectInput) =>
    request<{ data: ProjectDetail }>(`/api/v1/admin/projects/${slug}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  services: () =>
    request<{ data: ServiceRow[] }>("/api/v1/admin/services").then((r) => r.data),

  updateService: (row: ServiceRow) =>
    request<{ data: ServiceRow }>(`/api/v1/admin/services/${row.slug}`, {
      method: "PUT",
      body: JSON.stringify(row),
    }).then((r) => r.data),

  settings: () =>
    request<{ data: SiteSettings }>("/api/v1/admin/settings").then((r) => r.data),

  updateSettings: (input: SiteSettings) =>
    request<{ data: SiteSettings }>("/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removeMedia: (id: number) =>
    request(`/api/v1/admin/media/${id}`, { method: "DELETE" }),

  /** Same XHR reasoning as `upload` below: a contract on a slow line. */
  uploadAttachment(
    engagementId: number,
    kind: AttachmentKind,
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<Attachment> {
    return new Promise((resolve, reject) => {
      const send = () => {
        const form = new FormData();
        form.append("kind", kind);
        form.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/api/v1/admin/engagements/${engagementId}/attachments`);
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
