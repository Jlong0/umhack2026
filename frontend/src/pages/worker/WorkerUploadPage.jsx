/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { IdCard, FolderUp, UserCircle, ClipboardCheck, Loader2, CheckCircle2 } from "lucide-react";
import { StepIndicator, WizardNavigation } from "@/components/ui/step-wizard";
import { SuccessScreen } from "@/components/ui/success-screen";
import { useNavigate } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import ParsedForm from "@/components/ParsedForm";
import { useToast } from "@/components/ui/toast";
import { useParseJobPolling } from "@/hooks/useParseJobPolling";
import {ApiError, confirmDocument, createWorkerProfile, startComplianceWorkflow, uploadDocument} from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

import PassportStep from "./steps/PassportStep";
import SupportingDocsStep from "./steps/SupportingDocsStep";
import PersonalDetailsStep from "./steps/PersonalDetailsStep";
import ReviewStep from "./steps/ReviewStep";

const PASSPORT_FIELDS = [
  { key: "full_name", label: "Full Name", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "sex", label: "Sex", type: "text" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "passport_number", label: "Passport Number", type: "text" },
  { key: "issue_date", label: "Passport Issue Date", type: "date" },
  { key: "expiry_date", label: "Passport Expiry Date", type: "date" },
];

const INITIAL_PERSONAL = {
  full_name: "", date_of_birth: "", gender: "", nationality: "",
  height_cm: "", weight_kg: "", marital_status: "",
  father_name: "", mother_name: "", spouse_name: "",
  address: "", emergency_contact_name: "", emergency_contact_phone: "",
  education_history: "", has_travel_history: "", travel_history_details: "",
  sector: "Manufacturing", permit_class: "PLKS", employment_date: "",
};

const STEP_DEFS = [
  { label: "Passport", icon: IdCard },
  { label: "Documents", icon: FolderUp },
  { label: "Details", icon: UserCircle },
  { label: "Review", icon: ClipboardCheck },
];

function normalizeInitialValues(parsedFields) {
  return Object.fromEntries(
    Object.entries(parsedFields || {}).map(([fieldKey, fieldData]) => [fieldKey, fieldData?.value || ""]),
  );
}

function PersonalInput({ label, field, full, formValues, onChange }) {
  const inputClasses =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";


  return (
    <div className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <label
        htmlFor={`personal-${field}`}
        className="text-xs font-medium text-slate-600"
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
      <h3 className="text-lg font-semibold text-slate-900">
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

  const user = useAuthStore((state) => state.user);
  const workerId = user?.id;
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

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [passportData, setPassportData] = useState({});
  const [supportingDocs, setSupportingDocs] = useState({
    passport_photo: null, biometric_health: null, verified_signature: null,
    academic_transcripts: null, degree_certificates: null, cv: null,
  });
  const [personalDetails, setPersonalDetails] = useState(INITIAL_PERSONAL);
  const [employmentHistory, setEmploymentHistory] = useState([""]);
  const [childrenList, setChildrenList] = useState([]);

  const hasPassport = !!(passportData?.full_name || passportData?.passport_number);
  const hasRequiredDocs = !!(supportingDocs.passport_photo && supportingDocs.biometric_health && supportingDocs.verified_signature);
  const hasPersonal = !!(personalDetails.full_name && personalDetails.nationality);

  const steps = STEP_DEFS.map((def, i) => ({
    ...def,
    isComplete: i === 0 ? hasPassport : i === 1 ? hasRequiredDocs : i === 2 ? hasPersonal : false,
  }));

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

  const handleSubmit = async () => {
    if (!workerId) {
      toast({
        title: "Missing worker ID",
        description: "Please log in again before submitting.",
        variant: "destructive",
      });
      return;
    }

    const workerPayload = {
      worker_id: workerId,

      passport: passportData || {},

      medical_information: supportingDocs.biometric_health
        ? {
            ...supportingDocs.biometric_health,
            document_type: "medical_record",
            source: "raw_file",
          }
        : {},

      general_information: {
        ...personalDetails,
        employment_history: employmentHistory,
        children: childrenList,
      },
    };

    console.log("Worker payload:", workerPayload);

    setIsSubmitting(true);

    try {
      const response = await createWorkerProfile(workerPayload);

      setWorkerId(response.worker_id);
      setIsSubmitted(true);

      toast({
        title:
          response.data_status === "complete"
            ? "Submitted for admin review"
            : "Progress saved",
        description:
          response.data_status === "complete"
            ? "Worker information has been saved and is waiting for admin confirmation."
            : "Some required information is still missing. Please complete the remaining sections.",
        variant: "success",
      });
    } catch (error) {
      console.error("Create worker error:", error);

      toast({
        title: "Submission failed",
        description:
          error.message || "Unable to submit worker for review.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  if (isSubmitted) {
    return (
      <div className="permit-surface">
        <SuccessScreen
          title="Application Submitted!"
          description="Your documents and personal details have been sent to your employer for review. You can check the status in the 'My Status' tab."
          action={
            <a href="/worker/status" className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500">
              Check My Status →
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Progress header — sits outside the card for visual clarity ── */}
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-bold text-foreground">Upload Your Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete each step to submit your application.
        </p>

        {/* Step indicator — prominent, full width */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <StepIndicator steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />


        </div>
      </div>

      {/* ── Step content ── */}
      <div>
        {/* Mobile step label */}
        <div className="mb-5 flex items-center gap-2 sm:hidden">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
            {currentStep + 1}
          </span>
          <span className="text-sm font-semibold text-foreground">{STEP_DEFS[currentStep].label}</span>
        </div>

        {currentStep === 0 && <PassportStep passportData={passportData} onPassportChange={setPassportData} />}
        {currentStep === 1 && <SupportingDocsStep supportingDocs={supportingDocs} onDocUploaded={setSupportingDocs} />}
        {currentStep === 2 && (
          <PersonalDetailsStep
            data={personalDetails} onChange={setPersonalDetails}
            employmentHistory={employmentHistory} onEmploymentChange={setEmploymentHistory}
            children={childrenList} onChildrenChange={setChildrenList}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            passportData={passportData} supportingDocs={supportingDocs}
            personalDetails={personalDetails} employmentHistory={employmentHistory}
            children={childrenList} onGoToStep={setCurrentStep}
          />
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="mt-14 space-y-4">
        {/* Step navigation */}
        <div className="flex items-center justify-between gap-3">
          {currentStep > 0 ? (
            <button type="button" onClick={() => setCurrentStep((s) => s - 1)}
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
              ← Back
            </button>
          ) : <div />}
          {currentStep < 3 && (
            <button type="button" onClick={() => setCurrentStep((s) => s + 1)}
              className="rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]">
              Continue →
            </button>
          )}
        </div>

        {/* Green submit button — always visible */}
        <div className="border-t border-border pt-4">
          <button type="button" onClick={handleSubmit} disabled={isSubmitting}
            className="w-full rounded-xl bg-emerald-600 px-8 py-4 text-base font-bold text-white shadow-md transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</span>
            ) : "Create Worker Profile ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
