import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, UploadCloud, Loader2, CheckCircle2, Camera, X } from "lucide-react";
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
  const inputRef = useRef(null);

  const jobId = useWorkerStore((s) => s.jobId);
  const parsedFields = useWorkerStore((s) => s.parsedFields);
  const setJobContext = useWorkerStore((s) => s.setJobContext);

  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const { isPolling, stepText } = useParseJobPolling(jobId);
  const hasFields = Object.keys(passportData || {}).length > 0;
  const isProcessing = isUploading || isPolling;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground">Upload Your Passport</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clear photo or scan. We'll automatically read the details for you.
        </p>
      </div>

      {/* ── Upload area ── */}
      {!hasFields && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Drop zone */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center p-10 sm:p-14 text-center transition-colors cursor-pointer min-h-[220px]",
              isDragActive ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-muted/30 hover:bg-muted/50",
            )}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
            onClick={() => !file && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            {/* Preview or placeholder */}
            {previewUrl ? (
              <div className="relative mb-4">
                <img src={previewUrl} alt="Passport preview" className="max-h-64 rounded-xl object-contain shadow-sm" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="absolute -right-2 -top-2 rounded-full bg-card border border-border p-1 shadow-sm hover:bg-muted transition"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Camera className="h-9 w-9 sm:hidden" />
                <UploadCloud className="hidden sm:block h-9 w-9" />
              </div>
            )}

            {!file && (
              <>
                <p className="text-base font-semibold text-foreground">
                  <span className="sm:hidden">Tap to take photo or choose file</span>
                  <span className="hidden sm:inline">Drop your passport here or click to browse</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPEG, or PDF • Must have 18+ months validity</p>
              </>
            )}

            {file && !isProcessing && (
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            )}
          </div>

          {/* Action bar */}
          {file && (
            <div className="border-t border-border px-4 py-3 sm:px-6">
              {isProcessing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading your passport…
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.max(8, progressValue)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{stepText}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setFile(null)} className="text-sm text-muted-foreground hover:text-foreground transition">
                    Choose different file
                  </button>
                  <button type="button" onClick={handleUpload}
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]">
                    Upload & Read Passport
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Extracted fields (shown after successful parse) ── */}
      {hasFields && (
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-5 py-4 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <p className="text-base font-medium text-emerald-800 dark:text-emerald-200">
              Passport details extracted! Review and correct below.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {PASSPORT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <label htmlFor={`pp-${f.key}`} className="block text-sm font-semibold text-foreground">{f.label}</label>
                <input
                  id={`pp-${f.key}`}
                  type={f.type}
                  value={passportData?.[f.key] || ""}
                  onChange={(e) => handleFieldChange(f.key, e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 transition"
                />
              </div>
            ))}
          </div>

          <button type="button" onClick={() => { onPassportChange({}); setFile(null); }}
            className="text-xs text-muted-foreground hover:text-foreground transition">
            ↻ Re-upload passport
          </button>
        </div>
      )}
    </div>
  );
}
