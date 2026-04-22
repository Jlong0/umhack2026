import { CircleAlert, LoaderCircle } from "lucide-react";

function prettyLabel(fieldName) {
	return fieldName
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidenceTone(confidence) {
	if (confidence >= 0.9) {
		return "bg-emerald-100 text-emerald-800";
	}

	if (confidence >= 0.75) {
		return "bg-amber-100 text-amber-800";
	}

	return "bg-rose-100 text-rose-800";
}

export default function ParsedForm({
	parsedFields,
	formValues,
	onFieldChange,
	onConfirm,
	isConfirming,
}) {
	const fieldEntries = Object.entries(parsedFields || {});

	if (!fieldEntries.length) {
		return (
			<section className="permit-surface flex min-h-64 items-center justify-center p-6 text-center">
				<div className="max-w-sm space-y-2 text-slate-600">
					<CircleAlert className="mx-auto h-6 w-6 text-slate-400" />
					<p className="text-sm font-medium text-slate-700">No extracted fields yet.</p>
					<p className="text-xs">Run the upload flow to populate and confirm extracted worker data.</p>
				</div>
			</section>
		);
	}

	return (
		<section className="permit-surface p-5 sm:p-6">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">Confirm & Create Schema</h2>
					<p className="mt-1 text-sm text-slate-600">
						Review low-confidence fields before generating obligations.
					</p>
				</div>
			</div>

			<div className="space-y-4">
				{fieldEntries.map(([fieldKey, fieldData]) => {
					const confidence = Number(fieldData?.confidence || 0);
					return (
						<label key={fieldKey} className="block rounded-lg border border-slate-200 bg-white p-3">
							<div className="mb-2 flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-slate-800">{prettyLabel(fieldKey)}</span>
								<span
									className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${confidenceTone(
										confidence,
									)}`}
								>
									{(confidence * 100).toFixed(0)}% confidence
								</span>
							</div>
							<input
								value={formValues[fieldKey] || ""}
								onChange={(event) => onFieldChange(fieldKey, event.target.value)}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
							/>
						</label>
					);
				})}
			</div>

			<button
				type="button"
				className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
				onClick={onConfirm}
				disabled={isConfirming}
			>
				{isConfirming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
				{isConfirming ? "Confirming..." : "Confirm & Generate Obligations"}
			</button>
		</section>
	);
}

