/* eslint-disable react-hooks/set-state-in-effect */
import { Copy, LoaderCircle, PlayCircle, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { cn } from "@/lib/utils";
import { patchWorkerTask } from "@/services/api";
import { areDependenciesCompleted, isStatusAwaitingApproval } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";

function ToolApprovalModal({ open, task, payload, onApprove, onDismiss, isApproving }) {
  const approveButtonRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    approveButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, open]);

  if (!open || !task) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tool approval"
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
      >
        <h3 className="text-lg font-semibold text-slate-900">Tool Approval Required</h3>
        <p className="mt-1 text-sm text-slate-600">
          {task.taskName} is waiting for a human checkpoint before the graph can continue.
        </p>

        <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-300">
          {JSON.stringify(payload, null, 2)}
        </pre>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onDismiss}
          >
            Close
          </button>

          <button
            ref={approveButtonRef}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            onClick={onApprove}
            disabled={isApproving}
          >
            {isApproving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Approve & Resume Graph
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  const { toast } = useToast();

  const workerId = useWorkerStore((state) => state.workerId);
  const taskSource = useWorkerStore((state) => state.taskSource);
  const storeTasks = useWorkerStore((state) => state.tasks);
  const applyTaskStatus = useWorkerStore((state) => state.applyTaskStatus);

  useWorkerTasksPolling(workerId, {
    enabled: Boolean(workerId),
    intervalMs: 6000,
  });

  const tasks = storeTasks;

  const approvalTask = useMemo(
    () =>
      tasks.find(
        (task) =>
          task.requiresApproval ||
          isStatusAwaitingApproval(task.status) ||
          (task.nodeType === "CalculateFines" && task.toolPayload),
      ) || null,
    [tasks],
  );

  const myEgTask = useMemo(
    () => tasks.find((task) => task.nodeType === "MyEGPending") || null,
    [tasks],
  );

  const myEgReady = useMemo(
    () => (myEgTask ? areDependenciesCompleted(myEgTask, tasks) : false),
    [myEgTask, tasks],
  );

  const showMyEgPayload = Boolean(myEgTask) && myEgReady;
  const myEgPayload = myEgTask?.toolPayload || {
    levy_amount: "RM 590",
    processing_fee: "RM 35",
    worker_id: workerId || "demo-worker-001",
    channel: "MyEG",
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (approvalTask) {
      setIsModalOpen(true);
    }
  }, [approvalTask]);

  const handleApprove = async () => {
    if (!approvalTask) {
      return;
    }

    setIsApproving(true);

    try {
      if (workerId) {
        await patchWorkerTask(workerId, approvalTask.id, { status: "completed" });
      }

      applyTaskStatus(approvalTask.id, "completed");
      setIsModalOpen(false);

      toast({
        title: "Graph resumed",
        description: "Task status updated and dependent nodes were re-evaluated.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Approval failed",
        description: error.message || "Unable to patch task status.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(myEgPayload, null, 2));
      toast({
        title: "Payload copied",
        description: "MyEG payload copied to clipboard.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard permission denied in this browser context.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Interactive Tool Execution & Payload Handoff</h2>
        <p className="mt-1 text-sm text-slate-600">
          Resolve graph pauses by approving tool calls and exporting MyEG payloads.
        </p>
        <p className="mt-2 text-xs text-slate-500">Worker: {workerId || "demo-worker-001"} | Source: {taskSource}</p>
      </section>

      <section className="permit-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Tool Approval Queue</h3>
            <p className="mt-1 text-sm text-slate-600">
              Triggered whenever a node requests explicit human approval before continuing execution.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100"
            onClick={() => setIsModalOpen(true)}
            disabled={!approvalTask}
          >
            <Wrench className="h-4 w-4" />
            Open Approval Modal
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
          {approvalTask ? (
            <>
              <p className="font-medium text-slate-900">Pending task: {approvalTask.taskName}</p>
              <p className="mt-1 text-xs text-slate-600">Status: {approvalTask.status}</p>
            </>
          ) : (
            <p>No pending approvals at the moment.</p>
          )}
        </div>
      </section>

      <section
        className={cn(
          "permit-surface p-5 sm:p-6",
          showMyEgPayload ? "border-emerald-200" : "border-slate-200 opacity-70",
        )}
      >
        <h3 className="text-base font-semibold text-slate-900">MyEG Payload Execution Widget</h3>
        <p className="mt-1 text-sm text-slate-600">
          Visible once upstream dependencies are satisfied for the MyEG handoff node.
        </p>

        {showMyEgPayload ? (
          <>
            <dl className="mt-4 grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 sm:grid-cols-2">
              {Object.entries(myEgPayload).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={handleCopyPayload}
            >
              <Copy className="h-4 w-4" />
              Copy Payload
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">MyEG node is still blocked by upstream dependency status.</p>
        )}
      </section>

      <ToolApprovalModal
        open={isModalOpen}
        task={approvalTask}
        payload={approvalTask?.toolPayload || {}}
        onApprove={handleApprove}
        onDismiss={() => setIsModalOpen(false)}
        isApproving={isApproving}
      />
    </div>
  );
}
