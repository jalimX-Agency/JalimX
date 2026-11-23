"use client";

import { useEffect, useState } from "react";

import { useAdminUser } from "@/app/admin/(panel)/layout";
import { useConfirm } from "@/components/admin/confirm";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  isSignedOut,
  type InviteResult,
  type PermissionGroup,
  type TeamMember,
  type TeamRole,
} from "@/lib/admin/client";

/**
 * Who can sign in, and what each of them can do.
 *
 * Roles are built here from the list of permissions, then given to people.
 * Someone joins through a one-time invite link and chooses their own
 * password; nobody's password is ever set or seen from this page. The API
 * enforces every permission on its own, so what a role cannot do here it
 * cannot do by any other route either.
 */

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

const STATUS: Record<TeamMember["status"], { label: string; tone: string }> = {
  active: { label: "Active", tone: "text-[var(--link)] border-[color-mix(in_oklab,var(--link)_40%,transparent)]" },
  invited: { label: "Invited", tone: "text-[var(--fg-dim)] border-[var(--hairline)]" },
  disabled: { label: "Switched off", tone: "text-[var(--color-signal)] border-[color-mix(in_oklab,var(--color-signal)_40%,transparent)]" },
};

export default function TeamPage() {
  const me = useAdminUser();
  const toast = useToast();
  const ask = useConfirm();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<InviteResult | null>(null);
  const [editing, setEditing] = useState<TeamRole | "new" | null>(null);

  const iAmOwner = !!me?.roles?.includes("owner");

  useEffect(() => {
    let live = true;
    admin.team().then(
      (t) => {
        if (!live) return;
        setMembers(t.members);
        setRoles(t.roles);
        setCatalog(t.permissions);
        setClients(t.clients);
      },
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const replace = (m: TeamMember) => setMembers((list) => (list ?? []).map((x) => (x.id === m.id ? m : x)));
  const refreshRoles = () => admin.team().then((t) => setRoles(t.roles));

  async function changeRole(m: TeamMember, role: string) {
    try {
      replace(await admin.updateMember(m.id, { role }));
      refreshRoles();
      toast.success(`${m.name} is now ${role}.`);
    } catch (e) {
      toast.error(e, "Could not change the role.");
    }
  }

  async function saveClients(m: TeamMember, ids: number[]) {
    try {
      replace(await admin.updateMember(m.id, { client_ids: ids }));
      setPicking(null);
      toast.success(`${m.name} now works on ${ids.length} ${ids.length === 1 ? "client" : "clients"}.`);
    } catch (e) {
      toast.error(e, "Could not save the clients.");
    }
  }

  async function toggleActive(m: TeamMember) {
    const off = m.status !== "disabled";
    if (
      off &&
      !(await ask({
        title: `Switch off ${m.name}?`,
        body: "They are signed out everywhere and cannot sign in again until you switch them back on. Nothing they did is deleted.",
        confirmLabel: "Switch off",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      replace(await admin.updateMember(m.id, { is_active: !off }));
      toast.success(off ? `${m.name} is switched off.` : `${m.name} can sign in again.`);
    } catch (e) {
      toast.error(e, "Could not change it.");
    }
  }

  async function resend(m: TeamMember) {
    try {
      const r = await admin.resendInvite(m.id);
      replace(r.member);
      setInvited(r);
      toast.success(r.emailed ? `A new link was sent to ${m.email}.` : "New link ready. Send it yourself.");
    } catch (e) {
      toast.error(e, "Could not make a new link.");
    }
  }

  async function remove(m: TeamMember) {
    if (
      !(await ask({
        title: `Cancel the invite for ${m.name}?`,
        body: "The link stops working and they are removed from the list.",
        confirmLabel: "Cancel invite",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await admin.removeMember(m.id);
      setMembers((list) => (list ?? []).filter((x) => x.id !== m.id));
      refreshRoles();
      toast.success("Invite cancelled.");
    } catch (e) {
      toast.error(e, "Could not cancel it.");
    }
  }

  if (error) return <p role="alert" className="text-sm text-[var(--color-signal)]">{error}</p>;
  if (!members) return <p className="text-sm text-[var(--fg-faint)]">Loading the team…</p>;

  const assignable = roles.filter((r) => !r.locked || iAmOwner);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[var(--fg-dim)]">
          Invite people, build roles from what they need to do, and switch someone off when they leave.
          Each person chooses their own password from the invite link.
        </p>
      </header>

      {/* ---- People ---- */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <header className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
          <h2 className="text-sm font-semibold">People</h2>
          <p className="text-xs text-[var(--fg-faint)]">{members.length} {members.length === 1 ? "person" : "people"}</p>
        </header>
        <ul>
          {members.map((m) => {
            const status = STATUS[m.status];
            const lockedOwner = m.role === "owner" && !iAmOwner;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--hairline)] px-5 py-4 last:border-b-0">
                <div className="min-w-[14rem] flex-1">
                  <p className="text-sm font-medium">
                    {m.name} {m.is_you && <span className="font-normal text-[var(--fg-faint)]">(you)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--fg-dim)]">{m.email}</p>
                  {!m.sees_all_clients && (
                    <button
                      type="button"
                      onClick={() => setPicking(picking === m.id ? null : m.id)}
                      className="mt-1.5 text-xs text-[var(--link)] hover:underline"
                    >
                      {m.client_ids.length === 0
                        ? "No clients yet. Choose their clients"
                        : `${m.client_ids.length} ${m.client_ids.length === 1 ? "client" : "clients"}: ${clients
                            .filter((c) => m.client_ids.includes(c.id))
                            .map((c) => c.name)
                            .slice(0, 3)
                            .join(", ")}${m.client_ids.length > 3 ? "…" : ""}`}
                    </button>
                  )}
                  <p className="mt-1 text-xs text-[var(--fg-faint)]">
                    {m.status === "invited"
                      ? `Link valid until ${date(m.invite_expires_at) ?? "—"}`
                      : m.last_login_at
                        ? `Last signed in ${date(m.last_login_at)}`
                        : "Never signed in"}
                  </p>
                </div>

                <span className={`border px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>

                <select
                  value={m.role ?? ""}
                  disabled={m.is_you || lockedOwner}
                  onChange={(e) => changeRole(m, e.target.value)}
                  aria-label={`Role of ${m.name}`}
                  className="border border-[var(--hairline)] bg-transparent px-2 py-1.5 text-sm disabled:opacity-60"
                >
                  {!m.role && <option value="">No role</option>}
                  {(lockedOwner ? roles : assignable).map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-4 text-xs">
                  {m.status === "invited" && (
                    <>
                      <button type="button" onClick={() => resend(m)} className="text-[var(--link)] hover:underline">
                        New link
                      </button>
                      <button type="button" onClick={() => remove(m)} className="text-[var(--fg-dim)] hover:text-[var(--color-signal)]">
                        Cancel invite
                      </button>
                    </>
                  )}
                  {m.status !== "invited" && !m.is_you && !lockedOwner && (
                    <button
                      type="button"
                      onClick={() => toggleActive(m)}
                      className={m.status === "disabled" ? "text-[var(--link)] hover:underline" : "text-[var(--fg-dim)] hover:text-[var(--color-signal)]"}
                    >
                      {m.status === "disabled" ? "Switch back on" : "Switch off"}
                    </button>
                  )}
                </div>
                {picking === m.id && (
                  <ClientPicker
                    clients={clients}
                    initial={m.client_ids}
                    onCancel={() => setPicking(null)}
                    onSave={(ids) => saveClients(m, ids)}
                  />
                )}
              </li>
            );
          })}
        </ul>

        <InviteForm
          roles={assignable}
          clients={clients}
          onInvited={(r) => {
            setMembers((list) => [...(list ?? []), r.member]);
            setInvited(r);
            refreshRoles();
          }}
        />
      </section>

      {invited && <InviteLink result={invited} onClose={() => setInvited(null)} />}

      {/* ---- Roles ---- */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <header className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
          <h2 className="text-sm font-semibold">Roles</h2>
          <button
            type="button"
            onClick={() => setEditing(editing === "new" ? null : "new")}
            className="text-xs font-medium text-[var(--link)] hover:underline"
          >
            {editing === "new" ? "Cancel" : "+ New role"}
          </button>
        </header>

        {editing === "new" && (
          <RoleEditor
            catalog={catalog}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              setRoles(await admin.createRole(input));
              setEditing(null);
              toast.success(`Role “${input.name}” created.`);
            }}
          />
        )}

        <ul>
          {roles.map((r) => (
            <li key={r.id} className="border-t border-[var(--hairline)] first:border-t-0">
              {editing !== "new" && editing?.id === r.id ? (
                <RoleEditor
                  role={r}
                  catalog={catalog}
                  onCancel={() => setEditing(null)}
                  onSave={async (input) => {
                    setRoles(await admin.updateRole(r.id, input));
                    setEditing(null);
                    toast.success(`Role “${input.name}” saved.`);
                  }}
                  onDelete={async () => {
                    setRoles(await admin.deleteRole(r.id));
                    setEditing(null);
                    toast.success(`Role “${r.name}” deleted.`);
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium capitalize">{r.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--fg-faint)]">
                      {r.locked
                        ? "Every permission, always. Cannot be changed."
                        : `${r.permissions.length} ${r.permissions.length === 1 ? "permission" : "permissions"}`}
                      {" · "}
                      {r.client_scope === "assigned" ? "Assigned clients only" : "Every client"}
                      {" · "}
                      {r.members} {r.members === 1 ? "person" : "people"}
                    </p>
                  </div>
                  {!r.locked && (
                    <button type="button" onClick={() => setEditing(r)} className="text-xs text-[var(--link)] hover:underline">
                      Edit
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InviteForm({
  roles,
  clients,
  onInvited,
}: {
  roles: TeamRole[];
  clients: { id: number; name: string }[];
  onInvited: (r: InviteResult) => void;
}) {
  const toast = useToast();
  const choosable = roles.filter((r) => !r.locked);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const chosen = role || choosable[0]?.name || roles[0]?.name || "";
  const limited = roles.find((r) => r.name === chosen)?.client_scope === "assigned";
  const [clientIds, setClientIds] = useState<number[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await admin.inviteMember({
        name: name.trim(),
        email: email.trim(),
        role: chosen,
        client_ids: limited ? clientIds : [],
      });
      setClientIds([]);
      onInvited(r);
      setName("");
      setEmail("");
      toast.success(r.emailed ? `Invite sent to ${r.member.email}.` : "Invite ready. The email did not go: send the link yourself.");
    } catch (err) {
      const fields = (err as { errors?: Record<string, string[]> }).errors;
      if (fields) setErrors(fields);
      toast.error(err, "Could not send the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--fg)_2%,transparent)] px-5 py-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <label className="flex flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none" />
        {errors.name && <span className="text-[var(--color-signal)]">{errors.name[0]}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={190} className="border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none" />
        {errors.email && <span className="text-[var(--color-signal)]">{errors.email[0]}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
        Role
        <select value={chosen} onChange={(e) => setRole(e.target.value)} className="border border-[var(--hairline)] bg-transparent px-2 py-2 text-sm text-[var(--fg)]">
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy || !chosen} className="bg-[var(--fg)] px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-[var(--ground)] disabled:opacity-40">
        {busy ? "Sending…" : "Send invite"}
      </button>
      {limited && (
        <div className="sm:col-span-4">
          <p className="mb-2 text-xs text-[var(--fg-dim)]">
            This role only sees the clients you choose. Pick theirs now, or later from the list above.
          </p>
          <ClientChecklist clients={clients} picked={clientIds} onChange={setClientIds} />
        </div>
      )}
      {choosable.length === 0 && (
        <p className="text-xs text-[var(--fg-faint)] sm:col-span-4">
          Create a role below first, so the person you invite gets only what they need.
        </p>
      )}
    </form>
  );
}

/** The link, shown after an invite, so it can also go by WhatsApp. */
function InviteLink({ result, onClose }: { result: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-[color-mix(in_oklab,var(--link)_40%,transparent)] bg-[color-mix(in_oklab,var(--link)_6%,transparent)] px-5 py-4">
      <p className="text-sm font-medium">
        {result.emailed ? `Invite emailed to ${result.member.email}.` : `The email to ${result.member.email} did not go.`}
      </p>
      {!result.emailed && result.email_error && <p className="mt-1 text-xs text-[var(--color-signal)]">{result.email_error}</p>}
      <p className="mt-2 text-xs text-[var(--fg-dim)]">You can also send this link yourself, on WhatsApp for example. It works once and for 7 days.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="max-w-full overflow-x-auto break-all border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-xs">{result.invite_url}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(result.invite_url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs font-medium text-[var(--link)] hover:underline"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={onClose} className="ml-auto text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]">
          Close
        </button>
      </div>
    </div>
  );
}

function RoleEditor({
  role,
  catalog,
  onSave,
  onCancel,
  onDelete,
}: {
  role?: TeamRole;
  catalog: PermissionGroup[];
  onSave: (input: { name: string; permissions: string[]; client_scope: "all" | "assigned" }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const toast = useToast();
  const ask = useConfirm();
  const [name, setName] = useState(role?.name ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [scope, setScope] = useState<"all" | "assigned">(role?.client_scope ?? "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (perm: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });

  const toggleGroup = (g: PermissionGroup) =>
    setPicked((s) => {
      const next = new Set(s);
      const all = g.items.every((i) => next.has(i.name));
      for (const i of g.items) {
        if (all) next.delete(i.name);
        else next.add(i.name);
      }
      return next;
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), permissions: [...picked], client_scope: scope });
    } catch (e) {
      const fields = (e as { errors?: Record<string, string[]> }).errors;
      setError(fields?.name?.[0] ?? (e as Error).message);
      toast.error(e, "Could not save the role.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    if (
      !(await ask({
        title: `Delete the role “${role?.name}”?`,
        body: "Only possible when nobody has it.",
        confirmLabel: "Delete role",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await onDelete();
    } catch (e) {
      toast.error(e, "Could not delete the role.");
    }
  }

  return (
    <div className="flex flex-col gap-5 border-t border-[var(--hairline)] px-5 py-5 first:border-t-0">
      <label className="flex max-w-sm flex-col gap-1.5 text-xs text-[var(--fg-dim)]">
        Role name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Developer, Designer, Accountant"
          className="border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
        />
        {error && <span className="text-[var(--color-signal)]">{error}</span>}
      </label>

      <fieldset className="border border-[var(--hairline)] px-4 py-3">
        <legend className="px-1 text-sm font-semibold">Which clients</legend>
        <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:gap-8">
          {(
            [
              ["all", "Every client", "Sees all clients, and everything about them the permissions below allow."],
              ["assigned", "Only their clients", "Sees only the clients you assign to each person: their work, invoices, logins, tasks and WhatsApp conversations."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex flex-1 cursor-pointer items-start gap-2.5">
              <input type="radio" name="client-scope" checked={scope === value} onChange={() => setScope(value)} className="mt-1" />
              <span>
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-[var(--fg-faint)]">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        {catalog.map((g) => {
          const all = g.items.every((i) => picked.has(i.name));
          return (
            <fieldset key={g.key} className="border border-[var(--hairline)] px-4 py-3">
              <legend className="flex items-center gap-3 px-1 text-sm font-semibold">
                {g.label}
                <button type="button" onClick={() => toggleGroup(g)} className="text-xs font-normal text-[var(--link)] hover:underline">
                  {all ? "None" : "All"}
                </button>
              </legend>
              <div className="mt-1 flex flex-col gap-2.5">
                {g.items.map((item) => (
                  <label key={item.name} className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={picked.has(item.name)} onChange={() => toggle(item.name)} className="mt-1" />
                    <span>
                      <span className="block text-sm">{item.label}</span>
                      <span className="block text-xs text-[var(--fg-faint)]">{item.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {onDelete ? (
          <button type="button" onClick={remove} className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]">
            Delete role
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="bg-[var(--fg)] px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-[var(--ground)] disabled:opacity-40"
          >
            {busy ? "Saving…" : `Save · ${picked.size} ${picked.size === 1 ? "permission" : "permissions"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Checkboxes for clients, with a search once the list is long. */
function ClientChecklist({
  clients,
  picked,
  onChange,
}: {
  clients: { id: number; name: string }[];
  picked: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState("");
  const shown = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: number) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  if (clients.length === 0) return <p className="text-xs text-[var(--fg-faint)]">No clients yet.</p>;

  return (
    <div>
      {clients.length > 8 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients"
          aria-label="Search clients"
          className="mb-2 w-full max-w-xs border border-[var(--hairline)] bg-transparent px-3 py-1.5 text-sm outline-none"
        />
      )}
      <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
            <span className="truncate">{c.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ClientPicker({
  clients,
  initial,
  onSave,
  onCancel,
}: {
  clients: { id: number; name: string }[];
  initial: number[];
  onSave: (ids: number[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<number[]>(initial);
  return (
    <div className="w-full border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--fg)_2%,transparent)] px-4 py-3">
      <p className="mb-2 text-xs text-[var(--fg-dim)]">
        The clients this person works on. They see these and nothing else.
      </p>
      <ClientChecklist clients={clients} picked={picked} onChange={setPicked} />
      <div className="mt-3 flex items-center justify-end gap-4">
        <button type="button" onClick={onCancel} className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(picked)}
          className="bg-[var(--fg)] px-4 py-2 text-[0.8125rem] font-medium text-[var(--ground)]"
        >
          Save · {picked.length} {picked.length === 1 ? "client" : "clients"}
        </button>
      </div>
    </div>
  );
}
