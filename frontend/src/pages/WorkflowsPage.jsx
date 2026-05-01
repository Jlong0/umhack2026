import { useNavigate } from "react-router-dom";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { AlertCircle, CheckCircle, Clock, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";

export default function WorkflowsPage() {
	const { data, isLoading: loading, error: queryError } = useAllWorkflows();
	const workflows = data?.workflows || [];
	const error = queryError?.message || null;
	const navigate = useNavigate();

	const statusVariant = { active: "info", completed: "success", failed: "danger" };

	function getComplianceIcon(status) {
		switch (status) {
			case "compliant":
				return <CheckCircle className="w-5 h-5 text-green-600" />;
			case "non_compliant":
				return <AlertCircle className="w-5 h-5 text-red-600" />;
			case "pending":
				return <Clock className="w-5 h-5 text-yellow-600" />;
			default:
				return <PlayCircle className="w-5 h-5 text-muted-foreground" />;
		}
	}

	if (loading) return <PageSkeleton variant="table" />;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Worker Workflows"
				description="Automated compliance processing status for each worker"
				actions={
					<span className="text-sm text-muted-foreground">
						Total: {workflows.length} workflows
					</span>
				}
			/>

			{error && (
				<ErrorState compact message={error} />
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
							<div className="text-right text-sm text-muted-foreground">
								<div>Started: {new Date(workflow.started_at).toLocaleString()}</div>
								<div>Updated: {new Date(workflow.last_updated).toLocaleString()}</div>
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
					<div className="text-center py-12 text-muted-foreground">
						No active workflows found
					</div>
				)}
			</div>
		</div>
	);
}
