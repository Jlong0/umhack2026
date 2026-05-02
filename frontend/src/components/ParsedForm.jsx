import { CircleAlert, LoaderCircle } from "lucide-react";

function prettyLabel(fieldName) {
	return fieldName
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidenceTone(confidence) {
	if (confidence >= 0.9) {
		return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
	}

	if (confidence >= 0.75) {
		return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
	}

	return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
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
				<div className="max-w-sm space-y-2 text-muted-foreground">
					<CircleAlert className="mx-auto h-6 w-6 text-muted-foreground" />
					<p className="text-sm font-medium text-foreground">No extracted fields yet.</p>
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
					<p className="mt-1 text-sm text-muted-foreground">
						Review low-confidence fields before generating obligations.
					</p>
				</div>
			</div>

			<div className="space-y-4">
				{fieldEntries.map(([fieldKey, fieldData]) => {
					const confidence = Number(fieldData?.confidence || 0);
					return (
						<label key={fieldKey} className="block rounded-lg border border-border bg-card p-3">
							<div className="mb-2 flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-foreground">{prettyLabel(fieldKey)}</span>
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
								className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground bg-background outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
							/>
						</label>
					);
				})}
			</div>

			<button
				type="button"
				className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400"
				onClick={onConfirm}
				disabled={isConfirming}
			>
				{isConfirming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
				{isConfirming ? "Confirming..." : "Confirm & Generate Obligations"}
			</button>
		</section>
	);
}
