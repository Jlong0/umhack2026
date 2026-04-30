import { useNavigate } from "react-router-dom";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { AlertCircle, CheckCircle, Clock, PlayCircle } from "lucide-react";

export default function WorkflowsPage() {
	const { data, isLoading: loading, error: queryError } = useAllWorkflows();
	const workflows = data?.workflows || [];
	const error = queryError?.message || null;
	const navigate = useNavigate();

	function getStatusBadge(status) {
		const styles = {
			active: "bg-blue-100 text-blue-800",
			completed: "bg-green-100 text-green-800",
			failed: "bg-red-100 text-red-800",
		};
		return (
			<span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
				{status}
			</span>
		);
	}

	function getComplianceIcon(status) {
		switch (status) {
			case "compliant":
				return <CheckCircle className="w-5 h-5 text-green-600" />;
			case "non_compliant":
				return <AlertCircle className="w-5 h-5 text-red-600" />;
			case "pending":
				return <Clock className="w-5 h-5 text-yellow-600" />;
			default:
				return <PlayCircle className="w-5 h-5 text-gray-600" />;
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Worker Workflows</h1>
					<p className="text-gray-600 mt-1">Automated compliance processing status for each worker</p>
				</div>
				<div className="text-sm text-gray-500">
					Total: {workflows.length} workflows
				</div>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			<div className="grid gap-4">
				{workflows.map((workflow) => (
					<div
						key={workflow.worker_id}
						onClick={() => navigate(`/workflows/${workflow.worker_id}`)}
						className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
					>
						<div className="flex items-start justify-between">
							<div className="flex items-start space-x-4">
								{getComplianceIcon(workflow.compliance_status)}
								<div>
									<h3 className="font-semibold text-gray-900">Worker ID: {workflow.worker_id}</h3>
									<div className="flex items-center space-x-3 mt-2">
										{getStatusBadge(workflow.status)}
										<span className="text-sm text-gray-600">
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
							<div className="text-right text-sm text-gray-500">
								<div>Started: {new Date(workflow.started_at).toLocaleString()}</div>
								<div>Updated: {new Date(workflow.last_updated).toLocaleString()}</div>
							</div>
						</div>

						{workflow.workflow_complete && (
							<div className="mt-4 pt-4 border-t border-gray-200">
								<span className="text-sm font-medium text-green-600">✓ Workflow Complete</span>
							</div>
						)}
					</div>
				))}

				{workflows.length === 0 && !loading && (
					<div className="text-center py-12 text-gray-500">
						No active workflows found
					</div>
				)}
			</div>
		</div>
	);
}
