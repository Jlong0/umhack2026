/**
 * MockGovPortalPage — Simulates Malaysian government portals (FWCMS, MyEG, JIM)
 * with autofill from agent-extracted data.
 *
 * Split-screen:
 *  - Left: Mock government form (IMM.47) with empty fields
 *  - Right: Worker data panel + autofill controls
 */

import { useState, useEffect, useRef } from "react";
import { Building2, Zap, Send, CheckCircle2, ChevronDown, User, FileText, Loader2 } from "lucide-react";

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001").replace(/\/+$/, "");

const EMPTY_FORM = {
  imm47_worker_name: "",
  imm47_passport_no: "",
  imm47_nationality: "",
  imm47_sector: "",
  imm47_salary_rm: "",
  imm47_permit_expiry: "",
  imm47_employer: "",
  imm47_roc_number: "",
  imm47_fomema_status: "",
};

const FIELD_LABELS = {
  imm47_worker_name: "Worker Full Name (as per passport)",
  imm47_passport_no: "Passport Number",
  imm47_nationality: "Nationality",
  imm47_sector: "Employment Sector",
  imm47_salary_rm: "Monthly Salary (RM)",
  imm47_permit_expiry: "Current Permit Expiry",
  imm47_employer: "Employer / Company Name",
  imm47_roc_number: "ROC Number",
  imm47_fomema_status: "FOMEMA Status",
};

export default function MockGovPortalPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [agentData, setAgentData] = useState(null);
  const [filling, setFilling] = useState(false);
  const [filledFields, setFilledFields] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const fieldRefs = useRef({});

  // Fetch available workers
  useEffect(() => {
    fetch(`${API}/mock-gov/workers`)
      .then((r) => r.json())
      .then((d) => { setWorkers(d.workers || []); setLoadingWorkers(false); })
      .catch(() => setLoadingWorkers(false));
  }, []);

  // Reset when worker changes
  useEffect(() => {
    setForm({ ...EMPTY_FORM });
    setAgentData(null);
    setFilledFields(new Set());
    setReceipt(null);
  }, [selectedWorker]);

  // Fetch agent data for selected worker
  const fetchAgentData = async () => {
    if (!selectedWorker) return;
    try {
      const r = await fetch(`${API}/mock-gov/fwcms/worker/${selectedWorker}`);
      const data = await r.json();
      setAgentData(data);
    } catch {
      setAgentData(null);
    }
  };

  useEffect(() => {
    if (selectedWorker) fetchAgentData();
  }, [selectedWorker]);

  // Autofill animation
  const handleAutofill = async () => {
    if (!agentData?.form_fields) return;
    setFilling(true);
    setFilledFields(new Set());

    const fields = Object.entries(agentData.form_fields).filter(([, v]) => v != null && v !== "");

    for (let i = 0; i < fields.length; i++) {
      const [key, value] = fields[i];
      await new Promise((resolve) => setTimeout(resolve, 200));
      setForm((prev) => ({ ...prev, [key]: String(value) }));
      setFilledFields((prev) => new Set([...prev, key]));

      // Scroll field into view
      if (fieldRefs.current[key]) {
        fieldRefs.current[key].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    setFilling(false);
  };

  // Submit form
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/mock-gov/fwcms/submit-imm47`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_name: form.imm47_worker_name,
          passport_number: form.imm47_passport_no,
          nationality: form.imm47_nationality,
          sector: form.imm47_sector,
          permit_class: "PLKS",
          salary_rm: parseFloat(form.imm47_salary_rm) || null,
          employer_name: form.imm47_employer,
          permit_expiry: form.imm47_permit_expiry,
        }),
      });
      const data = await r.json();
      setReceipt(data);
    } catch (e) {
      setReceipt({ status: "error", message: e.message });
    }
    setSubmitting(false);
  };

  const allFilled = Object.values(form).every((v) => v !== "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <Building2 className="h-7 w-7 text-blue-400" />
          Mock Government Portal
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Simulated FWCMS portal — demonstrates AI-powered autofill from agent-extracted data
        </p>
      </div>

      {/* Worker Selector */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <label className="text-xs font-medium text-gray-400 mb-2 block">Select Worker for Demo</label>
        <div className="relative">
          <select
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">— Select a worker —</option>
            {workers.map((w) => (
              <option key={w.worker_id} value={w.worker_id}>
                {w.full_name} ({w.passport_number}) — {w.nationality}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReceipt(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              {receipt.status === "accepted" ? (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-100">Submission Accepted</h3>
                  <p className="text-sm text-gray-400 mt-1">{receipt.message}</p>
                  <div className="mt-4 rounded-lg bg-gray-800 p-4">
                    <div className="text-xs text-gray-500">Receipt ID</div>
                    <div className="text-lg font-mono font-bold text-emerald-400 mt-1">{receipt.receipt_id}</div>
                    <div className="text-xs text-gray-500 mt-2">Processing Time</div>
                    <div className="text-sm text-gray-300">{receipt.estimated_processing}</div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                    ⚠️ Simulated — not a real submission
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-red-400">Submission Failed</h3>
                  <p className="text-sm text-gray-400 mt-1">{receipt.message}</p>
                </>
              )}
              <button
                onClick={() => setReceipt(null)}
                className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWorker && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Mock Government Form */}
          <div className="rounded-xl border border-blue-800/40 bg-gradient-to-b from-blue-950/30 to-gray-900/50 overflow-hidden">
            {/* Gov Header */}
            <div className="bg-blue-900/60 border-b border-blue-800/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-800 text-lg">🏛️</div>
                <div>
                  <div className="text-xs text-blue-300 font-medium tracking-wide">JABATAN IMIGRESEN MALAYSIA</div>
                  <div className="text-sm font-bold text-blue-100">FWCMS — IMM.47 Visa Application</div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  ref={(el) => (fieldRefs.current[key] = el)}
                  className={`transition-all duration-500 ${
                    filledFields.has(key)
                      ? "ring-2 ring-emerald-500/50 rounded-lg bg-emerald-500/5"
                      : ""
                  }`}
                >
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    {label}
                    {filledFields.has(key) && (
                      <span className="ml-2 text-emerald-400 text-[10px]">✓ AI-filled</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-all ${
                      filledFields.has(key)
                        ? "border-emerald-600 bg-emerald-900/20 text-emerald-200"
                        : "border-gray-700 bg-gray-800 text-gray-200"
                    } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  />
                </div>
              ))}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!allFilled || submitting}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting to FWCMS..." : "Submit IMM.47 Application"}
              </button>
            </div>
          </div>

          {/* RIGHT: Agent Data Panel */}
          <div className="space-y-4">
            {/* Agent Data Card */}
            <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-6">
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-4">
                <User className="h-4 w-4" />
                Agent-Extracted Data
              </h3>

              {agentData ? (
                <div className="space-y-3">
                  {Object.entries(agentData.form_fields || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-gray-800/60 px-3 py-2">
                      <span className="text-xs text-gray-400">{FIELD_LABELS[key] || key}</span>
                      <span className={`text-xs font-mono ${value ? "text-indigo-300" : "text-gray-600"}`}>
                        {value != null ? String(value) : "—"}
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] text-indigo-400 w-fit">
                    <FileText className="h-3 w-3" />
                    Source: PermitIQ Agent Pipeline
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-gray-600">
                  Loading agent data...
                </div>
              )}
            </div>

            {/* Autofill Button */}
            <button
              onClick={handleAutofill}
              disabled={!agentData || filling}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-sm font-bold text-white transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {filling ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Autofilling form fields...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  ⚡ Autofill from Agent Data
                </>
              )}
            </button>

            {/* How it works */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">How This Works</h4>
              <ol className="space-y-2 text-xs text-gray-500">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400">1</span>
                  Agent pipeline extracts worker data from uploaded documents
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400">2</span>
                  Validated data is stored in Firebase Firestore
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400">3</span>
                  Click "Autofill" to populate government form fields automatically
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400">4</span>
                  Submit to simulated FWCMS portal and receive mock receipt
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {!selectedWorker && !loadingWorkers && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-800 p-20 text-center">
          <div>
            <Building2 className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <p className="text-sm text-gray-500">Select a worker above to begin the autofill demo</p>
            <p className="text-xs text-gray-600 mt-1">Data is fetched from the PermitIQ agent pipeline via Firebase</p>
          </div>
        </div>
      )}
    </div>
  );
}
