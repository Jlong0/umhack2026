import { useEffect, useMemo, useState } from "react";
import { FileText, UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { uploadDocument } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";

const PASSPORT_FIELDS = [
  { key: "full_name", label: "Full Name", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "sex", label: "Sex", type: "text" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "passport_number", label: "Passport Number", type: "text" },
  { key: "issue_date", label: "Issue Date", type: "date" },
  { key: "expiry_date", label: "Expiry Date", type: "date" },
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** exp;
  return `${val.toFixed(val >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export default function PassportStep({ passportData, onPassportChange }) {
  const { toast } = useToast();

  const jobId = useWorkerStore((s) => s.jobId);
  const parsedFields = useWorkerStore((s) => s.parsedFields);
  const setJobContext = useWorkerStore((s) => s.setJobContext);

  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const { isPolling, stepText } = useParseJobPolling(jobId);

  const inputRef = { current: null };

  // Preview URL lifecycle
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return undefined; }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [file]);

  // Sync parsed fields → parent passport data
  useEffect(() => {
    if (!parsedFields || Object.keys(parsedFields).length === 0) return;
    const normalized = {};
    for (const [k, v] of Object.entries(parsedFields)) {
      normalized[k] = v?.value || "";
    }
    onPassportChange(normalized);
  }, [parsedFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressValue = useMemo(() => {
    if (!isUploading && !isPolling) return 0;
    if (isPolling) return 70;
    return 24;
  }, [isPolling, isUploading]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const response = await uploadDocument(file, "passport");
      setJobContext({ jobId: response.job_id, documentId: response.document_id });
      toast({ title: "Passport uploaded", description: "We're reading your document…", variant: "success" });
    } catch (error) {
      toast({ title: "Upload failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFieldChange = (key, value) => {
    onPassportChange({ ...passportData, [key]: value });
  };

  const hasFields = Object.keys(passportData || {}).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground">Upload Your Passport</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clear scan of your passport. We'll automatically read the details for you.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
          isDragActive ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-border bg-muted/40 hover:border-indigo-300",
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={(el) => { inputRef.current = el; }}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-base font-medium text-foreground">
          Tap to choose file <span className="hidden sm:inline">or drop here</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or PDF • Must have 18+ months validity</p>
      </div>

      {/* File selected bar */}
      {file && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || isPolling}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="flex justify-center overflow-hidden rounded-2xl border border-border bg-muted p-3">
          <img src={previewUrl} alt="Passport preview" className="max-h-56 rounded-xl object-contain" />
        </div>
      )}

      {/* Polling progress */}
      {(isUploading || isPolling) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-800 dark:bg-indigo-950/60">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your passport…
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${Math.max(8, progressValue)}%` }} />
          </div>
          <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">{stepText}</p>
        </div>
      )}

      {/* Editable passport fields */}
      {hasFields && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-base font-semibold text-foreground">Passport Details</h4>
          <p className="text-xs text-muted-foreground">Review and correct any details below.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {PASSPORT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label htmlFor={`pp-${f.key}`} className="block text-sm font-medium text-muted-foreground">{f.label}</label>
                <input
                  id={`pp-${f.key}`}
                  type={f.type}
                  value={passportData?.[f.key] || ""}
                  onChange={(e) => handleFieldChange(f.key, e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 transition"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
