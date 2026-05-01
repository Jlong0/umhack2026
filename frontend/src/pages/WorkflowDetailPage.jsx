import { useParams, useNavigate } from "react-router-dom";
import { useWorkflowStatus, useComplianceGraph, useResumeWorkflow } from "@/hooks/queries/useWorkflowQueries";
import ReactFlow, { Background, Controls } from "reactflow";
import { Handle, Position } from "reactflow";
import "reactflow/dist/style.css";

function AgentNode({ data }) {
  return (
    <div className={`px-3 py-2 rounded-lg border text-xs font-medium shadow-sm ${
      data.active
        ? "bg-blue-600 text-white border-blue-700"
        : data.status === "completed"
        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
        : "bg-card text-foreground border-border"
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

const NODE_TYPES = { agent: AgentNode };
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Loader, Circle } from "lucide-react";

const TRACE_ICON = {
  completed: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
  failed:    <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
  running:   <Loader className="h-4 w-4 text-amber-500 animate-spin shrink-0" />,
};

function duration(entries, node) {
  const start = entries.find(e => e.node === node && e.status === "running");
  const end   = entries.find(e => e.node === node && e.status !== "running");
  if (!start || !end) return null;
  const ms = new Date(end.timestamp) - new Date(start.timestamp);
  return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : null;
}

function TraceSection({ trace }) {
  if (!trace?.length) return null;
  // Deduplicate: keep last entry per node
  const seen = new Map();
  for (const e of trace) seen.set(e.node, e);
  const entries = [...seen.values()];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold text-foreground mb-4">Execution Trace</h2>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-2.5">
            {TRACE_ICON[e.status] || <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium text-foreground">{e.node}</span>
                {duration(trace, e.node) && (
                  <span className="text-xs text-muted-foreground">{duration(trace, e.node)}</span>
                )}
              </div>
              {e.output_summary && (
                <p className="text-xs text-muted-foreground mt-0.5">{e.output_summary}</p>
              )}
              {e.error && (
                <p className="text-xs text-red-600 mt-0.5 font-mono">{e.error}</p>
              )}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              e.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
              e.status === "failed"    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" :
              e.status === "running"   ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                                         "bg-muted text-muted-foreground"
            }`}>{e.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowDetailPage() {
	const { workerId } = useParams();
	const navigate = useNavigate();

	const { data: workflow, isLoading, error: statusError } = useWorkflowStatus(workerId);
	const { data: graph } = useComplianceGraph(workerId);
	const resumeMutation = useResumeWorkflow(workerId);

	const loading = isLoading;
	const error = statusError?.message || null;
	const resuming = resumeMutation.isPending;

	function handleResumeWorkflow(decision) {
		resumeMutation.mutate({ userDecision: decision });
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-4">
				<button onClick={() => navigate("/workflows")} className="flex items-center text-blue-600 hover:text-blue-800">
					<ArrowLeft className="w-4 h-4 mr-2" />
					Back to Workflows
				</button>
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
					{error}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<button onClick={() => navigate("/workflows")} className="flex items-center text-blue-600 hover:text-blue-800">
				<ArrowLeft className="w-4 h-4 mr-2" />
				Back to Workflows
			</button>

			<div className="bg-card border border-border rounded-lg p-6">
				<h1 className="text-2xl font-bold text-foreground mb-4">Workflow: {workerId}</h1>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div>
						<div className="text-sm text-muted-foreground">Status</div>
						<div className="font-semibold text-foreground">{workflow.status}</div>
					</div>
					<div>
						<div className="text-sm text-muted-foreground">Current Agent</div>
						<div className="font-semibold text-foreground">{workflow.current_agent}</div>
					</div>
					<div>
						<div className="text-sm text-muted-foreground">Compliance</div>
						<div className="font-semibold text-foreground">{workflow.compliance_status}</div>
					</div>
					<div>
						<div className="text-sm text-muted-foreground">Complete</div>
						<div className="font-semibold text-foreground">
							{workflow.workflow_complete ? "Yes" : "No"}
						</div>
					</div>
				</div>

				{workflow.hitl_required && (
					<div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 dark:bg-orange-950 dark:border-orange-800">
						<div className="flex items-center space-x-2 mb-3">
							<AlertCircle className="w-5 h-5 text-orange-600" />
							<span className="font-semibold text-orange-900 dark:text-orange-200">Human Decision Required</span>
						</div>
						<div className="flex space-x-3">
							<button
								onClick={() => handleResumeWorkflow("approve")}
								disabled={resuming}
								className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
							>
								Approve
							</button>
							<button
								onClick={() => handleResumeWorkflow("reject")}
								disabled={resuming}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
							>
								Reject
							</button>
							<button
								onClick={() => handleResumeWorkflow("modify")}
								disabled={resuming}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
							>
								Modify
							</button>
						</div>
					</div>
				)}

				{workflow.alerts && workflow.alerts.length > 0 && (
					<div className="mb-6">
						<h3 className="font-semibold text-foreground mb-3">Alerts</h3>
						<div className="space-y-2">
							{workflow.alerts.map((alert, idx) => (
								<div key={idx} className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm dark:bg-red-950 dark:border-red-800 dark:text-red-200">
									{alert.message || JSON.stringify(alert)}
								</div>
							))}
						</div>
					</div>
				)}

				{workflow.observations && workflow.observations.length > 0 && (
					<div>
						<h3 className="font-semibold text-foreground mb-3">Agent Observations</h3>
						<div className="space-y-1 max-h-64 overflow-y-auto">
							{workflow.observations.map((obs, idx) => (
								<div key={idx} className="text-sm text-foreground border-l-2 border-border pl-3 py-1">
									{obs}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{graph && (
				<div className="bg-card border border-border rounded-lg p-6">
					<h2 className="text-xl font-bold text-foreground mb-4">Compliance Graph</h2>
					<div style={{ height: "500px" }}>
						<ReactFlow
							nodes={graph.nodes}
							edges={graph.edges}
							nodeTypes={NODE_TYPES}
							fitView
							nodesDraggable={false}
							nodesConnectable={false}
							elementsSelectable={false}
						>
							<Background />
							<Controls />
						</ReactFlow>
					</div>
				</div>
			)}

			<TraceSection trace={workflow?.trace} />
		</div>
	);
}
