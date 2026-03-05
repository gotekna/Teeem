"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  MapPin,
  Building2,
  User,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuickEnrolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface EnrolmentFormData {
  // Step 1: Property
  existingPropertyId?: number;
  newAddress: string;
  suburb: string;
  state: string;
  postcode: string;

  // Step 2: SDA Details
  sdaDesignCategory: string;
  buildingType: string;
  bedrooms: string;
  maxResidents: string;

  // Step 3: Assessor (optional)
  assessorName: string;
  assessorOrganisation: string;
  assessmentDate: string;

  // Internal
  skipAssessor: boolean;
}

const INITIAL_FORM: EnrolmentFormData = {
  newAddress: "",
  suburb: "",
  state: "",
  postcode: "",
  sdaDesignCategory: "",
  buildingType: "",
  bedrooms: "",
  maxResidents: "",
  assessorName: "",
  assessorOrganisation: "",
  assessmentDate: "",
  skipAssessor: false,
};

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Property" },
  { number: 2, label: "SDA Details" },
  { number: 3, label: "Assessor" },
  { number: 4, label: "Review" },
] as const;

const SDA_DESIGN_CATEGORIES = [
  { value: "HPS", label: "High Physical Support (HPS)" },
  { value: "FA", label: "Fully Accessible (FA)" },
  { value: "IL", label: "Improved Liveability (IL)" },
  { value: "Robust", label: "Robust" },
];

const BUILDING_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "duplex", label: "Duplex" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "townhouse", label: "Townhouse" },
  { value: "other", label: "Other" },
];

const SDA_CATEGORY_STYLES: Record<string, string> = {
  HPS: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  FA: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  IL: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  Robust:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isActive = currentStep === step.number;
        const isUpcoming = currentStep < step.number;

        return (
          <div key={step.number} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.number}
              </div>
              <span
                className={`text-xs truncate ${
                  isActive
                    ? "text-foreground font-medium"
                    : isUpcoming
                    ? "text-muted-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mt-[-14px] transition-colors ${
                  isCompleted ? "bg-green-400" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

// ─── Step 1: Property Selection ───────────────────────────────────────────────

function Step1Property({
  form,
  onChange,
}: {
  form: EnrolmentFormData;
  onChange: (updates: Partial<EnrolmentFormData>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the address for the SDA property to enrol.
      </p>

      <FormField label="Street Address" required>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className={`${inputCls} pl-9`}
            placeholder="123 Main Street"
            value={form.newAddress}
            onChange={(e) => onChange({ newAddress: e.target.value })}
          />
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Suburb" required>
          <input
            type="text"
            className={inputCls}
            placeholder="Suburb"
            value={form.suburb}
            onChange={(e) => onChange({ suburb: e.target.value })}
          />
        </FormField>
        <FormField label="State" required>
          <select
            className={selectCls}
            value={form.state}
            onChange={(e) => onChange({ state: e.target.value })}
          >
            <option value="">Select state</option>
            {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Postcode">
        <input
          type="text"
          className={inputCls}
          placeholder="0000"
          maxLength={4}
          value={form.postcode}
          onChange={(e) => onChange({ postcode: e.target.value.replace(/\D/g, "") })}
        />
      </FormField>
    </div>
  );
}

// ─── Step 2: SDA Details ──────────────────────────────────────────────────────

function Step2SdaDetails({
  form,
  onChange,
}: {
  form: EnrolmentFormData;
  onChange: (updates: Partial<EnrolmentFormData>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Specify the SDA design category and dwelling details.
      </p>

      <FormField label="SDA Design Category" required hint="Determines the pricing and support level">
        <div className="grid grid-cols-2 gap-2">
          {SDA_DESIGN_CATEGORIES.map((cat) => {
            const isSelected = form.sdaDesignCategory === cat.value;
            const style = SDA_CATEGORY_STYLES[cat.value] ?? "";
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onChange({ sdaDesignCategory: cat.value })}
                className={`text-left px-3 py-2.5 rounded-md border text-sm transition-colors ${
                  isSelected
                    ? `${style} border-current`
                    : "border-border hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold block">{cat.value}</span>
                <span className="text-xs opacity-70">
                  {cat.label.replace(`${cat.value}`, "").replace("()", "").replace("( )", "").trim()}
                </span>
              </button>
            );
          })}
        </div>
      </FormField>

      <FormField label="Building Type" required>
        <select
          className={selectCls}
          value={form.buildingType}
          onChange={(e) => onChange({ buildingType: e.target.value })}
        >
          <option value="">Select type</option>
          {BUILDING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bedrooms" required>
          <input
            type="number"
            className={inputCls}
            placeholder="3"
            min="1"
            max="20"
            value={form.bedrooms}
            onChange={(e) => onChange({ bedrooms: e.target.value })}
          />
        </FormField>
        <FormField label="Max Residents" required>
          <input
            type="number"
            className={inputCls}
            placeholder="2"
            min="1"
            max="10"
            value={form.maxResidents}
            onChange={(e) => onChange({ maxResidents: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}

// ─── Step 3: Assessor ─────────────────────────────────────────────────────────

function Step3Assessor({
  form,
  onChange,
}: {
  form: EnrolmentFormData;
  onChange: (updates: Partial<EnrolmentFormData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          Add assessor details if available. You can skip this step and add them later.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0 ml-2"
          onClick={() => onChange({ skipAssessor: true })}
        >
          Skip
        </Button>
      </div>

      {!form.skipAssessor && (
        <>
          <FormField label="Assessor Name">
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                className={`${inputCls} pl-9`}
                placeholder="Full name"
                value={form.assessorName}
                onChange={(e) => onChange({ assessorName: e.target.value })}
              />
            </div>
          </FormField>

          <FormField label="Assessor Organisation">
            <input
              type="text"
              className={inputCls}
              placeholder="Organisation name"
              value={form.assessorOrganisation}
              onChange={(e) => onChange({ assessorOrganisation: e.target.value })}
            />
          </FormField>

          <FormField label="Assessment Date">
            <input
              type="date"
              className={inputCls}
              value={form.assessmentDate}
              onChange={(e) => onChange({ assessmentDate: e.target.value })}
            />
          </FormField>
        </>
      )}

      {form.skipAssessor && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Assessor details skipped</p>
            <p className="text-xs text-muted-foreground">You can add these later in the enrolment.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => onChange({ skipAssessor: false })}
          >
            Add now
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4Review({ form }: { form: EnrolmentFormData }) {
  const categoryStyle = SDA_CATEGORY_STYLES[form.sdaDesignCategory] ?? "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the details below and click <strong>Start Enrolment</strong> to begin.
      </p>

      <div className="space-y-3 divide-y divide-border">
        {/* Property */}
        <div className="pb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Property
          </h3>
          <p className="text-sm font-medium">
            {form.newAddress}
            {form.suburb && `, ${form.suburb}`}
            {form.state && ` ${form.state}`}
            {form.postcode && ` ${form.postcode}`}
          </p>
        </div>

        {/* SDA Details */}
        <div className="py-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            SDA Details
          </h3>
          <div className="flex flex-wrap gap-2">
            {form.sdaDesignCategory && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${categoryStyle}`}>
                {form.sdaDesignCategory}
              </span>
            )}
            {form.buildingType && (
              <Badge variant="secondary" className="text-xs capitalize">
                {form.buildingType}
              </Badge>
            )}
            {form.bedrooms && (
              <Badge variant="secondary" className="text-xs">
                {form.bedrooms} bed
              </Badge>
            )}
            {form.maxResidents && (
              <Badge variant="secondary" className="text-xs">
                Max {form.maxResidents} residents
              </Badge>
            )}
          </div>
        </div>

        {/* Assessor */}
        <div className="pt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User className="h-3 w-3" />
            Assessor
          </h3>
          {form.skipAssessor || (!form.assessorName && !form.assessorOrganisation) ? (
            <p className="text-sm text-muted-foreground italic">Not provided (can be added later)</p>
          ) : (
            <div className="space-y-0.5">
              {form.assessorName && <p className="text-sm">{form.assessorName}</p>}
              {form.assessorOrganisation && (
                <p className="text-xs text-muted-foreground">{form.assessorOrganisation}</p>
              )}
              {form.assessmentDate && (
                <p className="text-xs text-muted-foreground">Assessment: {form.assessmentDate}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* What happens next */}
      <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">What happens next?</p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5 list-disc list-inside">
          <li>Property is created and linked to SDA programme</li>
          <li>Enrolment status set to &ldquo;Not Started&rdquo;</li>
          <li>Completeness checklist generated for missing items</li>
          <li>Appears in Enrolments pipeline for tracking</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export default function QuickEnrolDialog({ open, onOpenChange, onSuccess }: QuickEnrolDialogProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<EnrolmentFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateForm = (updates: Partial<EnrolmentFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // Validation per step
  const isStep1Valid = form.newAddress.trim().length > 0 && form.suburb.trim().length > 0 && form.state.length > 0;
  const isStep2Valid = form.sdaDesignCategory.length > 0 && form.buildingType.length > 0 && form.bedrooms.length > 0 && form.maxResidents.length > 0;
  const isCurrentStepValid = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : true;

  const handleNext = () => {
    if (step < 4) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        address: form.newAddress.trim(),
        suburb: form.suburb.trim(),
        state: form.state,
        postcode: form.postcode.trim(),
        sda_design_category: form.sdaDesignCategory,
        building_type: form.buildingType,
        bedrooms: parseInt(form.bedrooms, 10),
        max_residents: parseInt(form.maxResidents, 10),
        assessor_name: form.skipAssessor ? null : form.assessorName.trim() || null,
        assessor_organisation: form.skipAssessor ? null : form.assessorOrganisation.trim() || null,
        assessment_date: form.skipAssessor ? null : form.assessmentDate || null,
      };

      const res = await api.post<{ success: boolean; data: unknown }>(
        "/api/v1/sda/enrolments/quick_enrol",
        payload
      );

      if (res?.success === false) {
        throw new Error("Enrolment failed");
      }

      // Reset and close
      setStep(1);
      setForm(INITIAL_FORM);
      onSuccess?.();
    } catch {
      setSubmitError("Failed to start enrolment. Please check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset on close
      setStep(1);
      setForm(INITIAL_FORM);
      setSubmitError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Quick Enrol Property</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Step content */}
        <div className="min-h-[220px]">
          {step === 1 && <Step1Property form={form} onChange={updateForm} />}
          {step === 2 && <Step2SdaDetails form={form} onChange={updateForm} />}
          {step === 3 && <Step3Assessor form={form} onChange={updateForm} />}
          {step === 4 && <Step4Review form={form} />}
        </div>

        {/* Error message */}
        {submitError && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="mt-2">
          <div className="flex items-center justify-between w-full gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={step === 1 || submitting}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>

            <div className="text-xs text-muted-foreground">
              Step {step} of {STEPS.length}
            </div>

            {step < 4 ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!isCurrentStepValid}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Starting…" : "Start Enrolment"}
                {!submitting && <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
