import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const INPUT = "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 transition";
const SELECT = cn(INPUT, "appearance-none");

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-muted-foreground">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function PersonalDetailsStep({ data, onChange, employmentHistory, onEmploymentChange, children: childrenList, onChildrenChange }) {
  const update = (key, value) => onChange({ ...data, [key]: value });

  const addEmployment = () => onEmploymentChange([...employmentHistory, ""]);
  const removeEmployment = (i) => { const n = [...employmentHistory]; n.splice(i, 1); onEmploymentChange(n); };
  const updateEmployment = (i, v) => { const n = [...employmentHistory]; n[i] = v; onEmploymentChange(n); };

  const addChild = () => onChildrenChange([...childrenList, { name: "", age: "" }]);
  const removeChild = (i) => { const n = [...childrenList]; n.splice(i, 1); onChildrenChange(n); };
  const updateChild = (i, field, v) => { const n = [...childrenList]; n[i] = { ...n[i], [field]: v }; onChildrenChange(n); };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground">Personal & Demographic Details</h3>
        <p className="mt-1 text-sm text-muted-foreground">Fill in your personal information below. Fields marked with <span className="text-rose-500">*</span> are required.</p>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information" defaultOpen>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" required>
            <input type="text" placeholder="As shown on passport" className={INPUT} value={data.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </Field>
          <Field label="Date of Birth" required>
            <input type="date" className={INPUT} value={data.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
          </Field>
          <Field label="Gender" required>
            <select className={SELECT} value={data.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="" disabled>Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>
          <Field label="Nationality" required>
            <input type="text" placeholder="e.g. Indonesian" className={INPUT} value={data.nationality} onChange={(e) => update("nationality", e.target.value)} />
          </Field>
          <Field label="Height (cm)">
            <input type="number" min="0" placeholder="e.g. 170" className={INPUT} value={data.height_cm} onChange={(e) => update("height_cm", e.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" min="0" placeholder="e.g. 65" className={INPUT} value={data.weight_kg} onChange={(e) => update("weight_kg", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Family */}
      <Section title="Family Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marital Status">
            <select className={SELECT} value={data.marital_status} onChange={(e) => update("marital_status", e.target.value)}>
              <option value="" disabled>Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </Field>
          <Field label="Father's Name">
            <input type="text" placeholder="Father's name" className={INPUT} value={data.father_name} onChange={(e) => update("father_name", e.target.value)} />
          </Field>
          <Field label="Mother's Name">
            <input type="text" placeholder="Mother's name" className={INPUT} value={data.mother_name} onChange={(e) => update("mother_name", e.target.value)} />
          </Field>
          <Field label="Spouse's Name">
            <input type="text" placeholder="If applicable" className={INPUT} value={data.spouse_name} onChange={(e) => update("spouse_name", e.target.value)} />
          </Field>
        </div>

        {/* Children */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Children (optional)</span>
            <button type="button" onClick={addChild} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition dark:bg-indigo-950 dark:text-indigo-300">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {childrenList.map((child, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" placeholder={`Child ${i + 1} name`} className={cn(INPUT, "flex-1")} value={child.name} onChange={(e) => updateChild(i, "name", e.target.value)} />
              <input type="number" min="0" placeholder="Age" className={cn(INPUT, "w-20")} value={child.age} onChange={(e) => updateChild(i, "age", e.target.value)} />
              <button type="button" onClick={() => removeChild(i)} className="p-2 text-muted-foreground hover:text-rose-600 transition"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact & Address">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Home Address" required>
              <input type="text" placeholder="67 Joker Street" className={INPUT} value={data.address} onChange={(e) => update("address", e.target.value)} />
            </Field>
          </div>
          <Field label="Emergency Contact Name" required>
            <input type="text" placeholder="Contact name" className={INPUT} value={data.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} />
          </Field>
          <Field label="Emergency Contact Phone" required>
            <input type="text" placeholder="+60123456789" className={INPUT} value={data.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Education & Employment */}
      <Section title="Education & Employment">
        <div className="space-y-4">
          <Field label="Education Level">
            <select className={SELECT} value={data.education_history} onChange={(e) => update("education_history", e.target.value)}>
              <option value="" disabled>Select</option>
              <option value="Primary School">Primary School</option>
              <option value="Secondary/High School">Secondary / High School</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
              <option value="Master's Degree">Master's Degree</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Past Overseas Travel">
            <select className={SELECT} value={data.has_travel_history} onChange={(e) => update("has_travel_history", e.target.value)}>
              <option value="" disabled>Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>

          {data.has_travel_history === "Yes" && (
            <Field label="Travel Details">
              <input type="text" placeholder="Countries and dates" className={INPUT} value={data.travel_history_details} onChange={(e) => update("travel_history_details", e.target.value)} />
            </Field>
          )}

          <div className="space-y-3">
            <span className="block text-sm font-medium text-muted-foreground">Employment History</span>
            {employmentHistory.map((emp, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="text" placeholder={`Job ${i + 1} (e.g. Chef)`} className={INPUT} value={emp} onChange={(e) => updateEmployment(i, e.target.value)} />
                {employmentHistory.length > 1 && (
                  <button type="button" onClick={() => removeEmployment(i)} className="p-2 text-muted-foreground hover:text-rose-600 transition"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addEmployment} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition dark:bg-indigo-950 dark:text-indigo-300">
              <Plus className="h-3.5 w-3.5" /> Add Job
            </button>
          </div>
        </div>
      </Section>

      {/* Employment Terms */}
      <Section title="Employment Terms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sector">
            <input type="text" className={INPUT} value={data.sector} onChange={(e) => update("sector", e.target.value)} />
          </Field>
          <Field label="Permit Class">
            <input type="text" className={INPUT} value={data.permit_class} onChange={(e) => update("permit_class", e.target.value)} />
          </Field>
          <Field label="Employment Start Date">
            <input type="date" className={INPUT} value={data.employment_date} onChange={(e) => update("employment_date", e.target.value)} />
          </Field>
        </div>
      </Section>
    </div>
  );
}
