/**
 * WorkerVisaLetterPage — Worker portal page for receiving and acknowledging
 * the FWCMS IMM.47 visa approval letter from the Mock Government Portal.
 *
 * When the worker's employer gets JTKSM approved, the system auto-generates
 * a visa letter. The worker sees it here and must acknowledge receipt,
 * which auto-advances them to the TRANSIT stage.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Download, CheckCircle2, Clock, Plane, Loader2, Mail } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { getVisaLetter, acknowledgeVisa } from "@/services/api";
import { cn } from "@/lib/utils";

export default function WorkerVisaLetterPage() {
  const user = useAuthStore((s) => s.user);
  const workerId = user?.id;
  const queryClient = useQueryClient();
  const [acknowledging, setAcknowledging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["visaLetter", workerId],
    queryFn: () => getVisaLetter(workerId),
    enabled: !!workerId,
    refetchInterval: 10000,
  });

  const letter = data?.letter;
  const hasLetter = data?.status === "found" && letter;
  const isAcknowledged = letter?.acknowledged;

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await acknowledgeVisa(workerId);
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["visaLetter", workerId] });
    } catch (err) {
      console.error("Failed to acknowledge:", err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (!workerId) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Please log in to view your visa letter.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Success animation after acknowledging
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 mb-6">
          <Plane className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">You're on your way! ✈️</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Your visa acknowledgement has been recorded. Your status has been updated to <strong>Transit</strong>.
          Your employer will confirm your arrival.
        </p>
        <button
          onClick={() => setShowSuccess(false)}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          View Letter Again
        </button>
      </div>
    );
  }

  // No letter yet
  if (!hasLetter) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Visa Approval Letter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your FWCMS IMM.47 visa approval letter will appear here once issued.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Waiting for visa letter…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your employer is processing your JTKSM approval. The visa letter will be sent here automatically.
          </p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking every 10 seconds
          </div>
        </div>
      </div>
    );
  }

  // Letter found — show it
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Visa Approval Letter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your FWCMS IMM.47 visa application letter
        </p>
      </div>

      {/* Official letter card */}
      <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white dark:border-blue-800 dark:from-blue-950/40 dark:to-card">
        {/* Header bar */}
        <div className="bg-blue-900 px-6 py-4 dark:bg-blue-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-800 text-lg">🏛️</div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-blue-300">
                Jabatan Imigresen Malaysia
              </p>
              <p className="text-sm font-bold text-blue-100">
                FWCMS — IMM.47 Visa Application Approval
              </p>
            </div>
          </div>
        </div>

        {/* Letter body */}
        <div className="p-6 space-y-5">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <div className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              isAcknowledged
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
            )}>
              {isAcknowledged ? (
                <><CheckCircle2 className="h-3 w-3" /> Acknowledged</>
              ) : (
                <><Mail className="h-3 w-3" /> Pending Acknowledgement</>
              )}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{letter.receipt_id}</span>
          </div>

          {/* Letter fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Worker Name", value: letter.worker_name },
              { label: "Passport Number", value: letter.passport_number },
              { label: "Nationality", value: letter.nationality },
              { label: "Sector", value: letter.sector },
              { label: "Employer", value: letter.employer_name },
              { label: "ROC Number", value: letter.roc_number },
              { label: "Permit Class", value: letter.permit_class },
              { label: "Salary (RM)", value: letter.salary_rm },
              { label: "Permit Expiry", value: letter.permit_expiry },
              { label: "Issued At", value: letter.issued_at ? new Date(letter.issued_at).toLocaleString() : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/60 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{value || "—"}</p>
              </div>
            ))}
          </div>

          {/* Official message */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <p className="text-sm text-blue-900 dark:text-blue-200">{letter.message}</p>
          </div>

          {/* Simulated notice */}
          <div className="flex items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            ⚠️ Simulated government document — not a real visa approval
          </div>

          {/* Acknowledge button */}
          {!isAcknowledged && (
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-sm font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
            >
              {acknowledging ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
              ) : (
                <><FileCheck2 className="h-5 w-5" /> Acknowledge Receipt & Proceed to Transit</>
              )}
            </button>
          )}

          {isAcknowledged && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Receipt acknowledged
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {letter.acknowledged_at ? new Date(letter.acknowledged_at).toLocaleString() : ""}
                  {" · "}Your status has been updated to Transit
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
