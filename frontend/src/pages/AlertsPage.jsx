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
	const error = null;

	async function handleScanAll() {
		await triggerScan();
		queryClient.invalidateQueries({ queryKey: ["alertDashboard"] });
		queryClient.invalidateQueries({ queryKey: ["criticalAlerts"] });
		queryClient.invalidateQueries({ queryKey: ["expiringPermits"] });
	}

	function getSeverityColor(severity) {
		const colors = {
			critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
			high: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
			medium: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800",
			low: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
		};
		return colors[severity] || "bg-muted text-foreground border-border";
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
					<h1 className="text-3xl font-bold text-foreground">Compliance Alerts</h1>
					<p className="text-muted-foreground mt-1">Real-time monitoring and deadline detection</p>
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
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
					{error}
				</div>
			)}

			{dashboard && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="bg-card border border-border rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-muted-foreground">Total Workers</div>
								<div className="text-3xl font-bold text-foreground">{dashboard.summary.total_workers}</div>
							</div>
							<Users className="w-10 h-10 text-blue-600" />
						</div>
					</div>

					<div className="bg-card border border-red-200 dark:border-red-900 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-muted-foreground">Expired Permits</div>
								<div className="text-3xl font-bold text-red-600">{dashboard.summary.expired_permits}</div>
							</div>
							<AlertCircle className="w-10 h-10 text-red-600" />
						</div>
					</div>

					<div className="bg-card border border-orange-200 dark:border-orange-900 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-muted-foreground">Expiring (30 days)</div>
								<div className="text-3xl font-bold text-orange-600">{dashboard.summary.expiring_30_days}</div>
							</div>
							<Clock className="w-10 h-10 text-orange-600" />
						</div>
					</div>

					<div className="bg-card border border-green-200 dark:border-green-900 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-muted-foreground">Health Score</div>
								<div className="text-3xl font-bold text-green-600">{dashboard.health_score}%</div>
							</div>
							<TrendingUp className="w-10 h-10 text-green-600" />
						</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<div className="text-sm text-muted-foreground">Compliance Deadlocks</div>
						<div className="text-2xl font-bold text-foreground">{dashboard.summary.compliance_deadlocks}</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<div className="text-sm text-muted-foreground">FOMEMA Due</div>
						<div className="text-2xl font-bold text-foreground">{dashboard.summary.fomema_screenings_due}</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<div className="text-sm text-muted-foreground">Passport Issues</div>
						<div className="text-2xl font-bold text-foreground">{dashboard.summary.passport_issues}</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<div className="text-sm text-muted-foreground">Expiring (90 days)</div>
						<div className="text-2xl font-bold text-foreground">{dashboard.summary.expiring_90_days}</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-card border border-border rounded-lg p-6">
					<h2 className="text-xl font-bold text-foreground mb-4">Critical Alerts</h2>
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{criticalAlerts.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">No critical alerts</div>
						) : (
							criticalAlerts.map((alert, idx) => (
								<div key={idx} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="font-semibold">{alert.type}</div>
											<div className="text-sm mt-1">{alert.message}</div>
											<div className="text-xs mt-2 font-medium">Action: {alert.action}</div>
										</div>
										<div className="text-xs text-muted-foreground ml-4">
											Worker: {alert.worker_id}
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="bg-card border border-border rounded-lg p-6">
					<h2 className="text-xl font-bold text-foreground mb-4">Expiring Permits (30 Days)</h2>
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{expiringPermits.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">No permits expiring soon</div>
						) : (
							expiringPermits.map((worker) => (
								<div key={worker.worker_id} className="border border-border rounded-lg p-4">
									<div className="flex items-start justify-between">
										<div>
											<div className="font-semibold text-foreground">{worker.full_name}</div>
											<div className="text-sm text-muted-foreground">{worker.passport_number}</div>
											<div className="text-xs text-muted-foreground mt-1">
												{worker.sector} • {worker.permit_class}
											</div>
										</div>
										<div className="text-right">
											<div className={`text-lg font-bold ${worker.days_remaining <= 7 ? "text-red-600" : "text-orange-600"}`}>
												{worker.days_remaining} days
											</div>
											<div className="text-xs text-muted-foreground">
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
