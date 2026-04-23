import { useParams, useNavigate } from "react-router-dom";
import { useWorkflowStatus, useComplianceGraph, useResumeWorkflow } from "@/hooks/queries/useWorkflowQueries";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, AlertCircle, CheckCircle, Clock } from "lucide-react";

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
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
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

			<div className="bg-white border border-gray-200 rounded-lg p-6">
				<h1 className="text-2xl font-bold text-gray-900 mb-4">Workflow: {workerId}</h1>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div>
						<div className="text-sm text-gray-600">Status</div>
						<div className="font-semibold text-gray-900">{workflow.status}</div>
					</div>
					<div>
						<div className="text-sm text-gray-600">Current Agent</div>
						<div className="font-semibold text-gray-900">{workflow.current_agent}</div>
					</div>
					<div>
						<div className="text-sm text-gray-600">Compliance</div>
						<div className="font-semibold text-gray-900">{workflow.compliance_status}</div>
					</div>
					<div>
						<div className="text-sm text-gray-600">Complete</div>
						<div className="font-semibold text-gray-900">
							{workflow.workflow_complete ? "Yes" : "No"}
						</div>
					</div>
				</div>

				{workflow.hitl_required && (
					<div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
						<div className="flex items-center space-x-2 mb-3">
							<AlertCircle className="w-5 h-5 text-orange-600" />
							<span className="font-semibold text-orange-900">Human Decision Required</span>
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
						<h3 className="font-semibold text-gray-900 mb-3">Alerts</h3>
						<div className="space-y-2">
							{workflow.alerts.map((alert, idx) => (
								<div key={idx} className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm">
									{alert.message || JSON.stringify(alert)}
								</div>
							))}
						</div>
					</div>
				)}

				{workflow.observations && workflow.observations.length > 0 && (
					<div>
						<h3 className="font-semibold text-gray-900 mb-3">Agent Observations</h3>
						<div className="space-y-1 max-h-64 overflow-y-auto">
							{workflow.observations.map((obs, idx) => (
								<div key={idx} className="text-sm text-gray-700 border-l-2 border-gray-300 pl-3 py-1">
									{obs}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{graph && (
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-gray-900 mb-4">Compliance Graph</h2>
					<div style={{ height: "500px" }}>
						<ReactFlow
							nodes={graph.nodes}
							edges={graph.edges}
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
		</div>
	);
}
