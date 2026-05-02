import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkers } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const STATUS_VARIANT = {
  complete: "success",
  in_progress: "warning",
  blocked: "danger",
  not_started: "neutral",
};

function Badge({ status }) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status] || "neutral"}>
      {status.replace("_", " ")}
    </StatusBadge>
  );
}

function stageStatus(stageData, validationErrors) {
  const phases = Object.values(stageData);
  if (!phases.length) return "not_started";
  if (validationErrors?.length) return "blocked";
  const filled = phases.filter(
    (p) => p?.data && Object.values(p.data).some((v) => v !== null && v !== undefined && v !== ""),
  );
  if (filled.length === phases.length) return "complete";
  if (filled.length > 0) return "in_progress";
  return "not_started";
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

function InfoSection({ title, data }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {Object.keys(data || {}).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-base text-muted-foreground">
          No data available.
        </p>
      ) : (
        <div className="space-y-3">
          {Object.entries(data || {}).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 rounded-lg bg-muted/40 px-4 py-3 text-base">
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

function WorkerDrawer({ worker, open, onOpenChange }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={worker?.passport?.full_name || "—"}
        description={`${worker?.passport?.passport_number || "—"} · ${worker?.passport?.nationality || "—"}`}
        className="max-w-5xl"
      >
        <Tabs defaultValue="passport" className="flex flex-col">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="passport" className="flex-1 rounded-none border-b-2 border-transparent py-3 text-base font-medium data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">Passport</TabsTrigger>
            <TabsTrigger value="medical_information" className="flex-1 rounded-none border-b-2 border-transparent py-3 text-base font-medium data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">Health Checkup</TabsTrigger>
            <TabsTrigger value="general_information" className="flex-1 rounded-none border-b-2 border-transparent py-3 text-base font-medium data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">General Info</TabsTrigger>
          </TabsList>
          <div className="max-h-[65vh] overflow-y-auto px-2 py-6">
            <TabsContent value="passport" className="mt-0">
              <InfoSection title="Passport Information" data={worker?.passport} />
            </TabsContent>
            <TabsContent value="medical_information" className="mt-0">
              <InfoSection title="Health Checkup / Medical File" data={worker?.medical_information} />
            </TabsContent>
            <TabsContent value="general_information" className="mt-0">
              <InfoSection title="General Information" data={worker?.general_information} />
            </TabsContent>
          </div>
        </Tabs>
      </ModalContent>
    </Modal>
  );
}

function WorkerDrawerStage1({ worker, open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={worker?.passport?.full_name || "—"}
        description={`${worker?.passport?.passport_number || "—"} · ${worker?.passport?.nationality || "—"} · ${worker?.sector || "—"}`}
      >
        <Tabs defaultValue="stage_1" className="flex h-full flex-col">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="stage_1" className="flex-1 rounded-none border-b-2 border-transparent py-2.5 text-sm data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">Stage 1 — VDR</TabsTrigger>
            <TabsTrigger value="stage_2" className="flex-1 rounded-none border-b-2 border-transparent py-2.5 text-sm data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">Stage 2 — PLKS</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="stage_1" className="mt-0">
              {Object.entries(worker?.stage_1 || {}).map(([key, phase]) => (
                <PhaseSection key={key} label={phase.label} data={phase.data} />
              ))}
            </TabsContent>
            <TabsContent value="stage_2" className="mt-0">
              {Object.entries(worker?.stage_2 || {})
                .filter(([key]) => key !== "com_repatriation" || worker?.stage_2?.arrival_verification?.data?.mdac_verified)
                .map(([key, phase]) => (
                  <PhaseSection key={key} label={phase.label} data={phase.data} />
                ))}
            </TabsContent>
          </div>
        </Tabs>

        {worker?.validation_errors?.length > 0 && (
          <div className="border-t px-6 py-3 bg-red-50 dark:bg-red-950/40">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Validation Errors</p>
            {worker.validation_errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600">• {e}</p>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
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

        <PageHeader
          title="Workers"
          description={`${workers.length} worker${workers.length === 1 ? "" : "s"}${companyName ? ` · ${companyName}` : ""}`}
        />


      <input
        type="text"
        placeholder="Search by name, passport, nationality…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-border rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isLoading && <PageSkeleton variant="table" />}
      {error && <ErrorState compact message="Failed to load workers." />}

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
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(w); } }}
                  aria-label={`View details for ${w.passport?.full_name || 'worker'}`}
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

      <WorkerDrawer worker={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
