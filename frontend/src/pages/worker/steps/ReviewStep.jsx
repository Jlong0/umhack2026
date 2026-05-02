import { CheckCircle2, AlertCircle, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

function SummaryCard({ title, icon: Icon, isComplete, onEdit, children }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 transition",
      isComplete ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete
            ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          }
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition dark:text-indigo-400 dark:hover:bg-indigo-950">
            <Edit3 className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function ReviewStep({ passportData, supportingDocs, personalDetails, employmentHistory, children, onGoToStep }) {
  const hasPassport = !!(passportData?.full_name || passportData?.passport_number);

  const requiredDocs = ["passport_photo", "biometric_health", "verified_signature"];
  const uploadedRequired = requiredDocs.filter((k) => supportingDocs[k]).length;
  const allRequiredUploaded = uploadedRequired === requiredDocs.length;
  const totalUploaded = Object.values(supportingDocs).filter(Boolean).length;

  const hasPersonalRequired = !!(personalDetails?.full_name && personalDetails?.nationality);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground">Review Your Information</h3>
        <p className="mt-1 text-sm text-muted-foreground">Check everything looks correct before submitting.</p>
      </div>

      {/* Passport summary */}
      <SummaryCard title="Passport" isComplete={hasPassport} onEdit={() => onGoToStep(0)}>
        {hasPassport ? (
          <div className="space-y-0.5">
            <DataRow label="Full Name" value={passportData.full_name} />
            <DataRow label="Passport No." value={passportData.passport_number} />
            <DataRow label="Nationality" value={passportData.nationality} />
            <DataRow label="Date of Birth" value={passportData.date_of_birth} />
            <DataRow label="Expiry" value={passportData.expiry_date} />
          </div>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300">Please upload your passport in Step 1.</p>
        )}
      </SummaryCard>

      {/* Supporting docs summary */}
      <SummaryCard title="Supporting Documents" isComplete={allRequiredUploaded} onEdit={() => onGoToStep(1)}>
        <p className="text-xs text-muted-foreground">
          {totalUploaded} of {requiredDocs.length} required documents uploaded
          {totalUploaded > requiredDocs.length ? ` (+ ${totalUploaded - requiredDocs.length} optional)` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { key: "passport_photo", label: "Photo" },
            { key: "biometric_health", label: "Health" },
            { key: "verified_signature", label: "Signature" },
            { key: "academic_transcripts", label: "Transcripts" },
            { key: "degree_certificates", label: "Degree" },
            { key: "cv", label: "CV" },
          ].map((d) => (
            <span
              key={d.key}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                supportingDocs[d.key]
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {supportingDocs[d.key] ? "✓" : "○"} {d.label}
            </span>
          ))}
        </div>
      </SummaryCard>

      {/* Personal details summary */}
      <SummaryCard title="Personal Details" isComplete={hasPersonalRequired} onEdit={() => onGoToStep(2)}>
        {hasPersonalRequired ? (
          <div className="space-y-0.5">
            <DataRow label="Full Name" value={personalDetails.full_name} />
            <DataRow label="Gender" value={personalDetails.gender} />
            <DataRow label="Nationality" value={personalDetails.nationality} />
            <DataRow label="Address" value={personalDetails.permanent_address} />
            <DataRow label="Emergency Contact" value={personalDetails.emergency_contact_name} />
            <DataRow label="Sector" value={personalDetails.sector} />
            {employmentHistory.filter(Boolean).length > 0 && (
              <DataRow label="Employment" value={employmentHistory.filter(Boolean).join(", ")} />
            )}
            {children.length > 0 && (
              <DataRow label="Children" value={`${children.length} listed`} />
            )}
          </div>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300">Please fill in your personal details in Step 3.</p>
        )}
      </SummaryCard>
    </div>
  );
}
