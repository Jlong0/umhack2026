import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Send, Copy, Check, KeyRound, Mail, Phone, User } from "lucide-react";
import { listWorkers, inviteWorker } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

function buildWhatsAppUrl(whatsapp, name, workerId, loginCode) {
  const phone = whatsapp.replace(/[^0-9]/g, "");
  const message =
    `Hello ${name}!\n\n` +
    `Your PermitIQ Worker Portal credentials:\n` +
    `• Worker ID: ${workerId}\n` +
    `• Login Code: ${loginCode}\n\n` +
    `Login at: ${window.location.origin}/login/worker`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="rounded p-1 text-slate-400 hover:text-slate-700 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function WorkerCredentialRow({ worker }) {
  const name =
    worker.full_name ||
    worker.passport?.full_name ||
    worker.name ||
    worker.worker_id;

  if (!worker.login_code) return null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">{worker.worker_id}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm text-slate-700">{worker.login_code}</span>
          <CopyButton text={worker.login_code} />
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{worker.email || "—"}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{worker.whatsapp || "—"}</td>
      <td className="px-4 py-3">
        {worker.whatsapp && worker.login_code ? (
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
          <span className="text-xs text-slate-400">No WhatsApp</span>
        )}
      </td>
    </tr>
  );
}

export default function WorkerInvitePage() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const qc = useQueryClient();

  const [form, setForm] = useState({ name: "", email: "", whatsapp: "" });
  const [justAdded, setJustAdded] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workers-invite-list"],
    queryFn: listWorkers,
    refetchInterval: 15000,
  });

  const workers = (data?.workers || []).filter(
    (w) => !selectedCompanyId || w.company_id === selectedCompanyId,
  );

  const mutation = useMutation({
    mutationFn: (payload) => inviteWorker(payload),
    onSuccess: (result) => {
      setJustAdded(result);
      setForm({ name: "", email: "", whatsapp: "" });
      qc.invalidateQueries({ queryKey: ["workers-invite-list"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, email, whatsapp } = form;
    if (!name.trim() || !email.trim() || !whatsapp.trim()) return;
    mutation.mutate({
      name: name.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      company_id: selectedCompanyId || "demo-company",
    });
  };

  const fields = [
    { key: "name", label: "Full Name", placeholder: "Ahmad Bin Razali", icon: User },
    { key: "email", label: "Email", placeholder: "ahmad@example.com", type: "email", icon: Mail },
    { key: "whatsapp", label: "WhatsApp Number", placeholder: "+60123456789", icon: Phone },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invite Workers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a worker to generate their login credentials, then send them via WhatsApp.
        </p>
      </div>

      {/* Add worker form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <UserPlus className="h-4 w-4 text-indigo-600" />
          Add New Worker
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          {fields.map(({ key, label, placeholder, type = "text", icon: Icon }) => (
            <div key={key}>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
              <div className="relative">
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40"
                />
              </div>
            </div>
          ))}

          <div className="flex items-end sm:col-span-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
            >
              <UserPlus className="h-4 w-4" />
              {mutation.isPending ? "Adding..." : "Add Worker & Generate Credentials"}
            </button>
          </div>
        </form>

        {mutation.isError && (
          <p className="mt-3 text-sm text-rose-600">
            Failed to add worker. {mutation.error?.message}
          </p>
        )}
      </div>

      {/* Credentials card shown immediately after adding */}
      {justAdded && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Worker added — credentials generated
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Share these with <strong>{justAdded.name}</strong>:
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-slate-700">
                  Worker ID:{" "}
                  <span className="font-mono font-semibold">{justAdded.worker_id}</span>
                  <CopyButton text={justAdded.worker_id} />
                </span>
                <span className="text-slate-700">
                  Login Code:{" "}
                  <span className="font-mono font-semibold">{justAdded.login_code}</span>
                  <CopyButton text={justAdded.login_code} />
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

      {/* Worker credentials table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <KeyRound className="h-4 w-4 text-slate-400" />
            Worker Credentials
          </h2>
          <span className="text-xs text-slate-400">
            {workers.filter((w) => w.login_code).length} workers with credentials
          </span>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : workers.filter((w) => w.login_code).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No workers with credentials yet. Add a worker above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Login Code</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers
                  .filter((w) => w.login_code)
                  .map((w) => (
                    <WorkerCredentialRow key={w.worker_id} worker={w} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
