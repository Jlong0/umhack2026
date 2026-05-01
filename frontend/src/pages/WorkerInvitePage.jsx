import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Send, Copy, Check, KeyRound, Mail, Phone, User,
  RefreshCw, AlertCircle, Sparkles,
} from "lucide-react";
import { listWorkers, inviteWorker, assignAllLoginCodes, updateWorkerContact } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

// ── helpers ──────────────────────────────────────────────────────────────────

function workerDisplayName(w) {
  return w.full_name || w.passport?.full_name || w.name || w.worker_id;
}

function buildWhatsAppUrl(whatsapp, name, workerId, loginCode) {
  const phone = whatsapp.replace(/[^0-9]/g, "");
  const message =
    `Hello ${name}!\n\n` +
    `Your PermitIQ Worker Portal login credentials:\n` +
    `• Worker ID: ${workerId}\n` +
    `• Login Code: ${loginCode}\n\n` +
    `Log in at: ${window.location.origin}/login/worker\n\n` +
    `Keep these details safe. Do not share with anyone.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={`Copy ${label || text}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── WhatsApp inline editor ────────────────────────────────────────────────────

function WhatsAppEditor({ workerId, onSaved }) {
  const qc = useQueryClient();
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    const trimmed = val.trim();
    if (!trimmed) { setErr("Enter a number"); return; }
    setSaving(true);
    setErr("");
    try {
      await updateWorkerContact(workerId, { whatsapp: trimmed });
      qc.invalidateQueries({ queryKey: ["workers-invite-list"] });
      onSaved?.();
    } catch {
      setErr("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="+601XXXXXXXX"
          className="w-36 rounded border border-border px-2 py-1 text-xs text-foreground focus:border-indigo-400 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
      {err && <p className="text-xs text-rose-500">{err}</p>}
    </div>
  );
}

// ── Single worker row ─────────────────────────────────────────────────────────

function WorkerRow({ worker, onAssignCode }) {
  const [editingWA, setEditingWA] = useState(false);
  const qc = useQueryClient();

  const name = workerDisplayName(worker);
  const hasCode = !!worker.login_code;
  const hasWA = !!worker.whatsapp;
  const canSend = hasCode && hasWA;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/60 transition">
      {/* Name + ID */}
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">{worker.worker_id}</span>
          <CopyButton text={worker.worker_id} label="Worker ID" />
        </div>
      </td>

      {/* Login code */}
      <td className="px-4 py-3">
        {hasCode ? (
          <div className="flex items-center gap-1">
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-medium text-foreground">
              {worker.login_code}
            </span>
            <CopyButton text={worker.login_code} label="Login Code" />
          </div>
        ) : (
          <button
            onClick={() => onAssignCode(worker.worker_id)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
          >
            <Sparkles className="h-3 w-3" />
            Assign code
          </button>
        )}
      </td>

      {/* WhatsApp */}
      <td className="px-4 py-3">
        {hasWA && !editingWA ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{worker.whatsapp}</span>
            <button
              onClick={() => setEditingWA(true)}
              className="rounded px-1 text-xs text-muted-foreground hover:text-indigo-600 transition"
              title="Edit"
            >
              ✎
            </button>
          </div>
        ) : editingWA ? (
          <WhatsAppEditor
            workerId={worker.worker_id}
            onSaved={() => setEditingWA(false)}
          />
        ) : (
          <WhatsAppEditor workerId={worker.worker_id} />
        )}
      </td>

      {/* Email */}
      <td className="px-4 py-3 text-sm text-muted-foreground">{worker.email || "—"}</td>

      {/* Send action */}
      <td className="px-4 py-3">
        {canSend ? (
          <a
            href={buildWhatsAppUrl(worker.whatsapp, name, worker.worker_id, worker.login_code)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            <Send className="h-3 w-3" />
            Send via WhatsApp
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            {!hasCode ? "Need login code" : "Need WhatsApp no."}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerInvitePage() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const qc = useQueryClient();

  const [form, setForm] = useState({ name: "", email: "", whatsapp: "" });
  const [justAdded, setJustAdded] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workers-invite-list"],
    queryFn: listWorkers,
    refetchInterval: 15000,
  });

  const workers = (data?.workers || [])
    .filter((w) => !selectedCompanyId || w.company_id === selectedCompanyId)
    .sort((a, b) => (a.worker_id || "").localeCompare(b.worker_id || ""));

  const withCode = workers.filter((w) => w.login_code).length;
  const withoutCode = workers.length - withCode;

  // ── Add new worker ──
  const addMutation = useMutation({
    mutationFn: inviteWorker,
    onSuccess: (result) => {
      setJustAdded(result);
      setForm({ name: "", email: "", whatsapp: "" });
      qc.invalidateQueries({ queryKey: ["workers-invite-list"] });
    },
  });

  // ── Bulk assign codes ──
  const bulkMutation = useMutation({
    mutationFn: assignAllLoginCodes,
    onSuccess: (result) => {
      setBulkResult(result);
      qc.invalidateQueries({ queryKey: ["workers-invite-list"] });
    },
  });

  // ── Assign code to single worker (via bulk endpoint, idempotent) ──
  const handleAssignSingle = async (targetWorkerId) => {
    await bulkMutation.mutateAsync();
    qc.invalidateQueries({ queryKey: ["workers-invite-list"] });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, email, whatsapp } = form;
    if (!name.trim() || !email.trim() || !whatsapp.trim()) return;
    addMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      company_id: selectedCompanyId || "demo-company",
    });
  };

  const inputFields = [
    { key: "name", label: "Full Name", placeholder: "Ahmad Bin Razali", icon: User },
    { key: "email", label: "Email", placeholder: "ahmad@example.com", type: "email", icon: Mail },
    { key: "whatsapp", label: "WhatsApp Number", placeholder: "+60123456789", icon: Phone },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invite Workers"
        description="Add workers and send their login credentials via WhatsApp."
        actions={
          withoutCode > 0 && (
            <Button
              variant="outline"
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${bulkMutation.isPending ? "animate-spin" : ""}`} />
              {bulkMutation.isPending ? "Assigning…" : `Assign codes to ${withoutCode} worker${withoutCode > 1 ? "s" : ""}`}
            </Button>
          )
        }
      />

      {/* Bulk result banner */}
      {bulkResult && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">{bulkResult.assigned}</span> workers received new login codes.{" "}
            <span className="text-emerald-600">{bulkResult.already_had_code} already had codes.</span>
          </p>
          <button onClick={() => setBulkResult(null)} className="text-xs text-emerald-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add worker form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="h-4 w-4 text-indigo-600" />
          Add New Worker
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          {inputFields.map(({ key, label, placeholder, type = "text", icon: Icon }) => (
            <div key={key}>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
              <div className="relative">
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40"
                />
              </div>
            </div>
          ))}

          <div className="flex items-end sm:col-span-3">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
            >
              <UserPlus className="h-4 w-4" />
              {addMutation.isPending ? "Adding…" : "Add Worker & Generate Credentials"}
            </button>
          </div>
        </form>

        {addMutation.isError && (
          <p className="mt-3 text-sm text-rose-600">
            Failed to add worker. {addMutation.error?.message}
          </p>
        )}
      </div>

      {/* Flash card after add */}
      {justAdded && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Worker added — credentials generated
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Share these with <strong>{justAdded.name}</strong>:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-foreground">
                  Worker ID:&nbsp;
                  <span className="font-mono font-semibold">{justAdded.worker_id}</span>
                  <CopyButton text={justAdded.worker_id} label="Worker ID" />
                </span>
                <span className="flex items-center gap-1 text-foreground">
                  Login Code:&nbsp;
                  <span className="font-mono font-semibold">{justAdded.login_code}</span>
                  <CopyButton text={justAdded.login_code} label="Login Code" />
                </span>
              </div>
            </div>
            {justAdded.whatsapp && (
              <a
                href={buildWhatsAppUrl(
                  justAdded.whatsapp,
                  justAdded.name,
                  justAdded.worker_id,
                  justAdded.login_code,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
              >
                <Send className="h-4 w-4" />
                Send via WhatsApp
              </a>
            )}
          </div>
          <button
            onClick={() => setJustAdded(null)}
            className="mt-3 text-xs text-emerald-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* All workers credentials table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            All Worker Credentials
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
              {withCode} with code
            </span>
            {withoutCode > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">
                {withoutCode} without code
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UserPlus}
              title="No workers found"
              description="Add a worker above to get started."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Login Code</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <WorkerRow
                    key={w.worker_id}
                    worker={w}
                    onAssignCode={handleAssignSingle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
