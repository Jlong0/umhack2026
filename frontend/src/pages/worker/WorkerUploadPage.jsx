/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import ParsedForm from "@/components/ParsedForm";
import { useToast } from "@/components/ui/toast";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";
import { ApiError, confirmDocument, startComplianceWorkflow, uploadDocument } from "@/services/api";
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

    setParsedFieldsByType((current) => ({
      ...current,
      [selectedDocumentType]: parsedFields,
    }));

    setFormValuesByType((current) => ({
      ...current,
      [selectedDocumentType]: normalizeInitialValues(parsedFields),
    }));
  }, [parsedFields, selectedDocumentType]);

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

    setIsUploading(true);

    try {
      const response = await uploadDocument(selectedFile, selectedDocumentType);

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
    console.log(formValues)
    if (!documentId) {
      return;
    }

    setIsConfirming(true);

    try {
      const response = await confirmDocument(documentId, formValues);
      setWorkerId(response.worker_id);

      // Start backend workflow immediately so the visualizer has live state to show.
      await startComplianceWorkflow(response.worker_id, {
        ...formValues,
        worker_id: response.worker_id,
        full_name: formValues.full_name || formValues.name || "Unknown Worker",
        name: formValues.name || formValues.full_name || "Unknown Worker",
        nationality: formValues.nationality || "Unknown",
      });

      toast({
        title: "Worker profile created",
        description: "Obligations generated and workflow started. Opening workflow visualizer...",
        variant: "success",
      });

      navigate(`/workflows/${response.worker_id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 500) {
        toast({
          title: "Error",
          description:
            "Failed to start workflow after confirmation. Check backend logs for workflow initialization error.",
          variant: "destructive",
          duration: 7000,
        });
      } else {
        toast({
          title: "Confirmation failed",
          description: error.message || "Unable to confirm document right now.",
          variant: "destructive",
        });
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const previewContent = (() => {
    if (!previewUrl) {
      return (
        <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
          Upload a file to see its preview.
        </div>
      );
    }

    if (selectedFile?.type === "application/pdf") {
      return (
        <iframe
          title="Document preview"
          src={previewUrl}
          className="h-[420px] w-full rounded-xl border border-slate-200"
        />
      );
    }

    return (
      <img
        src={previewUrl}
        alt="Uploaded document preview"
        className="h-[420px] w-full rounded-xl border border-slate-200 object-contain bg-white"
      />
    );
  })();

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Document Ingestion & HITL Triage</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload documents, monitor extraction progress, and confirm fields before obligations are generated.
        </p>
        {jobId ? (
          <p className="mt-2 font-mono text-xs text-slate-500">
            Job ID: {jobId} | Document ID: {documentId || "pending"}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_1fr]">
        <article className="permit-surface p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">Document Preview</h3>
          <p className="mt-1 text-sm text-slate-600">Left pane mirrors the uploaded artifact for side-by-side triage.</p>
          <div className="mt-4">{previewContent}</div>
        </article>

        <div className="permit-surface p-5 sm:p-6">
          <label className="text-sm font-medium text-slate-700">
            Select document type
          </label>

          <select
            value={selectedDocumentType}
            onChange={(e) => setSelectedDocumentType(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="passport">Passport</option>
            <option value="health_checkup">Health Checkup</option>
            <option value="personal_demographic">Personal Demographic</option>
          </select>
        </div>

        <div className="space-y-6">
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
          {selectedDocumentType === "passport" && (
            <div className="permit-surface p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Passport Information
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PASSPORT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label
                      htmlFor={`passport-${field.key}`}
                      className="block text-xs font-medium text-slate-600"
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
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />

                    {parsedFieldsByType.passport?.[field.key]?.confidence != null && (
                      <p className="text-[10px] text-slate-400">
                        confidence:{" "}
                        {(parsedFieldsByType.passport[field.key].confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedDocumentType !== "passport" && (
            <ParsedForm
              parsedFields={currentParsedFields}
              formValues={currentFormValues}
              onFieldChange={(fieldKey, nextValue) => {
                setFormValuesByType((current) => ({
                  ...current,
                  [selectedDocumentType]: {
                    ...current[selectedDocumentType],
                    [fieldKey]: nextValue,
                  },
                }));
              }}
              onConfirm={handleConfirm}
              isConfirming={isConfirming}
            />
          )}
        </div>

      </section>
    </div>
  );
}
