import { FileUploadCard } from "@/components/ui/file-upload-card";

const SUPPORTING_DOCS = [
  { key: "passport_photo", label: "Passport Size Photo", description: "35mm × 50mm on white background. No glasses, hair must not cover face.", required: true },
  { key: "biometric_health", label: "Biometric & Health Proof", description: "Medical report with physical data, vaccination history, and bio-medical reference number.", required: true },
  { key: "verified_signature", label: "Verified Signature", description: "Must match the signature in your passport.", required: true },
  { key: "academic_transcripts", label: "Academic Transcripts", description: "Certified copies, if required for your position.", required: false },
  { key: "degree_certificates", label: "Degree Certificates", description: "Certified copies, if required for your position.", required: false },
  { key: "cv", label: "Curriculum Vitae / CV", description: "Detailed CV with past work experience, if required.", required: false },
];

export default function SupportingDocsStep({ supportingDocs, onDocUploaded }) {
  const handleUploaded = (docKey, meta) => {
    onDocUploaded({ ...supportingDocs, [docKey]: meta });
  };

  const requiredDocs = SUPPORTING_DOCS.filter((d) => d.required);
  const optionalDocs = SUPPORTING_DOCS.filter((d) => !d.required);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground">Supporting Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">Upload each required document. Optional documents can be added later.</p>
      </div>

      {/* Required docs */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requiredDocs.map((doc) => (
            <FileUploadCard
              key={doc.key}
              docType={doc.key}
              label={doc.label}
              description={doc.description}
              required
              onUploaded={(meta) => handleUploaded(doc.key, meta)}
              uploadedMeta={supportingDocs[doc.key]}
            />
          ))}
        </div>
      </div>

      {/* Optional docs */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {optionalDocs.map((doc) => (
            <FileUploadCard
              key={doc.key}
              docType={doc.key}
              label={doc.label}
              description={doc.description}
              onUploaded={(meta) => handleUploaded(doc.key, meta)}
              uploadedMeta={supportingDocs[doc.key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
