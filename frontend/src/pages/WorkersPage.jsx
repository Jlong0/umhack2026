import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkers } from "@/services/api";

const STATUS_COLORS = {
  complete: "bg-green-100 text-green-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  not_started: "bg-gray-100 text-gray-500",
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
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h4>
      <div className="space-y-1">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 capitalize">{key.replace(/_/g, " ")}</span>
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
//     <div className="fixed inset-y-0 right-0 z-50 flex w-[520px] flex-col bg-white shadow-2xl">
//       <div className="flex items-center justify-between border-b px-6 py-4">
//         <div>
//           <h2 className="text-lg font-semibold text-gray-900">
//             Review Queue
//           </h2>
//           <p className="text-xs text-gray-500">
//             {workers.length} pending submission{workers.length === 1 ? "" : "s"}
//           </p>
//         </div>
//
//         <button
//           onClick={onClose}
//           className="text-xl leading-none text-gray-400 hover:text-gray-600"
//         >
//           &times;
//         </button>
//       </div>
//
//       <div className="flex-1 overflow-y-auto p-4">
//         {workers.length === 0 ? (
//           <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-400">
//             No submissions need review.
//           </p>
//         ) : (
//           <div className="space-y-3">
//             {workers.map((worker) => (
//               <button
//                 key={worker.worker_id}
//                 type="button"
//                 onClick={() => onSelectWorker(worker)}
//                 className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
//               >
//                 <div className="flex items-start justify-between gap-3">
//                   <div>
//                     <p className="font-semibold text-gray-900">
//                       {worker.full_name || worker.passport?.full_name || "Unnamed Worker"}
//                     </p>
//
//                     <p className="mt-1 text-xs text-gray-500">
//                       Passport:{" "}
//                       {worker.passport_number ||
//                         worker.passport?.passport_number ||
//                         "—"}
//                     </p>
//
//                     <p className="text-xs text-gray-500">
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
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>

      {Object.keys(data || {}).length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-gray-400">
          No data available.
        </p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data || {}).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-sm">
              <span className="text-gray-500 capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-right font-medium text-gray-900">
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
    <div className="fixed inset-y-0 right-0 w-[520px] bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <p className="font-semibold text-gray-900">
            {worker.passport?.full_name || "—"}
          </p>
          <p className="text-xs text-gray-500">
            {worker.passport?.passport_number || "—"} ·{" "}
            {worker.passport?.nationality || "—"}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
                : "text-gray-500"
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
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <p className="font-semibold text-gray-900">{worker.passport?.full_name || "—"}</p>
          <p className="text-xs text-gray-500">{worker.passport?.passport_number} · {worker.passport?.nationality} · {worker.sector}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <div className="flex border-b">
        {["stage_1", "stage_2"].map((s) => (
          <button
            key={s}
            onClick={() => setOpenStage(s)}
            className={`flex-1 py-2 text-sm font-medium ${openStage === s ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
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
        <div className="px-6 py-3 bg-red-50 border-t">
          <p className="text-xs font-semibold text-red-700 mb-1">Validation Errors</p>
          {worker.validation_errors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">• {e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workersList"],
    queryFn: listWorkers,
    staleTime: 30_000,
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showReviewQueue, setShowReviewQueue] = useState(false);

  const workers = (data?.workers || []).filter((w) => {
    const q = search.toLowerCase();
    console.log(data?.workers)
    return (
      !q ||
      (w.passport?.full_name || "").toLowerCase().includes(q) ||
      (w.passport?.passport_number || "").toLowerCase().includes(q) ||
      (w.passport?.nationality || "").toLowerCase().includes(q)
    );
  });

  const pendingReviews = (data?.workers || []).filter(
      (w) => w.review_status === "pending_review"
  );

  return (
    <div className="p-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workers</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 0} total</p>
        </div>


      <input
        type="text"
        placeholder="Search by name, passport, nationality…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isLoading && <p className="text-sm text-gray-500">Loading workers…</p>}
      {error && <p className="text-sm text-red-500">Failed to load workers.</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Passport</th>
                <th className="px-4 py-3 text-left">Nationality</th>
                <th className="px-4 py-3 text-left">Stage 1</th>
                <th className="px-4 py-3 text-left">Stage 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No workers found.</td>
                </tr>
              )}
              {workers.map((w) => (
                <tr
                  key={w.worker_id}
                  onClick={() => setSelected(w)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{w.passport?.full_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{w.passport?.passport_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{w.passport?.nationality || "—"}</td>
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
