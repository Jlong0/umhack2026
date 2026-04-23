import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listPendingInterrupts, getInterruptDetails, resolveInterrupt } from "@/services/api";
import { AlertCircle, CheckCircle, XCircle, Edit3 } from "lucide-react";

export default function HITLPage() {
	const [interrupts, setInterrupts] = useState([]);
	const [selectedInterrupt, setSelectedInterrupt] = useState(null);
	const [loading, setLoading] = useState(true);
	const [resolving, setResolving] = useState(false);
	const [error, setError] = useState(null);
	const [notes, setNotes] = useState("");
	const navigate = useNavigate();

	useEffect(() => {
		loadInterrupts();
		const interval = setInterval(loadInterrupts, 5000);
		return () => clearInterval(interval);
	}, []);

	async function loadInterrupts() {
		try {
			const data = await listPendingInterrupts();
			setInterrupts(data.interrupts || []);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	async function handleSelectInterrupt(workerId) {
		try {
			const details = await getInterruptDetails(workerId);
			setSelectedInterrupt(details);
			setNotes("");
		} catch (err) {
			setError(err.message);
		}
	}

	async function handleResolve(decision) {
		if (!selectedInterrupt) return;

		setResolving(true);
		try {
			await resolveInterrupt(selectedInterrupt.worker_id, decision, notes || null);
			setSelectedInterrupt(null);
			setNotes("");
			await loadInterrupts();
		} catch (err) {
			setError(err.message);
		} finally {
			setResolving(false);
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
			<div>
				<h1 className="text-3xl font-bold text-gray-900">Human-in-the-Loop Interrupts</h1>
				<p className="text-gray-600 mt-1">High-stakes compliance decisions requiring human approval</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-gray-900 mb-4">
						Pending Interrupts ({interrupts.length})
					</h2>
					<div className="space-y-3 max-h-[600px] overflow-y-auto">
						{interrupts.length === 0 ? (
							<div className="text-center py-12 text-gray-500">
								<CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-600" />
								<div>No pending interrupts</div>
							</div>
						) : (
							interrupts.map((interrupt) => (
								<div
									key={interrupt.worker_id}
									onClick={() => handleSelectInterrupt(interrupt.worker_id)}
									className={`border rounded-lg p-4 cursor-pointer transition-all ${
										selectedInterrupt?.worker_id === interrupt.worker_id
											? "border-blue-500 bg-blue-50"
											: "border-gray-200 hover:border-blue-300"
									}`}
								>
									<div className="flex items-start space-x-3">
										<AlertCircle className="w-5 h-5 text-orange-600 mt-1" />
										<div className="flex-1">
											<div className="font-semibold text-gray-900">
												Worker: {interrupt.worker_id}
											</div>
											<div className="text-sm text-gray-600 mt-1">
												{interrupt.interrupt_type}
											</div>
											<div className="text-xs text-gray-500 mt-2">
												{new Date(interrupt.created_at).toLocaleString()}
											</div>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-gray-900 mb-4">Interrupt Details</h2>
					{!selectedInterrupt ? (
						<div className="text-center py-12 text-gray-500">
							Select an interrupt to view details
						</div>
					) : (
						<div className="space-y-6">
							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Worker Information</h3>
								<div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
									<div><span className="font-medium">Name:</span> {selectedInterrupt.worker_info?.full_name}</div>
									<div><span className="font-medium">Passport:</span> {selectedInterrupt.worker_info?.passport_number}</div>
									<div><span className="font-medium">Sector:</span> {selectedInterrupt.worker_info?.sector}</div>
									<div><span className="font-medium">Permit Class:</span> {selectedInterrupt.worker_info?.permit_class}</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Interrupt Reason</h3>
								<div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
									<div className="text-sm text-orange-900">{selectedInterrupt.reason}</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Compliance Status</h3>
								<div className="text-sm text-gray-700">{selectedInterrupt.compliance_status}</div>
							</div>

							{selectedInterrupt.alerts && selectedInterrupt.alerts.length > 0 && (
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">Alerts</h3>
									<div className="space-y-2">
										{selectedInterrupt.alerts.map((alert, idx) => (
											<div key={idx} className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
												{alert.message || JSON.stringify(alert)}
											</div>
										))}
									</div>
								</div>
							)}

							{selectedInterrupt.agent_observations && selectedInterrupt.agent_observations.length > 0 && (
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">Agent Observations</h3>
									<div className="max-h-40 overflow-y-auto space-y-1">
										{selectedInterrupt.agent_observations.map((obs, idx) => (
											<div key={idx} className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2 py-1">
												{obs}
											</div>
										))}
									</div>
								</div>
							)}

							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Decision Notes (Optional)</h3>
								<textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Add notes about your decision..."
									className="w-full border border-gray-300 rounded-lg p-3 text-sm"
									rows={3}
								/>
							</div>

							<div className="flex space-x-3">
								<button
									onClick={() => handleResolve("approve")}
									disabled={resolving}
									className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
								>
									<CheckCircle className="w-5 h-5" />
									<span>Approve</span>
								</button>
								<button
									onClick={() => handleResolve("reject")}
									disabled={resolving}
									className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
								>
									<XCircle className="w-5 h-5" />
									<span>Reject</span>
								</button>
								<button
									onClick={() => handleResolve("modify")}
									disabled={resolving}
									className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
								>
									<Edit3 className="w-5 h-5" />
									<span>Modify</span>
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
