import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHITLWorkers, useResolveWorkerFields } from "@/hooks/queries/useHITLQueries";
import { AlertCircle, CheckCircle, Shield, FileText, Eye } from "lucide-react";
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
			<div className="rounded-xl border border-border bg-card shadow-sm">
				<div className="border-b border-border px-5 py-4">
					<h2 className="text-lg font-bold text-foreground">Signed Contracts</h2>
				</div>
				<div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
					{contracts.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
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
									: "border-border hover:border-indigo-200 hover:bg-muted"
							}`}
						>
							<div className="flex items-center gap-3">
								<FileText className="w-5 h-5 text-amber-500" />
								<div>
									<p className="font-semibold text-foreground text-sm">{c.worker_name}</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										Signed {c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}
									</p>
								</div>
							</div>
						</button>
					))}
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card shadow-sm">
				<div className="border-b border-border px-5 py-4">
					<h2 className="text-lg font-bold text-foreground">Review</h2>
				</div>
				{!selectedContract ? (
					<div className="flex h-96 items-center justify-center text-muted-foreground">
						<div className="text-center">
							<Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
							<p className="text-sm">Select a contract to review</p>
						</div>
					</div>
				) : (
					<div className="p-5 space-y-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Signed Contract</p>
							{pdfUrl ? (
								<iframe src={pdfUrl} className="w-full h-64 rounded-lg border border-border" title="Signed contract" />
							) : (
								<div className="h-64 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
									Loading PDF...
								</div>
							)}
						</div>
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Passport Image</p>
							{passportUrl ? (
								<img src={passportUrl} alt="Passport" className="w-full max-h-48 object-contain rounded-lg border border-border" />
							) : (
								<div className="h-32 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
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

	if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
	if (isError) return <div className="p-6 text-red-500">Failed to load workers. Is the backend running?</div>;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Human-in-the-Loop Interrupts</h1>
					<p className="text-sm text-muted-foreground mt-1">High-stakes compliance decisions requiring human approval</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
					<Shield className="h-3.5 w-3.5" />
					{pendingCount} Pending
				</div>
			</div>

			{/* Tab bar */}
			<div className="flex gap-2 border-b border-border">
				<button
					onClick={() => setActiveTab("interrupts")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "interrupts" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
				>
					Workflow Interrupts
				</button>
				<button
					onClick={() => setActiveTab("contracts")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "contracts" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
				>
					Contract Review
				</button>
			</div>

			{activeTab === "contracts" ? <ContractReviewTab /> : (
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left: worker list */}
				<div className="rounded-xl border border-border bg-card shadow-sm">
					<div className="border-b border-border px-5 py-4">
						<h2 className="text-lg font-bold text-foreground">Pending Interrupts</h2>
					</div>
					<div className="p-4">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-xs text-muted-foreground border-b border-border">
									<th className="text-left pb-2 font-medium">Name</th>
									<th className="text-left pb-2 font-medium">Status</th>
									<th className="pb-2" />
								</tr>
							</thead>
							<tbody>
								{workers.map((worker) => (
									<tr
										key={worker.worker_id}
										className={`border-b border-gray-50 last:border-0 ${worker.status === "pending" ? "cursor-pointer hover:bg-muted" : ""} ${selectedWorker?.worker_id === worker.worker_id ? "bg-blue-50" : ""}`}
										onClick={() => worker.status === "pending" && handleSelectWorker(worker)}
									>
										<td className="py-3 font-medium text-foreground">{worker.full_name}</td>
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
				<div className="rounded-xl border border-border bg-card shadow-sm">
					<div className="border-b border-border px-5 py-4">
						<h2 className="text-lg font-bold text-foreground">Interrupt Details</h2>
					</div>
					{!selectedWorker ? (
						<div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
							Select a pending worker to review
						</div>
					) : selectedWorker.interrupt_type === "health_check" ? (
						<div className="space-y-5 p-5">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Worker</p>
								<p className="font-medium text-foreground">{selectedWorker.full_name}</p>
							</div>
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
								{selectedWorker.reason}
							</div>
							{selectedWorker.medical_form_url && (
								<div>
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Uploaded Medical Form</p>
									<img
										src={selectedWorker.medical_form_url}
										alt="Medical form"
										className="rounded-lg border border-border max-h-48 object-contain w-full"
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
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Worker</p>
								<p className="font-medium text-foreground">{selectedWorker.full_name}</p>
							</div>
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
								{selectedWorker.reason}
							</div>
							{selectedWorker.passport_image_url && (
								<div>
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Uploaded Passport</p>
									<img
										src={selectedWorker.passport_image_url}
										alt="Passport"
										className="rounded-lg border border-border max-h-48 object-contain"
									/>
								</div>
							)}
							{selectedWorker.missing_fields?.length > 0 && (
								<div className="space-y-3">
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fill Missing Fields</p>
									{selectedWorker.missing_fields.map((f) => (
										<div key={f.field}>
											<label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
											<input
												type="text"
												value={fieldValues[f.field] || ""}
												onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.field]: e.target.value }))}
												className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
			)}
		</div>
	);
}
