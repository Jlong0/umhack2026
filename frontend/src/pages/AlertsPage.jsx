import { useState } from "react";
import { useAlertDashboard, useCriticalAlerts, useExpiringPermits, useScanAllWorkers } from "@/hooks/queries/useAlertQueries";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, TrendingUp, Users, RefreshCw } from "lucide-react";

export default function AlertsPage() {
	const queryClient = useQueryClient();
	const { data: dashboard, isLoading: loadingDashboard } = useAlertDashboard();
	const { data: criticalData, isLoading: loadingCritical } = useCriticalAlerts();
	const { data: expiringData, isLoading: loadingExpiring } = useExpiringPermits(30);
	const { refetch: triggerScan, isFetching: scanning } = useScanAllWorkers();

	const criticalAlerts = criticalData?.alerts || [];
	const expiringPermits = expiringData?.workers || [];
	const loading = loadingDashboard && loadingCritical && loadingExpiring;

	async function handleScanAll() {
		await triggerScan();
		queryClient.invalidateQueries({ queryKey: ["alertDashboard"] });
		queryClient.invalidateQueries({ queryKey: ["criticalAlerts"] });
		queryClient.invalidateQueries({ queryKey: ["expiringPermits"] });
	}

	function getSeverityColor(severity) {
		const colors = {
			critical: "bg-red-100 text-red-800 border-red-300",
			high: "bg-orange-100 text-orange-800 border-orange-300",
			medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
			low: "bg-blue-100 text-blue-800 border-blue-300",
		};
		return colors[severity] || "bg-gray-100 text-gray-800 border-gray-300";
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
					<h1 className="text-3xl font-bold text-gray-900">Compliance Alerts</h1>
					<p className="text-gray-600 mt-1">Real-time monitoring and deadline detection</p>
				</div>
				<button
					onClick={handleScanAll}
					disabled={scanning}
					className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
				>
					<RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
					<span>{scanning ? "Scanning..." : "Scan All"}</span>
				</button>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			{dashboard && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="bg-white border border-gray-200 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-gray-600">Total Workers</div>
								<div className="text-3xl font-bold text-gray-900">{dashboard.summary.total_workers}</div>
							</div>
							<Users className="w-10 h-10 text-blue-600" />
						</div>
					</div>

					<div className="bg-white border border-red-200 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-gray-600">Expired Permits</div>
								<div className="text-3xl font-bold text-red-600">{dashboard.summary.expired_permits}</div>
							</div>
							<AlertCircle className="w-10 h-10 text-red-600" />
						</div>
					</div>

					<div className="bg-white border border-orange-200 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-gray-600">Expiring (30 days)</div>
								<div className="text-3xl font-bold text-orange-600">{dashboard.summary.expiring_30_days}</div>
							</div>
							<Clock className="w-10 h-10 text-orange-600" />
						</div>
					</div>

					<div className="bg-white border border-green-200 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-gray-600">Health Score</div>
								<div className="text-3xl font-bold text-green-600">{dashboard.health_score}%</div>
							</div>
							<TrendingUp className="w-10 h-10 text-green-600" />
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-6">
						<div className="text-sm text-gray-600">Compliance Deadlocks</div>
						<div className="text-2xl font-bold text-gray-900">{dashboard.summary.compliance_deadlocks}</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-6">
						<div className="text-sm text-gray-600">FOMEMA Due</div>
						<div className="text-2xl font-bold text-gray-900">{dashboard.summary.fomema_screenings_due}</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-6">
						<div className="text-sm text-gray-600">Passport Issues</div>
						<div className="text-2xl font-bold text-gray-900">{dashboard.summary.passport_issues}</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-6">
						<div className="text-sm text-gray-600">Expiring (90 days)</div>
						<div className="text-2xl font-bold text-gray-900">{dashboard.summary.expiring_90_days}</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-gray-900 mb-4">Critical Alerts</h2>
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{criticalAlerts.length === 0 ? (
							<div className="text-center py-8 text-gray-500">No critical alerts</div>
						) : (
							criticalAlerts.map((alert, idx) => (
								<div key={idx} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="font-semibold">{alert.type}</div>
											<div className="text-sm mt-1">{alert.message}</div>
											<div className="text-xs mt-2 font-medium">Action: {alert.action}</div>
										</div>
										<div className="text-xs text-gray-600 ml-4">
											Worker: {alert.worker_id}
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-gray-900 mb-4">Expiring Permits (30 Days)</h2>
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{expiringPermits.length === 0 ? (
							<div className="text-center py-8 text-gray-500">No permits expiring soon</div>
						) : (
							expiringPermits.map((worker) => (
								<div key={worker.worker_id} className="border border-gray-200 rounded-lg p-4">
									<div className="flex items-start justify-between">
										<div>
											<div className="font-semibold text-gray-900">{worker.full_name}</div>
											<div className="text-sm text-gray-600">{worker.passport_number}</div>
											<div className="text-xs text-gray-500 mt-1">
												{worker.sector} • {worker.permit_class}
											</div>
										</div>
										<div className="text-right">
											<div className={`text-lg font-bold ${worker.days_remaining <= 7 ? "text-red-600" : "text-orange-600"}`}>
												{worker.days_remaining} days
											</div>
											<div className="text-xs text-gray-500">
												{new Date(worker.permit_expiry_date).toLocaleDateString()}
											</div>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
