import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HeartPulse,
  IdCard,
} from "lucide-react";
import { listWorkerObligations, listWorkers } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";

const obligationTypes = {
  passport: {
    label: "Passport Renewal",
    icon: IdCard,
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  permit: {
    label: "Permit Renewal",
    icon: FileText,
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  },
  health: {
    label: "Annual Health Checkup",
    icon: HeartPulse,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
};

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date?.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(date) {
  return date.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days = [];

  for (let i = 0; i < startDay; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function normalizeObligation(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    date: toDate(item.date),
    status: item.status || "Upcoming",
    description: item.description || "",
  };
}

function ObligationBadge({ obligation }) {
  const config = obligationTypes[obligation.type];
  const Icon = config?.icon || ClipboardCheck;
  const className = config?.className || "bg-muted text-foreground border-border";

  return (
    <div
      className={`mt-1 flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-medium ${className}`}
      title={obligation.title}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{config?.label || obligation.title}</span>
    </div>
  );
}

export default function WorkerObligationCalendar() {
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [monthDate, setMonthDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [obligations, setObligations] = useState([]);
  const [obligationsLoading, setObligationsLoading] = useState(false);
  const [obligationsError, setObligationsError] = useState("");

  useEffect(() => {
    async function loadWorkers() {
      setIsLoading(true);
      setError("");

      try {
        const response = await listWorkers();
        const workerList = Array.isArray(response)
          ? response
          : response.workers || response.data || [];
        const companyWorkers = workerList.filter((worker) => {
          return !selectedCompanyId || worker.company_id === selectedCompanyId;
        });

        setWorkers(companyWorkers);

        if (companyWorkers.length > 0) {
          setSelectedWorkerId(companyWorkers[0].id || companyWorkers[0].worker_id);
        } else {
          setSelectedWorkerId("");
        }
      } catch (err) {
        setError(err.message || "Unable to load workers.");
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkers();
  }, [selectedCompanyId]);

  const selectedWorker = useMemo(() => {
    return workers.find(
      (worker) =>
        String(worker.id || worker.worker_id) === String(selectedWorkerId),
    );
  }, [workers, selectedWorkerId]);

  useEffect(() => {
    if (!selectedWorkerId) {
      queueMicrotask(() => setObligations([]));
      return;
    }

    async function loadObligations() {
      setObligationsLoading(true);
      setObligationsError("");

      try {
        const response = await listWorkerObligations(selectedWorkerId);
        const items = (response?.obligations || [])
          .map((item) => normalizeObligation(item))
          .filter((item) => item.date);
        items.sort((a, b) => a.date - b.date);
        setObligations(items);
      } catch (err) {
        setObligationsError(err.message || "Unable to load obligations.");
        setObligations([]);
      } finally {
        setObligationsLoading(false);
      }
    }

    loadObligations();
  }, [selectedWorkerId]);

  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate]);

  const upcomingObligations = obligations.filter(
    (item) => item.date >= new Date(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worker Obligation Calendar"
        description="View passport renewal, permit renewal, and annual health checkup deadlines by worker."
        actions={
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary lg:w-72"
          >
            {workers.map((worker) => {
              const id = worker.id || worker.worker_id;
              return (
                <option key={id} value={id}>
                  {worker.full_name || worker.name || "Unnamed Worker"} —{" "}
                  {worker.passport_number || "No Passport"}
                </option>
              );
            })}
          </select>
        }
      />

      {isLoading && (
        <PageSkeleton variant="table" />
      )}

      {error && (
        <ErrorState compact message={error} />
      )}

      {obligationsError && (
        <ErrorState compact message={obligationsError} />
      )}

      {!isLoading && !error && selectedWorker && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Worker
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {selectedWorker.full_name || selectedWorker.name || "Unnamed Worker"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedWorker.nationality || "Unknown nationality"}
              </p>
            </div>

            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Passport Expiry
              </p>
              <p className="mt-2 text-lg font-semibold text-indigo-800">
                {formatDate(toDate(selectedWorker.passport?.expiry_date)) || "Not available"}
              </p>
            </div>

            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Permit Expiry
              </p>
              <p className="mt-2 text-lg font-semibold text-orange-800">
                {formatDate(toDate(selectedWorker.permit_expiry_date)) || "Not available"}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <article className="permit-surface p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonthDate(addMonths(monthDate, -1))}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <h3 className="text-lg font-semibold text-foreground">
                  {formatMonth(monthDate)}
                </h3>

                <button
                  type="button"
                  onClick={() => setMonthDate(addMonths(monthDate, 1))}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthDays.map((day, index) => {
                  const dayObligations = day
                    ? obligations.filter((item) => sameDay(item.date, day))
                    : [];

                  const isToday = day && sameDay(day, new Date());

                  return (
                    <div
                      key={day ? day.toISOString() : `empty-${index}`}
                      className={`min-h-28 rounded-xl border p-2 ${
                        day
                          ? "border-border bg-card"
                          : "border-transparent bg-muted"
                      } ${isToday ? "ring-2 ring-indigo-300" : ""}`}
                    >
                      {day && (
                        <>
                          <p className="text-sm font-semibold text-foreground">
                            {day.getDate()}
                          </p>

                          <div className="mt-1 space-y-1">
                            {dayObligations.map((obligation) => (
                              <ObligationBadge
                                key={obligation.id}
                                obligation={obligation}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="permit-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ClipboardCheck className="h-5 w-5 text-indigo-700" />
                Upcoming Obligations
              </h3>

              <div className="mt-4 space-y-3">
                {obligationsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading obligations...</p>
                ) : upcomingObligations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming obligations found.
                  </p>
                ) : (
                  upcomingObligations.map((item) => {
                    const config = obligationTypes[item.type] || {};
                    const Icon = config.icon || ClipboardCheck;
                    const badgeClass = config.className || "bg-muted text-foreground border-border";

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg border p-2 ${badgeClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-medium text-foreground">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(item.date)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
