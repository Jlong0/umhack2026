import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "passport_photo", label: "Passport Size Photo" },
  { value: "biometric_health", label: "Biometric & Health Proof" },
  { value: "personal_demographic", label: "Personal & Demographic" },
];

const PERSONAL_DEMOGRAPHIC_FIELDS = [
  { key: "marital_status", label: "Marital Status" },
  { key: "dependents_details", label: "Dependents Details" },
  { key: "permanent_home_address", label: "Permanent Home Address" },
  { key: "emergency_contact_name", label: "Emergency Contact Name" },
  { key: "emergency_contact_phone", label: "Emergency Contact Phone Number" },
  { key: "family_background", label: "Family Background" },
  { key: "education_history", label: "Education History" },
  { key: "employment_history", label: "Employment History" },
  { key: "past_overseas_travel_history", label: "Past Overseas Travel History" },
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** exp;
  return `${val.toFixed(val >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export default function WorkerUploadPage() {
  const [docType, setDocType] = useState("passport");
  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  const isPhotoType = docType !== "personal_demographic";

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) setFile(dropped);
  };

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Document Upload</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select the document type and upload the required file or fill in your details.
        </p>
      </section>

      <section className="permit-surface p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Type</label>
          <select
            value={docType}
            onChange={(e) => { setDocType(e.target.value); setFile(null); }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isPhotoType ? (
          <PhotoUpload
            file={file}
            setFile={setFile}
            isDragActive={isDragActive}
            setIsDragActive={setIsDragActive}
            inputRef={inputRef}
            handleDrop={handleDrop}
          />
        ) : (
          <PersonalDemographicForm />
        )}
      </section>
    </div>
  );
}

function PhotoUpload({ file, setFile, isDragActive, setIsDragActive, inputRef, handleDrop }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "node-transition rounded-xl border-2 border-dashed p-6 text-center",
          isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50/70",
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
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
        <p className="mt-2 text-xs text-slate-500">Accepted: PNG, JPEG, PDF</p>
      </div>

      {file && (
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
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Upload
          </button>
        </div>
      )}
    </div>
  );
}

function PersonalDemographicForm() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Fill in your personal and demographic details below.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {PERSONAL_DEMOGRAPHIC_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">{field.label}</label>
            <input
              type="text"
              placeholder={field.label}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
