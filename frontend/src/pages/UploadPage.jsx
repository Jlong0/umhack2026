/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import ParsedForm from "@/components/ParsedForm";
import { useToast } from "@/components/ui/toast";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";
import { ApiError, confirmDocument, startComplianceWorkflow, uploadDocument } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";

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

  const [selectedFile, setSelectedFile] = useState(null);
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
      description: "Unable to read parse job status. Please retry the upload.",
      variant: "destructive",
    });
  }, [pollError, toast]);

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
      return;
    }

    setIsUploading(true);

    try {
      const response = await uploadDocument(selectedFile, "passport");
      setParsedFields({});
      setJobContext({
        jobId: response.job_id,
        documentId: response.document_id,
      });

      toast({
        title: "Document uploaded",
        description: "Parsing job queued. Agent extraction has started.",
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

        <div className="space-y-6">
          <FileUpload
            file={selectedFile}
            onFileSelect={setSelectedFile}
            onUpload={handleUpload}
            isUploading={isUploading}
            isPolling={isPolling}
            progressValue={progressValue}
            stepText={stepText}
          />

          <ParsedForm
            parsedFields={parsedFields}
            formValues={formValues}
            onFieldChange={(fieldKey, nextValue) => {
              setFormValues((current) => ({ ...current, [fieldKey]: nextValue }));
              updateParsedField(fieldKey, nextValue);
            }}
            onConfirm={handleConfirm}
            isConfirming={isConfirming}
          />
        </div>
      </section>
    </div>
  );
}
