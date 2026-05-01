/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import ParsedForm from "@/components/ParsedForm";
import { useToast } from "@/components/ui/toast";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";
import {ApiError, confirmDocument, createWorkerProfile, startComplianceWorkflow, uploadDocument} from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";

const PASSPORT_FIELDS = [
  { key: "full_name", label: "Full Name", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "sex", label: "Sex", type: "text" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "passport_number", label: "Passport Number", type: "text" },
  { key: "issue_date", label: "Passport Issue Date", type: "date" },
  { key: "expiry_date", label: "Passport Expiry Date", type: "date" },
];

function normalizeInitialValues(parsedFields) {
  return Object.fromEntries(
    Object.entries(parsedFields || {}).map(([fieldKey, fieldData]) => [fieldKey, fieldData?.value || ""]),
  );
}

function PersonalInput({ label, field, full, formValues, onChange }) {
  const inputClasses =
    "w-full rounded-lg border border-border px-3 py-2 text-sm";

  return (
    <div className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <label
        htmlFor={`personal-${field}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>

      <input
        id={`personal-${field}`}
        name={field}
        type="text"
        value={formValues?.[field] || ""}
        onChange={(e) => onChange(field, e.target.value)}
        className={inputClasses}
      />
    </div>
  );
}

function PersonalDemographicForm({ formValues, onChange }) {
  return (
    <div className="permit-surface p-5 sm:p-6 space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        Personal & Demographic Information
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <PersonalInput label="Marital Status" field="marital_status" formValues={formValues} onChange={onChange} />
        <PersonalInput label="Dependent Details" field="dependent_details" formValues={formValues} onChange={onChange} />
        <PersonalInput label="Address" field="address" full formValues={formValues} onChange={onChange} />
        <PersonalInput label="Emergency Contact Name" field="emergency_contact_name" formValues={formValues} onChange={onChange} />
        <PersonalInput label="Emergency Contact Phone" field="emergency_contact_phone" formValues={formValues} onChange={onChange} />
        <PersonalInput label="Family Background" field="family_background" full formValues={formValues} onChange={onChange} />
        <PersonalInput label="Education History" field="education_history" full formValues={formValues} onChange={onChange} />
        <PersonalInput label="Employment History" field="employment_history" full formValues={formValues} onChange={onChange} />
        <PersonalInput label="Past Overseas Travel History" field="past_overseas_travel_history" full formValues={formValues} onChange={onChange} />
      </div>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const jobId = useWorkerStore((state) => state.jobId);
  const documentId = useWorkerStore((state) => state.documentId);
  const parseJobStatus = useWorkerStore((state) => state.parseJobStatus);
  const parsedFields = useWorkerStore((state) => state.parsedFields);
  const previewUrl = useWorkerStore((state) => state.documentPreviewUrl);
  const setJobContext = useWorkerStore((state) => state.setJobContext);
  const setParsedFields = useWorkerStore((state) => state.setParsedFields);
  const setWorkerId = useWorkerStore((state) => state.setWorkerId);
  const setDocumentPreviewUrl = useWorkerStore((state) => state.setDocumentPreviewUrl);
  const updateParsedField = useWorkerStore((state) => state.updateParsedField);

  const [selectedFiles, setSelectedFiles] = useState({
    passport: null,
    health_checkup: null,
    personal_demographic: null,
  });

  const [selectedDocumentType, setSelectedDocumentType] = useState("passport");

  const [parsedFieldsByType, setParsedFieldsByType] = useState({
    passport: {},
    health_checkup: {},
    personal_demographic: {},
  });

  const [formValuesByType, setFormValuesByType] = useState({
    passport: {},
    health_checkup: {},
    personal_demographic: {},
  });

  const selectedFile = selectedFiles[selectedDocumentType];
  const currentParsedFields = parsedFieldsByType[selectedDocumentType] || {};
  const currentFormValues = formValuesByType[selectedDocumentType] || {};
  const [formValues, setFormValues] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeParsingType, setActiveParsingType] = useState(null);

  const { isPolling, stepText, error: pollError } = useParseJobPolling(jobId);

  useEffect(() => {
    if (!selectedFile) {
      setDocumentPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setDocumentPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, setDocumentPreviewUrl]);

  useEffect(() => {
    setFormValues(normalizeInitialValues(parsedFields));
  }, [parsedFields]);

  useEffect(() => {
    if (!pollError) {
      return;
    }

    toast({
      title: "Polling error",
      description: pollError?.message,
      variant: "destructive",
    });
  }, [pollError, toast]);

  useEffect(() => {
    if (!parsedFields || Object.keys(parsedFields).length === 0) return;
    if (!activeParsingType) return;

    setParsedFieldsByType((current) => ({
      ...current,
      [activeParsingType]: parsedFields,
    }));

    setFormValuesByType((current) => ({
      ...current,
      [activeParsingType]: normalizeInitialValues(parsedFields),
    }));

    setActiveParsingType(null);
  }, [parsedFields, activeParsingType]);

  const progressValue = useMemo(() => {
    if (parseJobStatus === "completed") {
      return 100;
    }

    if (isPolling) {
      return 70;
    }

    if (isUploading) {
      return 24;
    }

    return 0;
  }, [isPolling, isUploading, parseJobStatus]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file before uploading.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDocumentType === "passport") {
      setActiveParsingType("passport");
    }

    setIsUploading(true);

    try {
      const response = await uploadDocument(selectedFile, selectedDocumentType);

      if (selectedDocumentType === "health_checkup") {
        setFormValuesByType((current) => ({
          ...current,
          health_checkup: {
            source: "raw_file",
            document_id: response.document_id,
            storage_path: response.storage_path,
            document_type: "medical_record",
            filename: selectedFile.name,
            content_type: selectedFile.type,
          },
        }));

        toast({
          title: "Medical file uploaded",
          description: "File location saved for later access.",
          variant: "success",
        });

        return;
      }

      setJobContext({
        jobId: response.job_id,
        documentId: response.document_id,
      });

      toast({
        title: "Document uploaded",
        description: `${selectedDocumentType} parsing job queued.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    const workerPayload = {
      passport: formValuesByType.passport,
      medical_information: formValuesByType.health_checkup,
      general_information: formValuesByType.personal_demographic,
    };

    console.log("Worker payload:", workerPayload);

    setIsConfirming(true);

    try {
      // 🔥 NEW API
      const response = await createWorkerProfile(workerPayload);

      setWorkerId(response.worker_id);

      // // 🧠 Start workflow (use flattened values)
      // await startComplianceWorkflow(response.worker_id, {
      //   ...workerPayload.passport,
      //   ...workerPayload.general_information,
      //   worker_id: response.worker_id,
      //   full_name:
      //     workerPayload.passport?.full_name ||
      //     workerPayload.general_information?.full_name ||
      //     "Unknown Worker",
      //   name:
      //     workerPayload.passport?.full_name ||
      //     "Unknown Worker",
      //   nationality:
      //     workerPayload.passport?.nationality ||
      //     "Unknown",
      // });

      toast({
        title: "Submitted for admin review",
        description:
          "Worker information has been saved and is waiting for admin confirmation",
        variant: "success",
      });
    } catch (error) {
      console.error("Create worker error:", error);

      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit worker for review.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const previewContent = (() => {
    if (!previewUrl) {
      return (
        <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-sm text-muted-foreground">
          Upload a file to see its preview.
        </div>
      );
    }

    if (selectedFile?.type === "application/pdf") {
      return (
        <iframe
          title="Document preview"
          src={previewUrl}
          className="h-[420px] w-full rounded-xl border border-border"
        />
      );
    }

    return (
      <img
        src={previewUrl}
        alt="Uploaded document preview"
        className="h-[420px] w-full rounded-xl border border-border object-contain bg-card"
      />
    );
  })();

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Document Ingestion & HITL Triage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents, monitor extraction progress, and confirm fields before obligations are generated.
        </p>
        {jobId ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Job ID: {jobId} | Document ID: {documentId || "pending"}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_1fr]">
        <article className="permit-surface p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-foreground">Document Preview</h3>
          <p className="mt-1 text-sm text-muted-foreground">Left pane mirrors the uploaded artifact for side-by-side triage.</p>
          <div className="mt-4">{previewContent}</div>
        </article>

        <div className="permit-surface p-5 sm:p-6">
          <label className="text-sm font-medium text-foreground">
            Select document type
          </label>

          <select
            value={selectedDocumentType}
            onChange={(e) => setSelectedDocumentType(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="passport">Passport</option>
            <option value="health_checkup">Health Checkup</option>
            <option value="personal_demographic">Personal & Demographic</option>
          </select>
        </div>

        <div className="space-y-6">
          {selectedDocumentType !== "personal_demographic" && (
            <FileUpload
              file={selectedFile}
              onFileSelect={(file) =>
                setSelectedFiles((current) => ({
                  ...current,
                  [selectedDocumentType]: file,
                }))
              }
              onUpload={handleUpload}
              isUploading={isUploading}
              isPolling={isPolling}
              progressValue={progressValue}
              stepText={stepText}
            />
          )}
          {selectedDocumentType === "passport" && (
            <div className="permit-surface p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Passport Information
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PASSPORT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label
                      htmlFor={`passport-${field.key}`}
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      {field.label}
                    </label>

                    <input
                      id={`passport-${field.key}`}
                      name={field.key}
                      type={field.type}
                      value={formValuesByType.passport?.[field.key] || ""}
                      onChange={(e) =>
                        setFormValuesByType((current) => ({
                          ...current,
                          passport: {
                            ...current.passport,
                            [field.key]: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                    />

                    {parsedFieldsByType.passport?.[field.key]?.confidence != null && (
                      <p className="text-[10px] text-muted-foreground">
                        confidence:{" "}
                        {(parsedFieldsByType.passport[field.key].confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedDocumentType === "health_checkup" &&
            formValuesByType.health_checkup?.storage_path && (
              <div className="permit-surface p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Medical File Saved
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  Filename: {formValuesByType.health_checkup.filename}
                </p>

                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Storage path: {formValuesByType.health_checkup.storage_path}
                </p>
              </div>
            )}
          {selectedDocumentType === "personal_demographic" && (
            <PersonalDemographicForm
              formValues={formValuesByType.personal_demographic}
              onChange={(field, value) =>
                setFormValuesByType((current) => ({
                  ...current,
                  personal_demographic: {
                    ...current.personal_demographic,
                    [field]: value,
                  },
                }))
              }
            />
          )}
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-emerald-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {isConfirming ? "Creating Worker..." : "Create Worker Profile"}
          </button>
        </div>

      </section>
    </div>
  );
}
