import { useNavigate } from "react-router-dom";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { AlertCircle, CheckCircle, Clock, PlayCircle, Radio } from "lucide-react";

export default function WorkflowsPage() {
	const { data, isLoading: loading, error: queryError } = useAllWorkflows();
	const workflows = data?.workflows || [];
	const error = queryError?.message || null;
	const navigate = useNavigate();

	const statusVariant = { active: "info", completed: "success", failed: "danger" };

	function getComplianceIcon(status) {
		switch (status) {
			case "compliant":   return <CheckCircle className="w-5 h-5 text-green-600" />;
			case "non_compliant": return <AlertCircle className="w-5 h-5 text-red-600" />;
			case "pending":     return <Clock className="w-5 h-5 text-yellow-600" />;
			default:            return <PlayCircle className="w-5 h-5 text-gray-600" />;
		}
	}

	if (loading) return <PageSkeleton variant="table" />;

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Worker Workflows</h1>
					<p className="text-gray-600 mt-1">Automated compliance processing status for each worker</p>
				</div>
				<div className="text-sm text-gray-500">Total: {workflows.length} workflows</div>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">{error}</div>
			)}

			<div className="grid gap-4">
				{workflows.map((workflow) => (
					<div
						key={workflow.worker_id}
						onClick={() => navigate(`/workflows/${workflow.worker_id}`)}
						className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
					>
						<div className="flex items-start justify-between">
							<div className="flex items-start space-x-4">
								{getComplianceIcon(workflow.compliance_status)}
								<div>
									<h3 className="font-semibold text-foreground">Worker ID: {workflow.worker_id}</h3>
								<div className="flex items-center space-x-3 mt-2">
										<StatusBadge variant={statusVariant[workflow.status] || "neutral"}>{workflow.status}</StatusBadge>
										<span className="text-sm text-muted-foreground">
											Compliance: <span className="font-medium">{workflow.compliance_status}</span>
										</span>
									</div>
									{workflow.hitl_required && (
										<div className="mt-2 flex items-center space-x-2">
											<AlertCircle className="w-4 h-4 text-orange-600" />
											<span className="text-sm font-medium text-orange-600">Human decision required</span>
										</div>
									)}
								</div>
							</div>
							<div className="flex flex-col items-end gap-2">
								<div className="text-right text-sm text-gray-500">
									<div>Started: {new Date(workflow.started_at).toLocaleString()}</div>
									<div>Updated: {new Date(workflow.last_updated).toLocaleString()}</div>
								</div>
								<button
									onClick={(e) => { e.stopPropagation(); navigate(`/orchestration/${workflow.worker_id}`); }}
									className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
								>
									<Radio className="w-3 h-3" /> Live View
								</button>
							</div>
						</div>

						{workflow.workflow_complete && (
							<div className="mt-4 pt-4 border-t border-border">
								<span className="text-sm font-medium text-green-600">✓ Workflow Complete</span>
							</div>
						)}
					</div>
				))}

				{workflows.length === 0 && !loading && (
					<div className="text-center py-12 text-gray-500">No active workflows found</div>
				)}
			</div>
		</div>
	);
}
