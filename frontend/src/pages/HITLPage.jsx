import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHITLWorkers, useResolveWorkerFields } from "@/hooks/queries/useHITLQueries";
import { AlertCircle, CheckCircle, Shield } from "lucide-react";

export default function HITLPage() {
	const navigate = useNavigate();
	const [selectedWorker, setSelectedWorker] = useState(null);
	const [fieldValues, setFieldValues] = useState({});

	const { data: workersData, isLoading, isError } = useHITLWorkers();
	const resolveMutation = useResolveWorkerFields(selectedWorker?.worker_id);

	const workers = workersData?.workers || [];
	const pendingCount = workers.filter((w) => w.status === "pending").length;

	function handleSelectWorker(worker) {
		setSelectedWorker(worker);
		const initial = {};
		worker.missing_fields?.forEach((f) => { initial[f.field] = f.value || ""; });
		setFieldValues(initial);
	}

	function handleUpdate() {
		resolveMutation.mutate(fieldValues, {
			onSuccess: () => setSelectedWorker(null),
		});
	}

	if (isLoading) return <div className="p-6 text-gray-500">Loading...</div>;
	if (isError) return <div className="p-6 text-red-500">Failed to load workers. Is the backend running?</div>;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Human-in-the-Loop Interrupts</h1>
					<p className="text-sm text-gray-600 mt-1">High-stakes compliance decisions requiring human approval</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
					<Shield className="h-3.5 w-3.5" />
					{pendingCount} Pending
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left: worker list */}
				<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="border-b border-gray-100 px-5 py-4">
						<h2 className="text-lg font-bold text-gray-900">Pending Interrupts</h2>
					</div>
					<div className="p-4">
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
									<tr
										key={worker.worker_id}
										className={`border-b border-gray-50 last:border-0 ${worker.status === "pending" ? "cursor-pointer hover:bg-gray-50" : ""} ${selectedWorker?.worker_id === worker.worker_id ? "bg-blue-50" : ""}`}
										onClick={() => worker.status === "pending" && handleSelectWorker(worker)}
									>
										<td className="py-3 font-medium text-gray-900">{worker.full_name}</td>
										<td className="py-3">
											{worker.status === "pending" ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
													<CheckCircle className="w-3 h-3" /> Complete
												</span>
											)}
										</td>
										<td className="py-3 text-right">
											{worker.status === "pending" && <AlertCircle className="w-4 h-4 text-amber-500 inline" />}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Right: detail + form */}
				<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="border-b border-gray-100 px-5 py-4">
						<h2 className="text-lg font-bold text-gray-900">Interrupt Details</h2>
					</div>
					{!selectedWorker ? (
						<div className="flex h-64 items-center justify-center text-gray-400 text-sm">
							Select a pending worker to review
						</div>
					) : selectedWorker.interrupt_type === "health_check" ? (
						<div className="space-y-5 p-5">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Worker</p>
								<p className="font-medium text-gray-900">{selectedWorker.full_name}</p>
							</div>
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
								{selectedWorker.reason}
							</div>
							{selectedWorker.medical_form_url && (
								<div>
									<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Uploaded Medical Form</p>
									<img
										src={selectedWorker.medical_form_url}
										alt="Medical form"
										className="rounded-lg border border-gray-200 max-h-48 object-contain w-full"
									/>
								</div>
							)}
							<button
								onClick={() => navigate(`/hitl/medical/${selectedWorker.worker_id}?name=${encodeURIComponent(selectedWorker.full_name)}`)}
								className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
							>
								Check Medical Result
							</button>
						</div>
					) : (
						<div className="space-y-5 p-5">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Worker</p>
								<p className="font-medium text-gray-900">{selectedWorker.full_name}</p>
							</div>
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
								{selectedWorker.reason}
							</div>
							{selectedWorker.passport_image_url && (
								<div>
									<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Uploaded Passport</p>
									<img
										src={selectedWorker.passport_image_url}
										alt="Passport"
										className="rounded-lg border border-gray-200 max-h-48 object-contain"
									/>
								</div>
							)}
							{selectedWorker.missing_fields?.length > 0 && (
								<div className="space-y-3">
									<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fill Missing Fields</p>
									{selectedWorker.missing_fields.map((f) => (
										<div key={f.field}>
											<label className="block text-xs text-gray-500 mb-1">{f.label}</label>
											<input
												type="text"
												value={fieldValues[f.field] || ""}
												onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.field]: e.target.value }))}
												className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
												placeholder={`Enter ${f.label}`}
											/>
										</div>
									))}
								</div>
							)}
							<button
								onClick={handleUpdate}
								disabled={resolveMutation.isPending}
								className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
							>
								{resolveMutation.isPending ? "Updating..." : "Update"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
