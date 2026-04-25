/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { uploadDocument, getDocumentFields } from "@/services/api";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";
import { useWorkerStore } from "@/store/useWorkerStore";

const DOCUMENT_TYPES = [
  { value: "passport",            label: "Passport (Bio-data Page)" },
  { value: "biomedical_slip",     label: "Bio-Medical Slip" },
  { value: "borang100",           label: "Security Vetting — Borang 100" },
  { value: "personal_demographic",label: "Personal & Demographic" },
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export default function WorkerUploadPage() {
  const [docType, setDocType] = useState("passport");
  const [file, setFile] = useState(null);

  const jobId = useWorkerStore((s) => s.jobId);
  const parsedFields = useWorkerStore((s) => s.parsedFields);
  const setJobContext = useWorkerStore((s) => s.setJobContext);
  const setParsedFields = useWorkerStore((s) => s.setParsedFields);

  const { isPolling, stepText } = useParseJobPolling(jobId);

  const handleDocTypeChange = (val) => {
    setDocType(val);
    setFile(null);
    setParsedFields({});
    setJobContext({ jobId: null, documentId: null });
  };

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Document Upload</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select the document type and upload the required file. Extracted data is read-only.
        </p>
      </section>

      <section className="permit-surface p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Type</label>
          <select
            value={docType}
            onChange={(e) => handleDocTypeChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {docType === "personal_demographic" ? (
          <PersonalDemographicForm />
        ) : (
          <DocumentUploadSection
            docType={docType}
            file={file}
            setFile={setFile}
            isPolling={isPolling}
            stepText={stepText}
            parsedFields={parsedFields}
            setJobContext={setJobContext}
            setParsedFields={setParsedFields}
          />
        )}
      </section>
    </div>
  );
}

function DocumentUploadSection({ docType, file, setFile, isPolling, stepText, parsedFields, setJobContext, setParsedFields }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [expectedFields, setExpectedFields] = useState([]);

  useEffect(() => {
    getDocumentFields(docType).then((r) => setExpectedFields(r.fields || [])).catch(() => setExpectedFields([]));
  }, [docType]);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadDocument(file, docType);
      setParsedFields({});
      setJobContext({ jobId: res.job_id, documentId: res.document_id });
      toast({ title: "Uploaded", description: "Extraction started.", variant: "success" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const extractedEntries = Object.entries(parsedFields || {});
  const hasEmptyField = extractedEntries.some(([, v]) => !v?.value);
  const extractionDone = extractedEntries.length > 0 && !isPolling;

  return (
    <div className="space-y-4">
      {expectedFields.length > 0 && !extractionDone && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields to be extracted</p>
          <ul className="space-y-1">
            {expectedFields.map((f) => (
              <li key={f.key} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-6 text-center",
          isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50/70",
        )}
        onDrop={(e) => { e.preventDefault(); setIsDragActive(false); const f = e.dataTransfer?.files?.[0]; if (f) setFile(f); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
      >
        <input ref={inputRef} type="file" className="hidden" accept="image/png,image/jpeg,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          Drop file here or{" "}
          <button type="button" className="text-indigo-700 underline-offset-2 hover:underline"
            onClick={() => inputRef.current?.click()}>browse device</button>
        </p>
        <p className="mt-2 text-xs text-slate-500">Accepted: PNG, JPEG, PDF</p>
      </div>

      {file && (
        <div className="space-y-3">
          {previewUrl && (
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button type="button" onClick={handleUpload} disabled={isUploading || isPolling}
              className="rounded-lg bg-indigo-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50">
              {isUploading ? "Uploading…" : isPolling ? "Extracting…" : "Upload"}
            </button>
          </div>
        </div>
      )}

      {isPolling && (
        <p className="text-xs text-indigo-600 animate-pulse">{stepText}</p>
      )}

      {extractionDone && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Extracted — read only</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {extractedEntries.map(([key, data]) => (
              <div key={key} className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 capitalize">{key.replace(/_/g, " ")}</label>
                <input type="text" value={data?.value || ""} readOnly
                  className={cn("w-full rounded-lg border px-3 py-2 text-sm cursor-not-allowed focus:outline-none",
                    data?.value ? "border-slate-200 bg-white text-slate-700" : "border-red-200 bg-red-50 text-red-400")} />
              </div>
            ))}
          </div>
          {hasEmptyField && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Some fields could not be extracted. Please send a copy of this document to your admin for manual entry.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonalDemographicForm() {
  const { toast } = useToast();
  const [hasTravelHistory, setHasTravelHistory] = useState("");
  const [employmentHistory, setEmploymentHistory] = useState([""]);
  const [childrenList, setChildrenList] = useState([]);

  const inputClasses = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Fill in your personal and demographic details below.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Marital Status</label>
          <select className={inputClasses} defaultValue="">
            <option value="" disabled>Select</option>
            <option>Single</option><option>Married</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Father's Name</label>
          <input type="text" placeholder="Father's Name" className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Mother's Name</label>
          <input type="text" placeholder="Mother's Name" className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Spouse's Name (Optional)</label>
          <input type="text" placeholder="Spouse's Name" className={inputClasses} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600">Children (Optional)</label>
            <button type="button" onClick={() => setChildrenList([...childrenList, { name: "", age: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">
              <Plus className="h-3.5 w-3.5" /> Add Child
            </button>
          </div>
          {childrenList.map((child, i) => (
            <div key={i} className="flex gap-2 items-center mt-2">
              <input type="text" placeholder={`Child ${i + 1} Name`} className={cn(inputClasses, "flex-1")}
                value={child.name} onChange={(e) => { const l = [...childrenList]; l[i].name = e.target.value; setChildrenList(l); }} />
              <input type="number" min="0" placeholder="Age" className={cn(inputClasses, "w-24")}
                value={child.age} onChange={(e) => { const l = [...childrenList]; l[i].age = e.target.value; setChildrenList(l); }} />
              <button type="button" onClick={() => setChildrenList(childrenList.filter((_, j) => j !== i))}
                className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Permanent Home Address</label>
          <input type="text" placeholder="Permanent Home Address" className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Emergency Contact Name</label>
          <input type="text" placeholder="Emergency Contact Name" className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Emergency Contact Phone</label>
          <input type="text" placeholder="Phone Number" className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Education Level</label>
          <select className={inputClasses} defaultValue="">
            <option value="" disabled>Select</option>
            <option>Primary School</option><option>Secondary/High School</option>
            <option>Bachelor's Degree</option><option>Master's Degree</option><option>Other</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Past Overseas Travel History</label>
          <select className={inputClasses} value={hasTravelHistory} onChange={(e) => setHasTravelHistory(e.target.value)}>
            <option value="" disabled>Select</option>
            <option>Yes</option><option>No</option>
          </select>
        </div>
        {hasTravelHistory === "Yes" && (
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Travel History Details</label>
            <input type="text" placeholder="Specify past overseas travel" className={inputClasses} />
          </div>
        )}
      </div>
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-medium text-slate-600">Employment History</label>
        {employmentHistory.map((emp, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="text" placeholder={`Job ${i + 1}`} className={inputClasses}
              value={emp} onChange={(e) => { const h = [...employmentHistory]; h[i] = e.target.value; setEmploymentHistory(h); }} />
            {employmentHistory.length > 1 && (
              <button type="button" onClick={() => setEmploymentHistory(employmentHistory.filter((_, j) => j !== i))}
                className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setEmploymentHistory([...employmentHistory, ""])}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100">
          <Plus className="h-3.5 w-3.5" /> Add Job
        </button>
      </div>
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button type="button"
          onClick={() => toast({ title: "Saved", description: "Personal details saved.", variant: "success" })}
          className="rounded-lg bg-indigo-700 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
          Submit
        </button>
      </div>
    </div>
  );
}
