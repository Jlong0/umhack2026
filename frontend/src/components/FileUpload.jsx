import { FileText, LoaderCircle, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB"];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** exponent;
	return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export default function FileUpload({
	file,
	onFileSelect,
	onUpload,
	isUploading,
	isPolling,
	progressValue,
	stepText,
}) {
	const [isDragActive, setIsDragActive] = useState(false);
	const inputRef = useRef(null);

	const handleDrop = (event) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(false);

		const droppedFile = event.dataTransfer?.files?.[0];
		if (droppedFile) {
			onFileSelect(droppedFile);
		}
	};

	return (
		<section className="permit-surface space-y-4 p-5 sm:p-6">
			<div>
				<h2 className="text-lg font-semibold">Upload & Polling State</h2>
				<p className="mt-1 text-sm text-slate-600">
					Drag and drop a passport, permit, or PDF to start the parsing job.
				</p>
			</div>

			<div
				className={cn(
					"node-transition rounded-xl border-2 border-dashed p-6 text-center",
					isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50/70",
				)}
				onDrop={handleDrop}
				onDragOver={(event) => {
					event.preventDefault();
					setIsDragActive(true);
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					setIsDragActive(false);
				}}
			>
				<input
					ref={inputRef}
					type="file"
					className="hidden"
					accept="application/pdf,image/png,image/jpeg"
					onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
				/>

				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
					<UploadCloud className="h-6 w-6" />
				</div>

				<p className="text-sm font-medium text-slate-700">
					Drop file here or{" "}
					<button
						type="button"
						className="text-indigo-700 underline-offset-2 hover:underline"
						onClick={() => inputRef.current?.click()}
					>
						browse device
					</button>
				</p>

				<p className="mt-2 text-xs text-slate-500">Accepted: PDF, PNG, JPEG</p>
			</div>

			{file ? (
				<div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<FileText className="h-5 w-5 shrink-0 text-slate-500" />
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
							<p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
						</div>
					</div>

					<button
						type="button"
						className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
						onClick={onUpload}
						disabled={isUploading || isPolling}
					>
						{isUploading ? "Uploading..." : "Upload"}
					</button>
				</div>
			) : null}

			{(isUploading || isPolling) && (
				<div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4">
					<div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-900">
						<LoaderCircle className="h-4 w-4 animate-spin" />
						Agent extracting data...
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-indigo-100">
						<div
							className="h-full rounded-full bg-indigo-500 transition-all duration-300"
							style={{ width: `${Math.max(8, Math.min(progressValue, 100))}%` }}
						/>
					</div>
					<p className="mt-2 text-xs text-indigo-800">{stepText}</p>
				</div>
			)}
		</section>
	);
}

