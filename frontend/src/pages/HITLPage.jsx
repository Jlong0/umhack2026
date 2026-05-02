import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHITLWorkers, useResolveWorkerFields } from "@/hooks/queries/useHITLQueries";
import { AlertCircle, CheckCircle, Shield, FileText, Eye, Send} from "lucide-react";
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


function buildMissingInfoReminderUrl(worker) {
	if (!worker?.whatsapp) return null;

	const phone = worker.whatsapp.replace(/[^0-9]/g, "");

	const missingText = (worker.missing_fields || [])
		.map((section) => {
			const sectionName = section.label || section.section || "Missing Section";

			const items = section.items?.length
				? section.items.map((item) => `   - ${item.label || item.field}`).join("\n")
				: `   - ${section.reason || "Information required"}`;

			return `• ${sectionName}\n${items}`;
		})
		.join("\n\n");

	const message =
		`Hello ${worker.full_name || "there"},\n\n` +
		`This is a reminder from PermitIQ. Please update the missing information in your Worker Portal:\n\n` +
		`${missingText || "• Missing worker information"}\n\n` +
		`Log in here: ${window.location.origin}/login/worker\n\n` +
		`Worker ID: ${worker.worker_id}\n` +
		(worker.login_code ? `Login Code: ${worker.login_code}\n\n` : "\n") +
		`Please complete this as soon as possible. Thank you.`;

	return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}


export default function HITLPage() {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("interrupts");
	const [selectedWorker, setSelectedWorker] = useState(null);
	const [fieldValues, setFieldValues] = useState({});
	const [selectedMissingSection, setSelectedMissingSection] = useState(null);

	const { data: workersData, isLoading, isError } = useHITLWorkers();
	const resolveMutation = useResolveWorkerFields(selectedWorker?.worker_id);

	const workers = workersData?.workers || [];
	const pendingCount = workers.filter((w) => w.status === "pending").length;

	function handleSelectWorker(worker) {
		setSelectedWorker(worker);
		setFieldValues({});
		setSelectedMissingSection(null);
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
								<div className="space-y-4">
									<div>
										<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
											Missing Sections
										</p>

										<div className="mt-2 grid gap-2 sm:grid-cols-2">
											{selectedWorker.missing_fields.map((item) => {
												const itemKey = item.section || item.field;
												const selectedKey =
													selectedMissingSection?.section || selectedMissingSection?.field;

												return (
													<button
														key={itemKey}
														type="button"
														onClick={() => setSelectedMissingSection(item)}
														className={`rounded-lg border p-3 text-left transition ${
															selectedKey === itemKey
																? "border-blue-400 bg-blue-50"
																: "border-amber-200 bg-amber-50 hover:bg-amber-100"
														}`}
													>
														<p className="text-sm font-semibold text-gray-900">
															{item.label || item.section || item.field}
														</p>

														<p className="mt-1 text-xs text-gray-500">
															{item.items?.length
																? `${item.items.length} missing item${item.items.length > 1 ? "s" : ""}`
																: item.reason || "Click to view details"}
														</p>
													</button>
												);
											})}
										</div>
									</div>

									{selectedMissingSection && (
										<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
											<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
												Selected Section
											</p>

											<p className="mt-2 text-sm font-semibold text-slate-900">
												{selectedMissingSection.label ||
													selectedMissingSection.section ||
													selectedMissingSection.field}
											</p>

											<p className="mt-1 text-sm text-slate-600">
												{selectedMissingSection.reason || "This section requires review."}
											</p>

											<div className="mt-4">
												<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
													Existing Data
												</p>

												{selectedMissingSection.data &&
												Object.keys(selectedMissingSection.data).length > 0 ? (
													<div className="mt-2 space-y-2">
														{Object.entries(selectedMissingSection.data).map(([key, value]) => {
															const isMissing =
																value === null ||
																value === undefined ||
																value === "";

															return (
																<div
																	key={key}
																	className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
																>
																	<span className="font-medium capitalize text-slate-600">
																		{key.replaceAll("_", " ")}
																	</span>

																	<span
																		className={`text-right ${
																			isMissing ? "text-rose-500" : "text-slate-900"
																		}`}
																	>
																		{isMissing ? "Missing" : String(value)}
																	</span>
																</div>
															);
														})}
													</div>
												) : (
													<p className="mt-2 text-sm text-rose-500">
														No existing data found in this section.
													</p>
												)}
											</div>

											<div className="mt-4">
												<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
													Missing Items
												</p>

												{selectedMissingSection.items?.length > 0 ? (
													<ul className="mt-2 space-y-2">
														{selectedMissingSection.items.map((missingItem) => (
															<li
																key={missingItem.field || missingItem.label}
																className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
															>
																{missingItem.label || missingItem.field}
															</li>
														))}
													</ul>
												) : (
													<p className="mt-2 text-sm text-slate-500">
														No specific missing items listed.
													</p>
												)}
											</div>
										</div>
									)}
								</div>
							)}
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<button
									onClick={handleUpdate}
									disabled={resolveMutation.isPending}
									className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
								>
									{resolveMutation.isPending ? "Updating..." : "Update"}
								</button>

								{buildMissingInfoReminderUrl(selectedWorker) ? (
									<a
										href={buildMissingInfoReminderUrl(selectedWorker)}
										target="_blank"
										rel="noopener noreferrer"
										className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
									>
										<Send className="h-4 w-4" />
										Remind Worker
									</a>
								) : (
									<button
										type="button"
										disabled
										className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 py-2.5 text-sm font-semibold text-slate-400"
									>
										<Send className="h-4 w-4" />
										No WhatsApp
									</button>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
			)}
		</div>
	);
}
