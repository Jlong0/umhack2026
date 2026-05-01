import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkers } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

const STATUS_COLORS = {
  complete: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  not_started: "bg-muted text-muted-foreground",
};

function phaseStatus(phaseData, validationErrors) {
  if (validationErrors?.length) return "blocked";
  const values = Object.values(phaseData || {});
  if (values.length === 0) return "not_started";
  if (values.every((v) => v !== null && v !== undefined && v !== "")) return "complete";
  if (values.some((v) => v !== null && v !== undefined && v !== "")) return "in_progress";
  return "not_started";
}

function stageStatus(stagePhases, validationErrors) {
  if (validationErrors?.length) return "blocked";
  const statuses = Object.values(stagePhases).map((p) => phaseStatus(p.data));
  if (statuses.every((s) => s === "complete")) return "complete";
  if (statuses.some((s) => s === "in_progress" || s === "complete")) return "in_progress";
  return "not_started";
}

function Badge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.not_started}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function PhaseSection({ label, data }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</h4>
      <div className="space-y-1">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
            <span className={value ? "text-green-600 font-medium" : "text-red-400"}>
              {value ? String(value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
//
// function ReviewQueueDrawer({ workers, onClose, onSelectWorker }) {
//   return (
//     <div className="fixed inset-y-0 right-0 z-50 flex w-[520px] flex-col bg-card shadow-2xl">
//       <div className="flex items-center justify-between border-b px-6 py-4">
//         <div>
//           <h2 className="text-lg font-semibold text-foreground">
//             Review Queue
//           </h2>
//           <p className="text-xs text-muted-foreground">
//             {workers.length} pending submission{workers.length === 1 ? "" : "s"}
//           </p>
//         </div>
//
//         <button
//           onClick={onClose}
//           className="text-xl leading-none text-muted-foreground hover:text-muted-foreground"
//         >
//           &times;
//         </button>
//       </div>
//
//       <div className="flex-1 overflow-y-auto p-4">
//         {workers.length === 0 ? (
//           <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
//             No submissions need review.
//           </p>
//         ) : (
//           <div className="space-y-3">
//             {workers.map((worker) => (
//               <button
//                 key={worker.worker_id}
//                 type="button"
//                 onClick={() => onSelectWorker(worker)}
//                 className="w-full rounded-lg border border-border bg-card p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
//               >
//                 <div className="flex items-start justify-between gap-3">
//                   <div>
//                     <p className="font-semibold text-foreground">
//                       {worker.full_name || worker.passport?.full_name || "Unnamed Worker"}
//                     </p>
//
//                     <p className="mt-1 text-xs text-muted-foreground">
//                       Passport:{" "}
//                       {worker.passport_number ||
//                         worker.passport?.passport_number ||
//                         "—"}
//                     </p>
//
//                     <p className="text-xs text-muted-foreground">
//                       Nationality:{" "}
//                       {worker.nationality ||
//                         worker.passport?.nationality ||
//                         "—"}
//                     </p>
//                   </div>
//
//                   <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
//                     Pending
//                   </span>
//                 </div>
//               </button>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
function InfoSection({ title, data }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>

      {Object.keys(data || {}).length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No data available.
        </p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data || {}).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-right font-medium text-foreground">
                {value ? String(value) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerDrawer({ worker, onClose }) {
  const [openTab, setOpenTab] = useState("passport");

  const tabs = [
    { key: "passport", label: "Passport" },
    { key: "medical_information", label: "Health Checkup" },
    { key: "general_information", label: "General Info" },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-card shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <p className="font-semibold text-foreground">
            {worker.passport?.full_name || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {worker.passport?.passport_number || "—"} ·{" "}
            {worker.passport?.nationality || "—"}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-muted-foreground text-xl leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setOpenTab(tab.key)}
            className={`flex-1 py-2 text-sm font-medium ${
              openTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {openTab === "passport" && (
          <InfoSection title="Passport Information" data={worker.passport} />
        )}

        {openTab === "medical_information" && (
          <InfoSection
            title="Health Checkup / Medical File"
            data={worker.medical_information}
          />
        )}

        {openTab === "general_information" && (
          <InfoSection
            title="General Information"
            data={worker.general_information}
          />
        )}
      </div>
    </div>
  );
}

function WorkerDrawerStage1({ worker, onClose }) {
  const [openStage, setOpenStage] = useState("stage_1");

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-card shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <p className="font-semibold text-foreground">{worker.passport?.full_name || "—"}</p>
          <p className="text-xs text-muted-foreground">{worker.passport?.passport_number} · {worker.passport?.nationality} · {worker.sector}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">&times;</button>
      </div>

      <div className="flex border-b">
        {["stage_1", "stage_2"].map((s) => (
          <button
            key={s}
            onClick={() => setOpenStage(s)}
            className={`flex-1 py-2 text-sm font-medium ${openStage === s ? "border-b-2 border-blue-600 text-blue-600" : "text-muted-foreground"}`}
          >
            {s === "stage_1" ? "Stage 1 — VDR" : "Stage 2 — PLKS"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {openStage === "stage_1" &&
          Object.entries(worker.stage_1 || {}).map(([key, phase]) => (
            <PhaseSection key={key} label={phase.label} data={phase.data} />
          ))}
        {openStage === "stage_2" &&
          Object.entries(worker.stage_2 || {})
            .filter(([key]) => key !== "com_repatriation" || worker.stage_2?.arrival_verification?.data?.mdac_verified)
            .map(([key, phase]) => (
              <PhaseSection key={key} label={phase.label} data={phase.data} />
            ))}
      </div>

      {worker.validation_errors?.length > 0 && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-950/40 border-t">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Validation Errors</p>
          {worker.validation_errors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">• {e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkersPage() {
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const companyName = useAuthStore((state) => state.user?.name);
  const { data, isLoading, error } = useQuery({
    queryKey: ["workersList"],
    queryFn: listWorkers,
    staleTime: 30_000,
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showReviewQueue, setShowReviewQueue] = useState(false);

  const companyWorkers = (data?.workers || []).filter((worker) => {
    return !selectedCompanyId || worker.company_id === selectedCompanyId;
  });

  const workers = companyWorkers.filter((w) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (w.passport?.full_name || "").toLowerCase().includes(q) ||
      (w.passport?.passport_number || "").toLowerCase().includes(q) ||
      (w.passport?.nationality || "").toLowerCase().includes(q)
    );
  });

  const pendingReviews = companyWorkers.filter(
      (w) => w.review_status === "pending_review"
  );

  return (
    <div className="p-6">

        <div>
          <h1 className="text-xl font-semibold text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground">
            {workers.length} worker{workers.length === 1 ? "" : "s"}
            {companyName ? ` · ${companyName}` : ""}
          </p>
        </div>


      <input
        type="text"
        placeholder="Search by name, passport, nationality…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-border rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading workers…</p>}
      {error && <p className="text-sm text-red-500">Failed to load workers.</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Passport</th>
                <th className="px-4 py-3 text-left">Nationality</th>
                <th className="px-4 py-3 text-left">Stage 1</th>
                <th className="px-4 py-3 text-left">Stage 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No workers found.</td>
                </tr>
              )}
              {workers.map((w) => (
                <tr
                  key={w.worker_id}
                  onClick={() => setSelected(w)}
                  className="hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{w.passport?.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.passport?.passport_number || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{w.passport?.nationality || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge status={stageStatus(w.stage_1 || {}, w.validation_errors)} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={stageStatus(w.stage_2 || {}, [])} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showReviewQueue && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowReviewQueue(false)}
          />
          <ReviewQueueDrawer
            workers={pendingReviews}
            onClose={() => setShowReviewQueue(false)}
            onSelectWorker={(worker) => {
              setShowReviewQueue(false);
              setSelected(worker);
            }}
          />
        </>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelected(null)} />
          <WorkerDrawer worker={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
