import { useRef, useState, useEffect } from "react";
import { FileText, UploadCloud, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { uploadDocument, createWorkerProfile } from "@/services/api";

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "passport_photo", label: "Passport Size Photo" },
  { value: "biometric_health", label: "Biometric & Health Proof" },
  { value: "verified_signature", label: "Verified Signature" },
  { value: "academic_transcripts", label: "Academic Transcripts (If required for position)" },
  { value: "degree_certificates", label: "Degree Certificates (If required for position)" },
  { value: "cv", label: "Curriculum Vitae / CV (If required for position)" },
  { value: "personal_demographic", label: "Personal & Demographic" },
];

const DOC_REQUIREMENTS = {
  passport: "Requires a full scan including every page. Must have at least 18 months of validity.",
  passport_photo: "Must be 35mm x 50mm on a white background. Clear, no glasses, and hair must not cover the face.",
  biometric_health: "Original Medical Report including physical data (height, weight, vaccination history) and Pre-Departure Bio-Medical reference number.",
  verified_signature: "The signature on your employment contract must perfectly match the signature in your passport.",
  academic_transcripts: "Certified copies of academic transcripts.",
  degree_certificates: "Certified copies of degree certificates.",
  cv: "A detailed Curriculum Vitae outlining your past work experience."
};

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

  const [workerDraft, setWorkerDraft] = useState({
    passport: {},
    medical_information: null,
    general_information: {},
  });

  const isPhotoType = docType !== "personal_demographic";

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) setFile(dropped);
  };

  const savePassportSection = (passportData) => {
    setWorkerDraft((current) => ({
      ...current,
      passport: {
        ...current.passport,
        ...passportData,
      },
    }));
  };

  const saveMedicalSection = (medicalData) => {
    setWorkerDraft((current) => ({
      ...current,
      medical_information: {
        ...(current.medical_information || {}),
        ...medicalData,
      },
    }));
  };

  const saveGeneralSection = (generalData) => {
    setWorkerDraft((current) => ({
      ...current,
      general_information: {
        ...current.general_information,
        ...generalData,
      },
    }));
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
            docType={docType}
            onPassportSaved={savePassportSection}
            onMedicalSaved={saveMedicalSection}
          />
        ) : (
          <PersonalDemographicForm
            onGeneralSaved={saveGeneralSection}
          />
        )}
      </section>
    </div>
  );
}

const MOCK_PASSPORT_DATA = {
  "Current Passport Number": "A12345678",
  "Current Passport Issue Date": "2020-03-15",
  "Current Passport Expiry Date": "2030-03-14",
  "Old Passport Number(s)": "A98765432",
  "Old Passport Issue Date(s)": "2010-03-15",
  "Old Passport Expiry Date(s)": "2020-03-14",
};

function PhotoUpload({
  file,
  setFile,
  isDragActive,
  setIsDragActive,
  inputRef,
  handleDrop,
  docType,
  onPassportSaved,
  onMedicalSaved,
}) {
  const [jobId, setJobId] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/documents/jobs/${jobId}`
        );
        const data = await res.json();

        console.log("Polling:", data);

        if (data.status === "completed") {
          clearInterval(interval);
          setIsPolling(false);

          const fields = data.result?.fields || {};
          setParsedData(fields);

          // 🔥 Save into workerDraft
          onPassportSaved({
            source: "parsed",
            document_id: data.document_id,
            ...Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [k, v.value])
            ),
          });

          toast({
            title: "Parsing completed",
            description: "Passport data extracted successfully.",
            variant: "success",
          });
        }

        if (data.status === "failed") {
          clearInterval(interval);
          setIsPolling(false);

          toast({
            title: "Parsing failed",
            description: "Unable to extract passport data.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Polling error:", err);
        clearInterval(interval);
        setIsPolling(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);


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

  const requirementText = DOC_REQUIREMENTS[docType];

  return (
    <div className="space-y-4">
      {requirementText && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-1">Upload Requirements</h4>
          <p className="text-xs text-blue-800 leading-relaxed">{requirementText}</p>
        </div>
      )}
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
        <div className="space-y-3">
          {previewUrl && (
            <div className="relative flex justify-center w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img 
                src={previewUrl} 
                alt="Document Preview" 
                className="max-h-64 rounded-lg object-contain"
              />
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
            <button
              type="button"
              onClick={handleUpload}
              className="rounded-lg bg-indigo-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800"
            >
              Upload
            </button>
          </div>

          {docType === "passport" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Extracted from document — read only</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {isPolling && (
                  <p className="text-sm text-indigo-600">
                    Parsing document... please wait
                  </p>
                )}
                {Object.entries(parsedData || {}).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">
                      {key.replaceAll("_", " ")}
                    </label>

                    <input
                      type="text"
                      value={value.value || ""}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    />

                    <p className="text-[10px] text-slate-400">
                      confidence: {(value.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonalDemographicForm({ onGeneralSaved }) {
  const { toast } = useToast();

  const [generalData, setGeneralData] = useState({
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
    travel_history_details: "",
    sector: "Manufacturing",
    permit_class: "PLKS",
    employment_date: "",
  });

  const [hasTravelHistory, setHasTravelHistory] = useState("");
  const [employmentHistory, setEmploymentHistory] = useState([""]);
  const [childrenList, setChildrenList] = useState([]);

  const addChild = () => setChildrenList([...childrenList, { name: "", age: "" }]);
  const removeChild = (index) => {
    const newList = [...childrenList];
    newList.splice(index, 1);
    setChildrenList(newList);
  };
  const updateChild = (index, field, value) => {
    const newList = [...childrenList];
    newList[index][field] = value;
    setChildrenList(newList);
  };

  const addEmployment = () => setEmploymentHistory([...employmentHistory, ""]);
  const removeEmployment = (index) => {
    const newHistory = [...employmentHistory];
    newHistory.splice(index, 1);
    setEmploymentHistory(newHistory);
  };
  const updateEmployment = (index, value) => {
    const newHistory = [...employmentHistory];
    newHistory[index] = value;
    setEmploymentHistory(newHistory);
  };

  const updateGeneralField = (field, value) => {
    setGeneralData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    onGeneralSaved({
      ...generalData,
      has_travel_history: hasTravelHistory,
      employment_history: employmentHistory,
      children: childrenList,
    });

    toast({
      title: "Form saved",
      description: "Your personal and demographic details have been saved.",
      variant: "success",
    });
  };

  const inputClasses = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Fill in your personal and demographic details below.</p>
      
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Full Name</label>
          <input type="text" placeholder="Full Name (as per passport)" className={inputClasses} />
        </div>

        {/* Date of Birth */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Date of Birth</label>
          <input type="date" className={inputClasses} />
        </div>

        {/* Gender */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Gender</label>
          <select className={inputClasses} defaultValue="">
            <option value="" disabled>Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Nationality */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Nationality</label>
          <input type="text" placeholder="Nationality" className={inputClasses} />
        </div>

        {/* Height */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Height (cm)</label>
          <input type="number" min="0" placeholder="e.g. 170" className={inputClasses} />
        </div>

        {/* Weight */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Weight (kg)</label>
          <input type="number" min="0" placeholder="e.g. 65" className={inputClasses} />
        </div>

        {/* Marital Status */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Marital Status</label>
          <select className={inputClasses} defaultValue="">
            <option value="" disabled>Select Marital Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
          </select>
        </div>

        {/* Father's Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Father's Name</label>
          <input type="text" placeholder="Father's Name" className={inputClasses} />
        </div>

        {/* Mother's Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Mother's Name</label>
          <input type="text" placeholder="Mother's Name" className={inputClasses} />
        </div>

        {/* Spouse's Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Spouse's Name (Optional)</label>
          <input type="text" placeholder="Spouse's Name" className={inputClasses} />
        </div>

        {/* Children Details */}
        <div className="space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600">Children Details (Optional)</label>
            <button 
              type="button" 
              onClick={addChild}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded transition hover:bg-indigo-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Child
            </button>
          </div>
          
          {childrenList.length > 0 && (
            <div className="space-y-2">
              {childrenList.map((child, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder={`Child ${idx + 1} Name`} 
                    className={cn(inputClasses, "flex-1")}
                    value={child.name}
                    onChange={(e) => updateChild(idx, "name", e.target.value)}
                  />
                  <input 
                    type="number" 
                    min="0"
                    placeholder="Age" 
                    className={cn(inputClasses, "w-24")}
                    value={child.age}
                    onChange={(e) => updateChild(idx, "age", e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => removeChild(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition"
                    title="Remove Child"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permanent Home Address */}
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Permanent Home Address</label>
          <input type="text" placeholder="Permanent Home Address" className={inputClasses} />
        </div>

        {/* Emergency Contact Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Emergency Contact Name</label>
          <input type="text" placeholder="Emergency Contact Name" className={inputClasses} />
        </div>

        {/* Emergency Contact Phone */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Emergency Contact Phone Number</label>
          <input type="text" placeholder="Emergency Contact Phone Number" className={inputClasses} />
        </div>

        {/* Education History */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Education History</label>
          <select className={inputClasses} defaultValue="">
             <option value="" disabled>Select Education Level</option>
             <option value="Primary School">Primary School</option>
             <option value="Secondary/High School">Secondary/High School</option>
             <option value="Bachelor's Degree">Bachelor's Degree</option>
             <option value="Master's Degree">Master's Degree</option>
             <option value="Other">Other</option>
          </select>
        </div>

        {/* Past Overseas Travel History */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Past Overseas Travel History</label>
          <select 
            className={inputClasses} 
            value={hasTravelHistory}
            onChange={(e) => setHasTravelHistory(e.target.value)}
          >
             <option value="" disabled>Select Yes or No</option>
             <option value="Yes">Yes</option>
             <option value="No">No</option>
          </select>
        </div>
        
        {hasTravelHistory === "Yes" && (
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Travel History Details</label>
            <input type="text" placeholder="Please specify your past overseas travel history" className={inputClasses} />
          </div>
        )}
      </div>

      {/* Employment History */}
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-medium text-slate-600">Employment History</label>
        <div className="space-y-2">
          {employmentHistory.map((emp, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input 
                type="text" 
                placeholder={`Job ${idx + 1} (e.g., Chef)`} 
                className={inputClasses}
                value={emp}
                onChange={(e) => updateEmployment(idx, e.target.value)}
              />
              {employmentHistory.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => removeEmployment(idx)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition"
                  title="Remove Job"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button 
          type="button" 
          onClick={addEmployment}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md transition hover:bg-indigo-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add Another Job
        </button>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg bg-indigo-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800"
        >
          Submit Form
        </button>
      </div>
    </div>
  );
}
