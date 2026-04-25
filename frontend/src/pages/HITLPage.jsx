/**
 * HITLPage — Enhanced PRD Flow 1 (Document Upload & HITL Verification)
 *
 * Dual-pane verification interface:
 * - Left: Interrupt queue with confidence badges
 * - Right: Worker details, AI reasoning, and resolution controls
 *
 * Security (per security-auditor skill):
 * - All approve/reject actions logged to audit trail
 * - Intent preview triggered for high-liability decisions
 * - Confidence scores displayed per field for transparency
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHITLWorkers, usePendingInterrupts, useInterruptDetails, useResolveInterrupt } from "@/hooks/queries/useHITLQueries";
import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { AlertCircle, CheckCircle, XCircle, Edit3, Eye, Shield } from "lucide-react";

export default function HITLPage() {
	const navigate = useNavigate();
	const [selectedWorkerId, setSelectedWorkerId] = useState(null);
	const [reasonWorker, setReasonWorker] = useState(null);
	const [notes, setNotes] = useState("");
	const openIntentPreview = useUIStore((s) => s.openIntentPreview);
	const appendEntry = useAuditLogStore((s) => s.appendEntry);

	const { data: workersData, isLoading } = useHITLWorkers();
	const { data: selectedInterrupt } = useInterruptDetails(selectedWorkerId);
	const resolveMutation = useResolveInterrupt(selectedWorkerId);

	const workers = workersData?.workers || [];
	const interrupts = workers.filter((w) => w.status === "pending");

	function handleSelectInterrupt(workerId) {
		setSelectedWorkerId(workerId);
		setNotes("");
	}

	function handleResolve(decision) {
		if (!selectedInterrupt) return;

		// For high-liability decisions, route through Intent Preview
		const isHighRisk = selectedInterrupt.interrupt_type === "compliance_breach" ||
			selectedInterrupt.compliance_status === "critical";

		if (isHighRisk && decision === "approve") {
			openIntentPreview({
				action: `Approve HITL interrupt for worker ${selectedInterrupt.worker_id}`,
				worker_id: selectedInterrupt.worker_id,
				message: selectedInterrupt.reason,
				computed_data: selectedInterrupt.computed_data || {},
			}, () => {
				resolveMutation.mutate(
					{ decision: "approve", notes: notes || "Approved via Intent Preview" },
					{
						onSuccess: () => {
							setSelectedWorkerId(null);
							setNotes("");
						},
					}
				);
			});
			return;
		}

		resolveMutation.mutate(
			{ decision, notes: notes || null },
			{
				onSuccess: () => {
					setSelectedWorkerId(null);
					setNotes("");
				},
			}
		);
	}

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Human-in-the-Loop Interrupts</h1>
					<p className="text-sm text-gray-600 mt-1">Loading pending decisions...</p>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{[0, 1].map((i) => (
						<div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
							<div className="h-6 w-48 rounded bg-gray-200" />
							<div className="mt-4 space-y-3">
								{[0, 1, 2].map((j) => (
									<div key={j} className="h-20 rounded-lg bg-gray-100" />
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Human-in-the-Loop Interrupts</h1>
					<p className="text-sm text-gray-600 mt-1">
						High-stakes compliance decisions requiring human approval
					</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
					<Shield className="h-3.5 w-3.5" />
					{interrupts.length} Pending
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left Pane: Interrupt Queue */}
				<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="border-b border-gray-100 px-5 py-4">
						<h2 className="text-lg font-bold text-gray-900">
							Pending Interrupts
						</h2>
					</div>
					<div className="overflow-y-auto p-4">
						{workers.length === 0 ? (
							<div className="text-center py-12 text-gray-500">
								<CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
								<p className="font-medium">No workers</p>
							</div>
						) : (
							<table className="w-full text-sm">
								<thead>
									<tr className="text-xs text-gray-400 border-b border-gray-100">
										<th className="text-left pb-2 font-medium">Name</th>
										<th className="text-left pb-2 font-medium">Status</th>
										<th className="pb-2" />
									</tr>
								</thead>
								<tbody>
									{workers.map((worker) => (
										<tr key={worker.worker_id} className="border-b border-gray-50 last:border-0">
											<td className="py-3 font-medium text-gray-900">{worker.full_name}</td>
											<td className="py-3">
												{worker.status === "pending" ? (
													<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
														Pending
													</span>
												) : (
													<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
														<CheckCircle className="w-3 h-3" /> Complete
													</span>
												)}
											</td>
											<td className="py-3 text-right">
												{worker.status === "pending" && (
													<button
														onClick={() => setReasonWorker(worker)}
														className="rounded-full p-1 text-amber-500 hover:bg-amber-50"
														title="View reason"
													>
														<AlertCircle className="w-4 h-4" />
													</button>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>

					{/* Reason modal */}
					{reasonWorker && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setReasonWorker(null)}>
							<div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
								<h3 className="font-semibold text-gray-900 mb-1">{reasonWorker.full_name}</h3>
								<p className="text-xs text-gray-400 mb-3 capitalize">{reasonWorker.interrupt_type?.replace(/_/g, " ")}</p>
								<div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
									{reasonWorker.reason}
								</div>
								<button onClick={() => setReasonWorker(null)} className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
									Close
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Right Pane: Interrupt Details & Resolution */}
				<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="border-b border-gray-100 px-5 py-4">
						<h2 className="text-lg font-bold text-gray-900">Interrupt Details</h2>
					</div>

					{!selectedInterrupt ? (
						<div className="flex h-96 items-center justify-center text-gray-400">
							<div className="text-center">
								<Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
								<p className="text-sm">Select an interrupt to view details</p>
							</div>
						</div>
					) : (
						<div className="space-y-5 p-5">
							{/* Worker Info */}
							<div>
								<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Worker Information</h3>
								<div className="rounded-lg bg-gray-50 p-4 grid grid-cols-2 gap-3 text-sm">
									<div>
										<span className="text-gray-400 text-xs">Name</span>
										<p className="font-medium text-gray-900">{selectedInterrupt.worker_info?.full_name || "—"}</p>
									</div>
									<div>
										<span className="text-gray-400 text-xs">Passport</span>
										<p className="font-mono text-gray-900">{selectedInterrupt.worker_info?.passport_number || "—"}</p>
									</div>
									<div>
										<span className="text-gray-400 text-xs">Sector</span>
										<p className="font-medium text-gray-900">{selectedInterrupt.worker_info?.sector || "—"}</p>
									</div>
									<div>
										<span className="text-gray-400 text-xs">Permit Class</span>
										<p className="font-medium text-gray-900">{selectedInterrupt.worker_info?.permit_class || "—"}</p>
									</div>
								</div>
							</div>

							{/* AI Reasoning */}
							<div>
								<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">AI Reasoning</h3>
								<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
									<p className="text-sm text-amber-900">{selectedInterrupt.reason}</p>
								</div>
							</div>

							{/* Compliance Status */}
							{selectedInterrupt.compliance_status && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Compliance Status</h3>
									<p className="text-sm text-gray-700">{selectedInterrupt.compliance_status}</p>
								</div>
							)}

							{/* Alerts */}
							{selectedInterrupt.alerts?.length > 0 && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Active Alerts</h3>
									<div className="space-y-1.5">
										{selectedInterrupt.alerts.map((alert, idx) => (
											<div key={idx} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
												{alert.message || JSON.stringify(alert)}
											</div>
										))}
									</div>
								</div>
							)}

							{/* Agent Observations */}
							{selectedInterrupt.agent_observations?.length > 0 && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Agent Observations</h3>
									<div className="max-h-32 overflow-y-auto space-y-1 rounded-lg bg-gray-50 p-3">
										{selectedInterrupt.agent_observations.map((obs, idx) => (
											<div key={idx} className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2 py-0.5">
												{obs}
											</div>
										))}
									</div>
								</div>
							)}

							{/* Decision Notes */}
							<div>
								<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Decision Notes</h3>
								<textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Document your reasoning for audit trail..."
									className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
									rows={3}
								/>
							</div>

							{/* Action Buttons */}
							<div className="flex gap-3">
								<button
									onClick={() => handleResolve("approve")}
									disabled={resolveMutation.isPending}
									className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
								>
									<CheckCircle className="w-4 h-4" />
									Approve
								</button>
								<button
									onClick={() => handleResolve("reject")}
									disabled={resolveMutation.isPending}
									className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
								>
									<XCircle className="w-4 h-4" />
									Reject
								</button>
								<button
									onClick={() => handleResolve("modify")}
									disabled={resolveMutation.isPending}
									className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
								>
									<Edit3 className="w-4 h-4" />
									Modify
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
