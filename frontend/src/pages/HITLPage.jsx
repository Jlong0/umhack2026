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
import { usePendingInterrupts, useInterruptDetails, useResolveInterrupt } from "@/hooks/queries/useHITLQueries";
import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { AlertCircle, CheckCircle, XCircle, Edit3, Eye, Shield, FileText } from "lucide-react";
import { useContracts, useReviewContract, useContractPdfUrl } from "@/hooks/queries/useContractQueries";

function ContractReviewTab() {
	const [selectedContract, setSelectedContract] = useState(null);
	const { data } = useContracts("signed");
	const reviewMutation = useReviewContract();
	const { data: pdfUrl } = useContractPdfUrl(selectedContract?.contract_id);
	const [passportUrl, setPassportUrl] = useState(null);

	async function handleSelect(contract) {
		setSelectedContract(contract);
		setPassportUrl(null);
		try {
			const docsRes = await fetch(
				`http://127.0.0.1:8001/documents?worker_id=${contract.worker_id}&document_type=passport`,
			);
			const docsData = await docsRes.json();
			const passport = docsData?.documents?.[0];
			if (passport?.document_id) {
				const urlRes = await fetch(
					`http://127.0.0.1:8001/documents/${passport.document_id}/url`,
				).catch(() => null);
				const urlData = urlRes ? await urlRes.json().catch(() => null) : null;
				setPassportUrl(urlData?.url || null);
			}
		} catch {
			// passport image optional
		}
	}

	const contracts = data?.contracts || [];

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
				<div className="border-b border-gray-100 px-5 py-4">
					<h2 className="text-lg font-bold text-gray-900">Signed Contracts</h2>
				</div>
				<div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
					{contracts.length === 0 ? (
						<div className="text-center py-12 text-gray-500">
							<CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
							<p className="font-medium">No signed contracts pending review</p>
						</div>
					) : contracts.map((c) => (
						<button
							key={c.contract_id}
							onClick={() => handleSelect(c)}
							className={`w-full text-left rounded-xl border p-4 transition-all ${
								selectedContract?.contract_id === c.contract_id
									? "border-indigo-400 bg-indigo-50"
									: "border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
							}`}
						>
							<div className="flex items-center gap-3">
								<FileText className="w-5 h-5 text-amber-500" />
								<div>
									<p className="font-semibold text-gray-900 text-sm">{c.worker_name}</p>
									<p className="text-xs text-gray-400 mt-0.5">
										Signed {c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}
									</p>
								</div>
							</div>
						</button>
					))}
				</div>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
				<div className="border-b border-gray-100 px-5 py-4">
					<h2 className="text-lg font-bold text-gray-900">Review</h2>
				</div>
				{!selectedContract ? (
					<div className="flex h-96 items-center justify-center text-gray-400">
						<div className="text-center">
							<Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
							<p className="text-sm">Select a contract to review</p>
						</div>
					</div>
				) : (
					<div className="p-5 space-y-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Signed Contract</p>
							{pdfUrl ? (
								<iframe src={pdfUrl} className="w-full h-64 rounded-lg border border-gray-200" title="Signed contract" />
							) : (
								<div className="h-64 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
									Loading PDF...
								</div>
							)}
						</div>
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Passport Image</p>
							{passportUrl ? (
								<img src={passportUrl} alt="Passport" className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
							) : (
								<div className="h-32 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
									No passport image found
								</div>
							)}
						</div>
						<button
							onClick={() =>
								reviewMutation.mutate(selectedContract.contract_id, {
									onSuccess: () => setSelectedContract(null),
								})
							}
							disabled={reviewMutation.isPending}
							className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
						>
							<CheckCircle className="w-4 h-4" />
							{reviewMutation.isPending ? "Updating..." : "Update — Mark Reviewed"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

export default function HITLPage() {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("interrupts");
	const [selectedWorkerId, setSelectedWorkerId] = useState(null);
	const [notes, setNotes] = useState("");
	const openIntentPreview = useUIStore((s) => s.openIntentPreview);
	const appendEntry = useAuditLogStore((s) => s.appendEntry);

	const { data: interruptData, isLoading } = usePendingInterrupts();
	const { data: selectedInterrupt } = useInterruptDetails(selectedWorkerId);
	const resolveMutation = useResolveInterrupt(selectedWorkerId);

	const interrupts = interruptData?.interrupts || [];

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
					<h1 className="text-2xl font-bold text-gray-900">Human-in-the-Loop</h1>
					<p className="text-sm text-gray-600 mt-1">
						High-stakes compliance decisions requiring human approval
					</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
					<Shield className="h-3.5 w-3.5" />
					{interrupts.length} Pending
				</div>
			</div>

			{/* Tab bar */}
			<div className="flex gap-2 border-b border-gray-200">
				<button
					onClick={() => setActiveTab("interrupts")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "interrupts" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
				>
					Workflow Interrupts
				</button>
				<button
					onClick={() => setActiveTab("contracts")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "contracts" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
				>
					Contract Review
				</button>
			</div>

			{activeTab === "contracts" ? <ContractReviewTab /> : (
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left Pane: Interrupt Queue */}
				<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="border-b border-gray-100 px-5 py-4">
						<h2 className="text-lg font-bold text-gray-900">
							Pending Interrupts
						</h2>
					</div>
					<div className="max-h-[600px] space-y-2 overflow-y-auto p-4">
						{interrupts.length === 0 ? (
							<div className="text-center py-12 text-gray-500">
								<CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
								<p className="font-medium">All clear</p>
								<p className="text-xs mt-1">No pending interrupts</p>
							</div>
						) : (
							interrupts.map((interrupt) => (
								<button
									key={interrupt.worker_id}
									onClick={() => handleSelectInterrupt(interrupt.worker_id)}
									className={`w-full text-left rounded-xl border p-4 transition-all ${
										selectedWorkerId === interrupt.worker_id
											? "border-blue-400 bg-blue-50 shadow-sm"
											: "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
									}`}
								>
									<div className="flex items-start justify-between">
										<div className="flex items-start gap-3">
											<AlertCircle className={`w-5 h-5 mt-0.5 ${
												interrupt.interrupt_type === "compliance_breach"
													? "text-red-500"
													: "text-amber-500"
											}`} />
											<div>
												<div className="font-semibold text-gray-900 text-sm">
													{interrupt.worker_id}
												</div>
												<div className="text-xs text-gray-500 mt-0.5">
													{interrupt.interrupt_type?.replace(/_/g, " ")}
												</div>
											</div>
										</div>
										{interrupt.confidence_score != null && (
											<ConfidenceBadge
												score={interrupt.confidence_score}
												reasoning={interrupt.reason}
											/>
										)}
									</div>
									<div className="mt-2 text-xs text-gray-400">
										{new Date(interrupt.created_at).toLocaleString()}
									</div>
								</button>
							))
						)}
					</div>
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
			)}
		</div>
	);
}
