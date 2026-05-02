import { useState } from "react";
import { IdCard, FolderUp, UserCircle, ClipboardCheck, Loader2 } from "lucide-react";
import { StepIndicator, WizardNavigation } from "@/components/ui/step-wizard";
import { SuccessScreen } from "@/components/ui/success-screen";
import { useToast } from "@/components/ui/toast";
import { createWorkerProfile } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";

import PassportStep from "./steps/PassportStep";
import SupportingDocsStep from "./steps/SupportingDocsStep";
import PersonalDetailsStep from "./steps/PersonalDetailsStep";
import ReviewStep from "./steps/ReviewStep";

const INITIAL_PERSONAL = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  nationality: "",
  height_cm: "",
  weight_kg: "",
  marital_status: "",
  father_name: "",
  mother_name: "",
  spouse_name: "",
  permanent_address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  education_history: "",
  has_travel_history: "",
  travel_history_details: "",
  sector: "Manufacturing",
  permit_class: "PLKS",
  employment_date: "",
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

  // ── Wizard state ──
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Step 1: passport data (flat key-value from OCR or manual edit)
  const [passportData, setPassportData] = useState({});

  // Step 2: supporting doc upload metadata
  const [supportingDocs, setSupportingDocs] = useState({
    passport_photo: null,
    biometric_health: null,
    verified_signature: null,
    academic_transcripts: null,
    degree_certificates: null,
    cv: null,
  });

  // Step 3: personal details
  const [personalDetails, setPersonalDetails] = useState(INITIAL_PERSONAL);
  const [employmentHistory, setEmploymentHistory] = useState([""]);
  const [childrenList, setChildrenList] = useState([]);

  // ── Step completeness ──
  const hasPassport = !!(passportData?.full_name || passportData?.passport_number);
  const hasRequiredDocs = !!(supportingDocs.passport_photo && supportingDocs.biometric_health && supportingDocs.verified_signature);
  const hasPersonal = !!(personalDetails.full_name && personalDetails.nationality);

  const steps = STEP_DEFS.map((def, i) => ({
    ...def,
    isComplete: i === 0 ? hasPassport : i === 1 ? hasRequiredDocs : i === 2 ? hasPersonal : false,
  }));

  // ── Submit handler — exact same payload shape as original ──
  const handleSubmit = async () => {
    const workerPayload = {
      passport: passportData,
      medical_information: supportingDocs.biometric_health || null,
      general_information: {
        ...personalDetails,
        employment_history: employmentHistory,
        children: childrenList,
      },
    };

    setIsSubmitting(true);
    try {
      const response = await createWorkerProfile(workerPayload);
      setWorkerId(response.worker_id);
      setIsSubmitted(true);
      toast({
        title: "Submitted for review",
        description: "Your information has been saved and is waiting for admin confirmation.",
        variant: "success",
      });
    } catch (error) {
      console.error("Create worker error:", error);
      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ──
  if (isSubmitted) {
    return (
      <div className="permit-surface">
        <SuccessScreen
          title="Application Submitted!"
          description="Your documents and personal details have been sent to your employer for review. You can check the status in the 'My Status' tab."
          action={
            <a
              href="/worker/status"
              className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Check My Status →
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="permit-surface px-5 py-5 sm:px-6">
        <h2 className="text-xl font-heading font-semibold text-foreground">Upload Your Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete each step to submit your application. You can go back and edit any step.
        </p>

        {/* Step indicator */}
        <div className="mt-4">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
        </div>
      </section>

      {/* Step content */}
      <section className="permit-surface px-5 py-6 sm:px-6">
        {/* Mobile step label */}
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
          Step {currentStep + 1} of {STEP_DEFS.length} — {STEP_DEFS[currentStep].label}
        </p>

        {currentStep === 0 && (
          <PassportStep passportData={passportData} onPassportChange={setPassportData} />
        )}

        {currentStep === 1 && (
          <SupportingDocsStep supportingDocs={supportingDocs} onDocUploaded={setSupportingDocs} />
        )}

        {currentStep === 2 && (
          <PersonalDetailsStep
            data={personalDetails}
            onChange={setPersonalDetails}
            employmentHistory={employmentHistory}
            onEmploymentChange={setEmploymentHistory}
            children={childrenList}
            onChildrenChange={setChildrenList}
          />
        )}

        {currentStep === 3 && (
          <ReviewStep
            passportData={passportData}
            supportingDocs={supportingDocs}
            personalDetails={personalDetails}
            employmentHistory={employmentHistory}
            children={childrenList}
            onGoToStep={setCurrentStep}
          />
        )}

        {/* Navigation */}
        {currentStep < 3 ? (
          <WizardNavigation
            currentStep={currentStep}
            totalSteps={4}
            onBack={() => setCurrentStep((s) => s - 1)}
            onNext={() => setCurrentStep((s) => s + 1)}
          />
        ) : (
          /* Submit button on review step */
          <div className="flex items-center justify-between gap-3 pt-6">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </span>
              ) : (
                "Submit Application"
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
