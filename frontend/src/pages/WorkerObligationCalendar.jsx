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

const obligationTypes = {
  passport: {
    label: "Passport Renewal",
    icon: IdCard,
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  permit: {
    label: "Permit Renewal",
    icon: FileText,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  health: {
    label: "Annual Health Checkup",
    icon: HeartPulse,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
  const className = config?.className || "bg-slate-50 text-slate-700 border-slate-200";

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
      <section className="permit-surface px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <CalendarDays className="h-5 w-5 text-indigo-700" />
              Worker Obligation Calendar
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              View passport renewal, permit renewal, and annual health checkup deadlines by worker.
            </p>
          </div>

          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:w-72"
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
        </div>
      </section>

      {isLoading && (
        <section className="permit-surface p-6 text-sm text-slate-600">
          Loading workers...
        </section>
      )}

      {error && (
        <section className="permit-surface border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error}
        </section>
      )}

      {obligationsError && (
        <section className="permit-surface border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          {obligationsError}
        </section>
      )}

      {!isLoading && !error && selectedWorker && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Worker
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {selectedWorker.full_name || selectedWorker.name || "Unnamed Worker"}
              </p>
              <p className="text-sm text-slate-500">
                {selectedWorker.nationality || "Unknown nationality"}
              </p>
            </div>

            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Passport Expiry
              </p>
              <p className="mt-2 text-lg font-semibold text-indigo-800">
                {formatDate(toDate(selectedWorker.passport?.expiry_date)) || "Not available"}
              </p>
            </div>

            <div className="permit-surface p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
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
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <h3 className="text-lg font-semibold text-slate-900">
                  {formatMonth(monthDate)}
                </h3>

                <button
                  type="button"
                  onClick={() => setMonthDate(addMonths(monthDate, 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                          ? "border-slate-200 bg-white"
                          : "border-transparent bg-slate-50"
                      } ${isToday ? "ring-2 ring-indigo-300" : ""}`}
                    >
                      {day && (
                        <>
                          <p className="text-sm font-semibold text-slate-700">
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
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ClipboardCheck className="h-5 w-5 text-indigo-700" />
                Upcoming Obligations
              </h3>

              <div className="mt-4 space-y-3">
                {obligationsLoading ? (
                  <p className="text-sm text-slate-500">Loading obligations...</p>
                ) : upcomingObligations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No upcoming obligations found.
                  </p>
                ) : (
                  upcomingObligations.map((item) => {
                    const config = obligationTypes[item.type] || {};
                    const Icon = config.icon || ClipboardCheck;
                    const badgeClass = config.className || "bg-slate-50 text-slate-700 border-slate-200";

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg border p-2 ${badgeClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {item.title}
                            </p>
                            <p className="text-sm text-slate-600">
                              {formatDate(item.date)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.description}
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
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
