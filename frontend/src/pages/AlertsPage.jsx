import { useState } from "react";
import { useAlertDashboard, useCriticalAlerts, useExpiringPermits, useScanAllWorkers } from "@/hooks/queries/useAlertQueries";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, TrendingUp, Users, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";

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

	const severityToVariant = { critical: "danger", high: "orange", medium: "warning", low: "info" };

	function getSeverityColor(severity) {
		const colors = {
			critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
			high: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
			medium: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800",
			low: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
		};
		return colors[severity] || "bg-muted text-foreground border-border";
	}

	if (loading) return <PageSkeleton variant="dashboard" />;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Compliance Alerts"
				description="Real-time monitoring and deadline detection"
				actions={
					<Button onClick={handleScanAll} disabled={scanning}>
						<RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
						{scanning ? "Scanning..." : "Scan All"}
					</Button>
				}
			/>

			{error && (
				<ErrorState compact message={error} />
			)}

			{dashboard && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<MetricCard icon={Users} label="Total Workers" value={dashboard.summary.total_workers} tone="blue" />
					<MetricCard icon={AlertCircle} label="Expired Permits" value={dashboard.summary.expired_permits} tone="red" />
					<MetricCard icon={Clock} label="Expiring (30 days)" value={dashboard.summary.expiring_30_days} tone="amber" />
					<MetricCard icon={TrendingUp} label="Health Score" value={`${dashboard.health_score}%`} tone="emerald" />
					<MetricCard label="Compliance Deadlocks" value={dashboard.summary.compliance_deadlocks} tone="red" />
					<MetricCard label="FOMEMA Due" value={dashboard.summary.fomema_screenings_due} tone="slate" />
					<MetricCard label="Passport Issues" value={dashboard.summary.passport_issues} tone="slate" />
					<MetricCard label="Expiring (90 days)" value={dashboard.summary.expiring_90_days} tone="amber" />
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
											<div className="flex items-center gap-2">
												<span className="font-semibold">{alert.type}</span>
												<StatusBadge variant={severityToVariant[alert.severity] || "neutral"}>{alert.severity}</StatusBadge>
											</div>
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
