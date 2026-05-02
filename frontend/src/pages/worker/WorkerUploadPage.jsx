import { useState } from "react";
import { IdCard, FolderUp, UserCircle, ClipboardCheck, Loader2, CheckCircle2 } from "lucide-react";
import { StepIndicator, WizardNavigation } from "@/components/ui/step-wizard";
import { SuccessScreen } from "@/components/ui/success-screen";
import { useToast } from "@/components/ui/toast";
import { createWorkerProfile } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";
import { cn } from "@/lib/utils";

import PassportStep from "./steps/PassportStep";
import SupportingDocsStep from "./steps/SupportingDocsStep";
import PersonalDetailsStep from "./steps/PersonalDetailsStep";
import ReviewStep from "./steps/ReviewStep";

const INITIAL_PERSONAL = {
  full_name: "", date_of_birth: "", gender: "", nationality: "",
  height_cm: "", weight_kg: "", marital_status: "",
  father_name: "", mother_name: "", spouse_name: "",
  permanent_address: "", emergency_contact_name: "", emergency_contact_phone: "",
  education_history: "", has_travel_history: "", travel_history_details: "",
  sector: "Manufacturing", permit_class: "PLKS", employment_date: "",
};

const STEP_DEFS = [
  { label: "Passport", icon: IdCard },
  { label: "Documents", icon: FolderUp },
  { label: "Details", icon: UserCircle },
  { label: "Review", icon: ClipboardCheck },
];

export default function WorkerUploadPage() {
  const { toast } = useToast();
  const setWorkerId = useWorkerStore((s) => s.setWorkerId);

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

  // Exact same payload shape as original — no backend changes
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await createWorkerProfile({
        passport: passportData,
        medical_information: supportingDocs.biometric_health || null,
        general_information: { ...personalDetails, employment_history: employmentHistory, children: childrenList },
      });
      setWorkerId(response.worker_id);
      setIsSubmitted(true);
      toast({ title: "Submitted for review", description: "Your information has been saved and is waiting for admin confirmation.", variant: "success" });
    } catch (error) {
      console.error("Create worker error:", error);
      toast({ title: "Submission failed", description: typeof error.message === "string" ? error.message : Array.isArray(error.message) ? error.message.map((e) => (typeof e === "object" ? e.msg || JSON.stringify(e) : e)).join(", ") : "Unable to submit. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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

          {/* Progress summary chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {steps.map((step, i) => (
              <button
                key={step.label}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  i === currentStep && "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-700",
                  i !== currentStep && step.isComplete && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                  i !== currentStep && !step.isComplete && "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {step.isComplete ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                {step.label}
              </button>
            ))}
          </div>
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
      <div className="mt-8 space-y-4">
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
