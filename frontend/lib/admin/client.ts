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
  /** A PDF or an image, which a browser can show without being asked to run anything. */
  viewable: boolean;
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

/** One line on a piece of work's to-do list. */
export const TASK_STATUSES = ["todo", "doing", "waiting", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_REPEATS = ["daily", "weekdays", "weekly", "monthly"] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number];

/**
 * Something to do. It may belong to a piece of work, to a client only, or
 * to nobody ("read today's email").
 */
export type Task = {
  id: number;
  engagement_id: number | null;
  client_id: number | null;
  /** Names, filled in when the list is read across clients. */
  work: string | null;
  client: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** 0–100. Counted from the checklist when it has one. */
  progress: number;
  notes: string | null;
  checklist: { text: string; done: boolean }[];
  due_on: string | null;
  /** "HH:MM"; null means the default hour used for reminder timing. */
  due_time: string | null;
  repeat: TaskRepeat | null;
  /** Minutes before due (0 = at the due time) a WhatsApp reminder is sent. */
  reminders: number[];
  /** When it was ticked off; null while it is still to do. */
  done_at: string | null;
  created_at: string;
};

/**
 * One of the WhatsApp templates the app sends: a task reminder to the
 * agency, or an invoice or logins message to a client.
 */
export type ReminderTemplate = {
  key: "basic" | "notes" | "steps" | "full" | "invoice" | "logins";
  group: "reminders" | "clients";
  /** "ar" for reminders, "fr" for clients. */
  language: string;
  footer: string;
  /** The button under the message, if it has one. */
  button: string | null;
  /** A sample file name when the message carries a PDF. */
  document: string | null;
  /** Its name on Meta's side. */
  name: string;
  label: string;
  hint: string;
  /** What {{1}}, {{2}}… stand for, in order. */
  params: string[];
  /** Sample values for the preview, in the same order. */
  example: string[];
  default_body: string;
  body: string;
  /** Meta's status; null when it has not been created there yet. */
  status: string | null;
  rejected_reason: string | null;
};

export type WhatsAppSettings = {
  /** Whether the server has the credentials at all. */
  configured: boolean;
  connection: { name: string; number: string; quality: string } | null;
  error: string | null;
  /** The number reminders go to, digits only with its country code. */
  recipient: string | null;
  templates: ReminderTemplate[];
  legacy: { name: string; status: string | null };
};

/** The reminder offsets offered in the UI, in minutes before due. */
export const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 2880, label: "2 days before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 180, label: "3 hours before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 0, label: "At the due time" },
];

export type TaskInput = Partial<{
  title: string;
  notes: string | null;
  due_on: string | null;
  due_time: string | null;
  done: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  repeat: TaskRepeat | null;
  engagement_id: number | null;
  client_id: number | null;
  checklist: { text: string; done: boolean }[];
  reminders: number[];
}>;

/** One step of a template. `day` counts from the start date; null = no date. */
export type TemplateStep = {
  title: string;
  day: number | null;
  priority: TaskPriority;
  checklist: string[];
};

/** The steps a kind of job always takes, dropped onto new work in one go. */
export type TaskTemplate = {
  id: number;
  name: string;
  description: string | null;
  /** Suggested first for work of this kind. */
  work_type_id: number | null;
  items: TemplateStep[];
};

export type TaskTemplateInput = Omit<TaskTemplate, "id">;

/** What a task can be linked to: clients, and their unfinished work. */
export type TaskLinks = { id: number; name: string; works: { id: number; title: string }[] }[];

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
  tasks: Task[];
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
  | "tasks"
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

/** What the first screen needs, in one shape. */
export type Overview = {
  /** One row per currency: adding dirhams to euros describes nothing. */
  money: {
    currency: string;
    outstanding: string;
    overdue: string;
    paid_this_month: string;
    recurring: string;
  }[];
  unbilled: {
    engagement_id: number;
    client_id: number;
    client: string;
    title: string;
    period: string;
    amount: string | null;
    currency: string;
  }[];
  overdue: {
    id: number;
    number: string | null;
    client_id: number;
    client: string;
    due_date: string | null;
    days_late: number;
    due: string;
    currency: string;
  }[];
  /** Open tasks that are late or due within the week, across every client. */
  tasks: {
    id: number;
    title: string;
    due_on: string;
    /** Negative when late, 0 today, positive ahead. */
    days: number;
    status: TaskStatus;
    priority: TaskPriority;
    progress: number;
    engagement_id: number | null;
    work: string | null;
    client_id: number | null;
    client: string | null;
  }[];
  drafts: {
    id: number;
    type: DocumentType;
    client_id: number;
    client: string;
    subject: string | null;
    total: string;
    currency: string;
    created_at: string;
  }[];
  leads: {
    unread: number;
    recent: {
      id: number;
      name: string;
      company: string | null;
      status: LeadStatus;
      is_read: boolean;
      created_at: string;
    }[];
  };
  counts: {
    clients: number;
    clients_without_ice: number;
    active_work: number;
    planned_work: number;
  };
  as_of: string;
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

  overview: () =>
    request<{ data: Overview }>("/api/v1/admin/overview").then((r) => r.data),

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

  /** A PDF of the chosen logins, and its password when it has one. */
  credentialSheet: (clientId: number, ids: number[], protect: boolean) =>
    request<{ data: { filename: string; pdf: string; password: string | null } }>(
      `/api/v1/admin/clients/${clientId}/credentials/sheet`,
      { method: "POST", body: JSON.stringify({ ids, protect }) },
    ).then((r) => r.data),

  /** Emails the protected PDF; the password comes back here, never in the email. */
  sendCredentials: (clientId: number, ids: number[], to: string | null, note: string | null) =>
    request<{ data: { sent_to: string; count: number; password: string } }>(
      `/api/v1/admin/clients/${clientId}/credentials/send`,
      { method: "POST", body: JSON.stringify({ ids, to, note }) },
    ).then((r) => r.data),

  removeCredential: (id: number) =>
    request(`/api/v1/admin/credentials/${id}`, { method: "DELETE" }),

  tasks: () =>
    request<{ data: Task[]; links: TaskLinks }>("/api/v1/admin/tasks"),

  /** With an engagement id it goes under that work; otherwise as sent. */
  createTask: (engagementId: number | null, input: TaskInput & { title: string }) =>
    request<{ data: Task }>(
      engagementId ? `/api/v1/admin/engagements/${engagementId}/tasks` : "/api/v1/admin/tasks",
      { method: "POST", body: JSON.stringify(input) },
    ).then((r) => r.data),

  /**
   * Partial: send only what changed — a tick, a date, a status. `next` is
   * the following one of a repeating task that was just finished.
   */
  updateTask: (id: number, change: TaskInput) =>
    request<{ data: Task; next: Task | null }>(`/api/v1/admin/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(change),
    }).then((r) => ({ task: r.data, next: r.next })),

  taskTemplates: () =>
    request<{ data: TaskTemplate[] }>("/api/v1/admin/task-templates").then((r) => r.data),

  createTaskTemplate: (input: TaskTemplateInput) =>
    request<{ data: TaskTemplate }>("/api/v1/admin/task-templates", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  updateTaskTemplate: (id: number, input: TaskTemplateInput) =>
    request<{ data: TaskTemplate }>(`/api/v1/admin/task-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  removeTaskTemplate: (id: number) =>
    request(`/api/v1/admin/task-templates/${id}`, { method: "DELETE" }),

  /** Makes the template's steps into tasks, dated from `start_on`. */
  applyTaskTemplate: (
    id: number,
    input: {
      engagement_id?: number | null;
      client_id?: number | null;
      start_on: string;
      /** Indexes of steps to leave out. */
      skip?: number[];
    },
  ) =>
    request<{ data: Task[] }>(`/api/v1/admin/task-templates/${id}/apply`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  /** Saves a work's tasks as a new template. */
  templateFromWork: (engagementId: number, name: string) =>
    request<{ data: TaskTemplate }>(`/api/v1/admin/engagements/${engagementId}/task-template`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((r) => r.data),

  /** One change to many tasks: ticking a batch off, or clearing it out. */
  bulkTasks: (ids: number[], action: "delete" | "done" | "undone") =>
    request<{ data: Task[]; next: Task[]; deleted: number[] }>("/api/v1/admin/tasks/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),

  whatsapp: () =>
    request<{ data: WhatsAppSettings }>("/api/v1/admin/whatsapp").then((r) => r.data),

  updateWhatsAppRecipient: (recipient: string) =>
    request<{ data: { recipient: string } }>("/api/v1/admin/whatsapp/recipient", {
      method: "PUT",
      body: JSON.stringify({ recipient }),
    }).then((r) => r.data.recipient),

  /** Saves the wording and sends it to Meta, which reviews it again. */
  updateReminderTemplate: (key: ReminderTemplate["key"], body: string) =>
    request<{ data: WhatsAppSettings }>(`/api/v1/admin/whatsapp/templates/${key}`, {
      method: "PUT",
      body: JSON.stringify({ body }),
    }).then((r) => r.data),

  createMissingReminderTemplates: () =>
    request<{ data: WhatsAppSettings }>("/api/v1/admin/whatsapp/templates/create-missing", {
      method: "POST",
    }).then((r) => r.data),

  /** Sends a sample reminder to the reminder number. */
  testWhatsApp: () =>
    request<{ data: { template: string; to: string } }>("/api/v1/admin/whatsapp/test", {
      method: "POST",
    }).then((r) => r.data),

  /** An issued invoice, sent to the client on WhatsApp with its PDF. */
  sendInvoiceWhatsApp: (documentId: number, to?: string) =>
    request<{ data: { sent_to: string } }>(`/api/v1/admin/documents/${documentId}/whatsapp`, {
      method: "POST",
      body: JSON.stringify({ to: to || null }),
    }).then((r) => r.data),

  /** Logins as a protected PDF on WhatsApp; the password comes back here. */
  sendCredentialsWhatsApp: (clientId: number, ids: number[], to?: string) =>
    request<{ data: { sent_to: string; count: number; password: string } }>(
      `/api/v1/admin/clients/${clientId}/credentials/whatsapp`,
      { method: "POST", body: JSON.stringify({ ids, to: to || null }) },
    ).then((r) => r.data),

  removeTask: (id: number) => request(`/api/v1/admin/tasks/${id}`, { method: "DELETE" }),

  removeAttachment: (id: number) =>
    request(`/api/v1/admin/attachments/${id}`, { method: "DELETE" }),

  /** Followed as links, so they go to the session-backed web routes. */
  attachmentDownload: (id: number) => `${API}/attachments/${id}/download`,
  attachmentPreview: (id: number) => `${API}/attachments/${id}/preview`,

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
