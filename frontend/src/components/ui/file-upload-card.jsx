import { useRef, useState, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadDocument } from "@/services/api";
import { useToast } from "@/components/ui/toast";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** exp;
  return `${val.toFixed(val >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

/**
 * FileUploadCard — Mobile-first document upload card.
 *
 * Handles the full lifecycle: empty → file selected → uploading → success.
 * Calls `uploadDocument` from the existing API service — no backend changes.
 *
 * @param {string}   docType       - Document type key sent to backend (e.g. "passport_photo")
 * @param {string}   label         - Human-readable label
 * @param {string}   [description] - Helper text / requirements
 * @param {boolean}  [required]    - Shows required badge
 * @param {string}   [accept]      - File input accept attribute
 * @param {(meta: object) => void} [onUploaded] - Called with upload metadata on success
 * @param {object}   [uploadedMeta] - If set, card renders in "complete" state
 */
function FileUploadCard({
  docType,
  label,
  description,
  required = false,
  accept = "image/png,image/jpeg,application/pdf",
  onUploaded,
  uploadedMeta = null,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { toast } = useToast();

  const isComplete = !!uploadedMeta;

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    setPreviewUrl(null);
    return undefined;
  }, [file]);

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
      const response = await uploadDocument(file, docType);
      const meta = {
        source: "raw_file",
        document_id: response.document_id,
        storage_path: response.storage_path,
        document_type: docType,
        filename: file.name,
        content_type: file.type,
      };
      onUploaded?.(meta);
      toast({ title: "File uploaded", description: `${label} uploaded successfully.`, variant: "success" });
    } catch (error) {
      toast({ title: "Upload failed", description: error.message || "Could not upload file. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Complete state ──
  if (isComplete) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{label}</p>
            <p className="truncate text-xs text-emerald-600 dark:text-emerald-400">
              {uploadedMeta.filename || "Uploaded"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onUploaded?.(null); setFile(null); }}
            className="rounded-lg px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            Replace
          </button>
        </div>
      </div>
    );
  }

  // ── File selected: show preview + upload button ──
  if (file) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>

        {previewUrl && (
          <div className="flex justify-center overflow-hidden rounded-xl border border-border bg-muted p-2">
            <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg object-contain" />
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFile(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </span>
              ) : (
                "Upload"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state: drop zone ──
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {required && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Required
          </span>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}

      <div
        className={cn(
          "mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          isDragActive
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
            : "border-border bg-muted/40 hover:border-indigo-300 hover:bg-muted/70 dark:hover:border-indigo-700",
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
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <Camera className="h-5 w-5 sm:hidden" />
          <UploadCloud className="hidden sm:block h-5 w-5" />
        </div>

        <p className="text-sm font-medium text-foreground sm:hidden">Tap to choose file</p>
        <p className="hidden sm:block text-sm font-medium text-foreground">
          Drop file here or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or PDF</p>
      </div>
    </div>
  );
}

export { FileUploadCard };
