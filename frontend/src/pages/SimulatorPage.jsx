import { useState } from "react";
import { useMTLMTiers, useEPSalaryThresholds, useSimulateMTLM, useSimulateEPSalary } from "@/hooks/queries/useSimulatorQueries";
import { useQuery } from "@tanstack/react-query";
import { listWorkers } from "@/services/api";
import { Calculator, TrendingUp, DollarSign, AlertCircle, CheckCircle } from "lucide-react";

const QUOTA_MAX = 50;

function useActiveWorkerCount() {
  return useQuery({
    queryKey: ["workers-quota"],
    queryFn: listWorkers,
    select: (data) => (data?.workers || data || []).filter(w => w.status === "active").length,
    refetchInterval: 30000,
  });
}

export default function SimulatorPage() {
	const [activeTab, setActiveTab] = useState("mtlm");

	// Reference data via TanStack Query
	const { data: mtlmTiers } = useMTLMTiers();
	const { data: epThresholds } = useEPSalaryThresholds();
	const { data: activeCount = 0 } = useActiveWorkerCount();

	// MTLM State
	const [mtlmSector, setMtlmSector] = useState("Manufacturing");
	const [currentForeign, setCurrentForeign] = useState(10);
	const [currentLocal, setCurrentLocal] = useState(100);
	const [newWorkers, setNewWorkers] = useState(5);
	const [mtlmResult, setMtlmResult] = useState(null);

	// EP Salary State
	const [epCategory, setEpCategory] = useState("EP_Category_I");
	const [currentSalary, setCurrentSalary] = useState(15000);
	const [renewalDate, setRenewalDate] = useState("2026-07-01");
	const [epResult, setEpResult] = useState(null);

	// Mutations
	const mtlmMutation = useSimulateMTLM();
	const epMutation = useSimulateEPSalary();

	async function handleMTLMSimulation() {
		mtlmMutation.mutate(
			{ sector: mtlmSector, currentForeignCount: currentForeign, currentLocalCount: currentLocal, newForeignWorkers: newWorkers },
			{ onSuccess: (data) => setMtlmResult(data) }
		);
	}

	async function handleEPSimulation() {
		epMutation.mutate(
			{ category: epCategory, currentSalaryRM: currentSalary, renewalDate },
			{ onSuccess: (data) => setEpResult(data) }
		);
	}

	const mtlmLoading = mtlmMutation.isPending;
	const epLoading = epMutation.isPending;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-foreground">Cost Simulator</h1>
				<p className="text-muted-foreground mt-1">Model levy costs and salary compliance scenarios</p>
			</div>

			<div className="flex space-x-2 border-b border-border">
				<button
					onClick={() => setActiveTab("mtlm")}
					className={`px-6 py-3 font-medium transition-colors ${
						activeTab === "mtlm"
							? "border-b-2 border-blue-600 text-blue-600"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					MTLM Levy Calculator
				</button>
				<button
					onClick={() => setActiveTab("ep")}
					className={`px-6 py-3 font-medium transition-colors ${
						activeTab === "ep"
							? "border-b-2 border-blue-600 text-blue-600"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					EP Salary Compliance
				</button>
			</div>

			{activeTab === "mtlm" && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-xl font-bold text-foreground mb-4 flex items-center space-x-2">
							<Calculator className="w-5 h-5" />
							<span>MTLM Input Parameters</span>
						</h2>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-foreground mb-2">Sector</label>
								<select
									value={mtlmSector}
									onChange={(e) => setMtlmSector(e.target.value)}
									className="w-full border border-border rounded-lg px-4 py-2"
								>
									<option value="Manufacturing">Manufacturing</option>
									<option value="Construction">Construction</option>
									<option value="Plantation">Plantation</option>
									<option value="Agriculture">Agriculture</option>
									<option value="Services">Services</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-foreground mb-2">
									Current Foreign Workers
								</label>
								<input
									type="number"
									value={currentForeign}
									onChange={(e) => setCurrentForeign(parseInt(e.target.value) || 0)}
									className="w-full border border-border rounded-lg px-4 py-2"
									min="0"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-foreground mb-2">
									Current Local Workers
								</label>
								<input
									type="number"
									value={currentLocal}
									onChange={(e) => setCurrentLocal(parseInt(e.target.value) || 0)}
									className="w-full border border-border rounded-lg px-4 py-2"
									min="0"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-foreground mb-2">
									New Foreign Workers to Hire
								</label>
								<input
									type="number"
									value={newWorkers}
									onChange={(e) => setNewWorkers(parseInt(e.target.value) || 0)}
									className="w-full border border-border rounded-lg px-4 py-2"
									min="0"
								/>
							</div>

							<div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-950/40 dark:border-indigo-800">
								<span className="text-muted-foreground">Quota Currently Used: </span>
								<span className={`font-bold ${activeCount / QUOTA_MAX >= 0.9 ? "text-red-600" : "text-indigo-700"}`}>
									{activeCount} / {QUOTA_MAX}
								</span>
								{activeCount / QUOTA_MAX >= 0.9 && (
									<span className="ml-2 text-xs text-red-600">— 90% threshold reached</span>
								)}
							</div>

							<button
								onClick={handleMTLMSimulation}
								disabled={mtlmLoading}
								className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
							>
								{mtlmLoading ? "Calculating..." : "Calculate Levy Impact"}
							</button>
						</div>

						{mtlmTiers && (
							<div className="mt-6 pt-6 border-t border-border">
								<h3 className="font-semibold text-foreground mb-3">Tier Structure ({mtlmSector})</h3>
								<div className="space-y-2 text-sm">
									{Object.entries(mtlmTiers.tiers[mtlmSector] || {}).map(([tier, data]) => (
										<div key={tier} className="flex justify-between bg-muted px-3 py-2 rounded">
											<span className="font-medium">{tier}: {data.ratio}</span>
											<span>RM {data.levy_rm}/worker/year</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-xl font-bold text-foreground mb-4 flex items-center space-x-2">
							<TrendingUp className="w-5 h-5" />
							<span>Simulation Results</span>
						</h2>

						{!mtlmResult ? (
							<div className="text-center py-12 text-muted-foreground">
								Configure parameters and run simulation
							</div>
						) : (
							<div className="space-y-6">
								<div className="grid grid-cols-2 gap-4">
									<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950/40 dark:border-blue-800">
										<div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Current State</div>
										<div className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">
											RM {mtlmResult.current_state.total_annual_levy_rm.toLocaleString()}
										</div>
										<div className="text-xs text-blue-700 mt-1">
											Tier: {mtlmResult.current_state.tier}
										</div>
										<div className="text-xs text-blue-700">
											Ratio: {(mtlmResult.current_state.foreign_worker_ratio ?? 0).toFixed(1)}%
										</div>
									</div>

									<div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950/40 dark:border-green-800">
										<div className="text-sm text-green-600 dark:text-green-400 font-medium">Projected State</div>
										<div className="text-2xl font-bold text-green-900 dark:text-green-200 mt-1">
											RM {mtlmResult.projected_state.total_annual_levy_rm.toLocaleString()}
										</div>
										<div className="text-xs text-green-700 mt-1">
											Tier: {mtlmResult.projected_state.tier}
										</div>
										<div className="text-xs text-green-700">
											Ratio: {(mtlmResult.projected_state.foreign_worker_ratio ?? 0).toFixed(1)}%
										</div>
									</div>
								</div>

								<div className={`border rounded-lg p-4 ${
									mtlmResult.impact.levy_increase_rm > 0 ? "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800" : "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800"
								}`}>
									<div className="flex items-center justify-between">
										<div>
											<div className="text-sm font-medium text-foreground">Levy Increase</div>
											<div className={`text-3xl font-bold ${
												mtlmResult.impact.levy_increase_rm > 0 ? "text-orange-600" : "text-green-600"
											}`}>
												RM {mtlmResult.impact.levy_increase_rm.toLocaleString()}
											</div>
										</div>
										<DollarSign className="w-10 h-10 text-muted-foreground" />
									</div>
								</div>

								{mtlmResult.impact.tier_change && (
									<div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-950/40 dark:border-red-800">
										<div className="flex items-start space-x-2">
											<AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
											<div>
												<div className="font-semibold text-red-900 dark:text-red-300">Tier Change Detected</div>
												<div className="text-sm text-red-700 dark:text-red-400 mt-1">
													Moving to {mtlmResult.impact.new_tier}
												</div>
											</div>
										</div>
									</div>
								)}

								<div className="bg-muted rounded-lg p-4">
									<div className="font-semibold text-foreground mb-2">Recommendation</div>
									<div className="text-sm text-foreground">{mtlmResult.impact.recommendation}</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{activeTab === "ep" && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-xl font-bold text-foreground mb-4 flex items-center space-x-2">
							<Calculator className="w-5 h-5" />
							<span>EP Salary Input</span>
						</h2>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-foreground mb-2">EP Category</label>
								<select
									value={epCategory}
									onChange={(e) => setEpCategory(e.target.value)}
									className="w-full border border-border rounded-lg px-4 py-2"
								>
									<option value="EP_Category_I">Category I (Top Management)</option>
									<option value="EP_Category_II">Category II (Senior Professionals)</option>
									<option value="EP_Category_III">Category III (Professionals)</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-foreground mb-2">
									Current Monthly Salary (RM)
								</label>
								<input
									type="number"
									value={currentSalary}
									onChange={(e) => setCurrentSalary(parseFloat(e.target.value) || 0)}
									className="w-full border border-border rounded-lg px-4 py-2"
									min="0"
									step="100"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-foreground mb-2">
									Renewal Date
								</label>
								<input
									type="date"
									value={renewalDate}
									onChange={(e) => setRenewalDate(e.target.value)}
									className="w-full border border-border rounded-lg px-4 py-2"
								/>
							</div>

							<button
								onClick={handleEPSimulation}
								disabled={epLoading}
								className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
							>
								{epLoading ? "Checking..." : "Check Compliance"}
							</button>
						</div>

						{epThresholds && (
							<div className="mt-6 pt-6 border-t border-border">
								<h3 className="font-semibold text-foreground mb-3">Salary Thresholds</h3>
								<div className="space-y-3 text-sm">
									<div className="bg-muted px-3 py-2 rounded">
										<div className="font-medium text-foreground">Pre-June 2026</div>
										<div className="text-muted-foreground mt-1">
											Cat I: RM {epThresholds.pre_june_2026.EP_Category_I.toLocaleString()} |
											Cat II: RM {epThresholds.pre_june_2026.EP_Category_II.toLocaleString()} |
											Cat III: RM {epThresholds.pre_june_2026.EP_Category_III.toLocaleString()}
										</div>
									</div>
									<div className="bg-orange-50 border border-orange-200 px-3 py-2 rounded dark:bg-orange-950/40 dark:border-orange-800">
										<div className="font-medium text-orange-900 dark:text-orange-300">Post-June 2026</div>
										<div className="text-orange-700 dark:text-orange-400 mt-1">
											Cat I: RM {epThresholds.post_june_2026.EP_Category_I.toLocaleString()} |
											Cat II: RM {epThresholds.post_june_2026.EP_Category_II.toLocaleString()} |
											Cat III: RM {epThresholds.post_june_2026.EP_Category_III.toLocaleString()}
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-xl font-bold text-foreground mb-4 flex items-center space-x-2">
							<TrendingUp className="w-5 h-5" />
							<span>Compliance Check</span>
						</h2>

						{!epResult ? (
							<div className="text-center py-12 text-muted-foreground">
								Enter salary details and check compliance
							</div>
						) : (
							<div className="space-y-6">
								<div className={`border rounded-lg p-6 ${
									epResult.compliance_check.compliant
										? "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800"
										: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800"
								}`}>
									<div className="flex items-center justify-between mb-4">
										<div className="text-lg font-semibold">
											{epResult.compliance_check.compliant ? "✓ Compliant" : "✗ Non-Compliant"}
										</div>
										{epResult.compliance_check.compliant ? (
											<CheckCircle className="w-8 h-8 text-green-600" />
										) : (
											<AlertCircle className="w-8 h-8 text-red-600" />
										)}
									</div>

									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span className="text-foreground">Current Salary:</span>
											<span className="font-semibold">RM {epResult.compliance_check.current_salary_rm.toLocaleString()}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-foreground">Required Minimum:</span>
											<span className="font-semibold">RM {epResult.compliance_check.required_minimum_rm.toLocaleString()}</span>
										</div>
										{!epResult.compliance_check.compliant && (
											<div className="flex justify-between pt-2 border-t">
												<span className="text-foreground">Shortfall:</span>
												<span className="font-bold text-red-600">
													RM {epResult.compliance_check.shortfall_rm.toLocaleString()}
												</span>
											</div>
										)}
									</div>
								</div>

								{!epResult.financial_impact.compliant && (
									<div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-950/40 dark:border-orange-800">
										<h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-3">Financial Impact</h3>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-orange-700">Monthly Increase:</span>
												<span className="font-semibold text-orange-900">
													RM {epResult.financial_impact.monthly_increase_rm.toLocaleString()}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-orange-700">Annual Increase:</span>
												<span className="font-semibold text-orange-900">
													RM {epResult.financial_impact.annual_increase_rm.toLocaleString()}
												</span>
											</div>
										</div>
									</div>
								)}

								<div className="bg-muted rounded-lg p-4">
									<div className="font-semibold text-foreground mb-2">Recommendation</div>
									<div className="text-sm text-foreground">{epResult.recommendation}</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
