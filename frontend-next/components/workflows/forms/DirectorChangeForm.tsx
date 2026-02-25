"use client";

/**
 * DirectorChangeForm - Workflow form for ASIC Director Changes
 *
 * Extracted from DirectorChangeWizard steps 1-3. This is a pure data collection
 * form that outputs structured form_data for the BPMN workflow. No PDF generation
 * or e-signing - those happen as service tasks in the workflow.
 *
 * Props follow TaskFormProps interface from lib/workflow-task-forms.ts.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { AddressSearchInput } from "@/components/ui/address-search-input";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarIcon,
  Check,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import type { TaskFormProps } from "@/lib/workflow-task-forms";
import { DATE_DISPLAY, DATE_ISO } from "@/lib/constants/date-formats";

// --- Types ---

interface ContactEmail {
  id: number;
  email: string;
  is_primary: boolean;
  label: string | null;
}

interface OfficerRecord {
  id: number;
  contact_id?: number;
  contact?: {
    id: number;
    display_name: string;
    email?: string;
  };
  position: string;
  formatted_position: string;
  is_current: boolean;
  appointment_date?: string;
  resignation_date?: string;
}

interface CeasingDirector {
  corporate_director_id: number;
  contact_id: number;
  officer_ids: number[];
  name: string;
  position: string;
  positions: string[];
  cessation_date: string;
  has_dob: boolean;
  has_address: boolean;
  dob: string;
  address: string;
  editing_dob: boolean;
  editing_address: boolean;
  emails: ContactEmail[];
  selected_email: string;
}

interface NewAppointment {
  contact_id: number;
  name: string;
  email: string;
  positions: string[];
  appointment_date: string;
  has_dob: boolean;
  has_address: boolean;
  dob: string;
  address: string;
  editing_dob: boolean;
  editing_address: boolean;
  emails: ContactEmail[];
  selected_email: string;
}

interface ContactSearchResult {
  id: number;
  display_name: string;
  email?: string;
  date_of_birth?: string;
  full_address?: string;
  entity_type?: string;
}

interface CompanyDetails {
  name: string;
  formatted_acn?: string;
  formatted_abn?: string;
  registered_office_address?: string;
}

const POSITION_OPTIONS = [
  { value: "director", label: "Director" },
  { value: "secretary", label: "Secretary" },
  { value: "public_officer", label: "Public Officer" },
  { value: "corporate_officer", label: "Corporate Officer" },
  { value: "chairman", label: "Chairman" },
];

// --- Date Picker ---

function DatePickerInput({
  value,
  onChange,
  placeholder = "Pick date...",
  isDob = false,
  className,
}: {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  isDob?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + "T00:00:00") : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 w-full justify-start text-left font-normal text-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {parsed ? format(parsed, DATE_DISPLAY) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, DATE_ISO));
              setOpen(false);
            }
          }}
          {...(isDob
            ? { captionLayout: "dropdown", fromYear: 1920, toYear: currentYear }
            : { fromYear: currentYear - 5, toYear: currentYear + 1 })}
        />
      </PopoverContent>
    </Popover>
  );
}

// --- Main Component ---

export default function DirectorChangeForm({
  taskId,
  formSchema,
  formData: existingFormData,
  processVariables,
  subject,
  onComplete,
  onCancel,
}: TaskFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company details
  const [company, setCompany] = useState<CompanyDetails | null>(null);

  // Officers
  const [officers, setOfficers] = useState<OfficerRecord[]>([]);

  // Director change state
  const [ceasingDirectors, setCeasingDirectors] = useState<CeasingDirector[]>([]);
  const [newAppointments, setNewAppointments] = useState<NewAppointment[]>([]);

  // Contact search
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside (but not when clicking inside popovers like Calendar)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        // Don't close if clicking inside a Radix popover portal (e.g. Calendar date picker)
        if ((target as HTMLElement).closest?.("[data-radix-popper-content-wrapper]")) return;
        setContactResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOfficers = officers.filter((o) => o.is_current);

  // Load company and officers from subject
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch company details
        const companyRes = await api.get<{
          success: boolean;
          company?: CompanyDetails;
          corporate?: CompanyDetails;
        }>(`/api/v1/companies/${subject.id}`);
        setCompany(companyRes.company || companyRes.corporate || { name: subject.name });

        // Fetch officers
        const officerRes = await api.get<{
          success: boolean;
          directors: OfficerRecord[];
        }>(`/api/v1/companies/${subject.id}/directors`);
        setOfficers(officerRes.directors || []);

        // Restore form data if resuming
        if (existingFormData && Object.keys(existingFormData).length > 0) {
          // TODO: Restore ceasing/appointments from saved form_data
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load company data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subject.id, subject.name, existingFormData]);

  // Contact search debounce
  useEffect(() => {
    if (contactSearch.length < 2) {
      setContactResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get<{ contacts: ContactSearchResult[] }>(
          `/api/v1/contacts?search=${encodeURIComponent(contactSearch)}&entity_type=person,sole_trader`
        );
        setContactResults(response.contacts || []);
      } catch (err) {
        console.error("[DirectorChangeForm] Contact search failed:", err);
        setContactResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearch]);

  // --- Ceasing Directors ---

  const addCeasingDirector = useCallback(
    async (officer: OfficerRecord) => {
      const contactId = officer.contact?.id;
      if (contactId && ceasingDirectors.some((cd) => cd.contact_id === contactId)) return;

      const allPositions = currentOfficers
        .filter((o) => o.contact?.id === contactId && o.is_current)
        .map((o) => o.position);
      const deduped = [...new Set(allPositions)];
      const uniquePositions = deduped.filter((pos) => {
        const others = deduped.filter(
          (p) => p !== pos && pos.toLowerCase().includes(p.toLowerCase())
        );
        return others.length < 2;
      });

      const officerIds = currentOfficers
        .filter((o) => o.contact?.id === contactId && o.is_current)
        .map((o) => o.id);

      let dob = "";
      let address = "";
      let hasDob = false;
      let hasAddress = false;
      let emails: ContactEmail[] = [];
      let selectedEmail = officer.contact?.email || "";

      if (contactId) {
        try {
          const detail = await api.get<{
            contact: {
              date_of_birth?: string;
              residential_address?: string | null;
              contact_emails?: ContactEmail[];
              contact_addresses?: Array<{
                line1?: string; line2?: string; city?: string;
                region?: string; postal_code?: string; address_type?: string;
              }>;
            };
          }>(`/api/v1/contacts/${contactId}`);
          const c = detail.contact;
          dob = c?.date_of_birth || "";
          hasDob = !!dob && dob !== "[RESTRICTED]";
          if (c?.residential_address && c.residential_address !== "[RESTRICTED]") {
            hasAddress = true;
            address = c.residential_address;
          } else if (c?.contact_addresses?.length) {
            const streetAddr =
              c.contact_addresses.find((a) => a.address_type === "STREET") || c.contact_addresses[0];
            const parts = [streetAddr.line1, streetAddr.line2, streetAddr.city, streetAddr.region, streetAddr.postal_code].filter(Boolean);
            if (parts.length > 0) {
              hasAddress = true;
              address = parts.join(", ");
            }
          }
          emails = c?.contact_emails || [];
          const primary = emails.find((e) => e.is_primary);
          selectedEmail = primary?.email || emails[0]?.email || selectedEmail;
        } catch {
          /* proceed without details */
        }
      }

      setCeasingDirectors((prev) => [
        ...prev,
        {
          corporate_director_id: officer.id,
          contact_id: contactId || 0,
          officer_ids: officerIds,
          name: officer.contact?.display_name || "Unknown",
          position: officer.position,
          positions: uniquePositions.length > 0 ? uniquePositions : [officer.position],
          cessation_date: format(new Date(), DATE_ISO),
          has_dob: hasDob,
          has_address: hasAddress,
          dob,
          address,
          editing_dob: false,
          editing_address: false,
          emails,
          selected_email: selectedEmail,
        },
      ]);
    },
    [ceasingDirectors, currentOfficers]
  );

  // Auto-fill: if company has only one current director, add them as ceasing automatically
  const autoFillTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoFillTriggeredRef.current || currentOfficers.length === 0 || ceasingDirectors.length > 0) return;

    // Group current officers by contact to find unique directors
    const uniqueContacts = new Map<number, OfficerRecord>();
    currentOfficers.forEach((o) => {
      if (o.contact?.id && !uniqueContacts.has(o.contact.id)) {
        uniqueContacts.set(o.contact.id, o);
      }
    });

    // If exactly one unique director, auto-add as ceasing
    if (uniqueContacts.size === 1) {
      const [, officer] = [...uniqueContacts.entries()][0];
      autoFillTriggeredRef.current = true;
      addCeasingDirector(officer);
    }
  }, [currentOfficers, ceasingDirectors.length, addCeasingDirector]);

  const removeCeasingDirector = (id: number) => {
    setCeasingDirectors((prev) => prev.filter((cd) => cd.corporate_director_id !== id));
  };

  const updateCeasingDate = (id: number, date: string) => {
    setCeasingDirectors((prev) =>
      prev.map((cd) => (cd.corporate_director_id === id ? { ...cd, cessation_date: date } : cd))
    );
  };

  const updateCeasingPositions = (id: number, positions: string[]) => {
    setCeasingDirectors((prev) =>
      prev.map((cd) => (cd.corporate_director_id === id ? { ...cd, positions } : cd))
    );
  };

  // --- New Appointments ---

  const addNewAppointment = useCallback(
    async (contact: ContactSearchResult) => {
      if (newAppointments.some((a) => a.contact_id === contact.id)) return;

      const defaultDate = ceasingDirectors[0]?.cessation_date || format(new Date(), DATE_ISO);

      let hasDob = !!contact.date_of_birth;
      let hasAddress = false;
      let dobValue = "";
      let addressValue = "";
      let emails: ContactEmail[] = [];
      let selectedEmail = contact.email || "";

      try {
        const detail = await api.get<{
          contact: {
            date_of_birth?: string;
            residential_address?: string | null;
            contact_emails?: ContactEmail[];
            contact_addresses?: Array<{
              line1?: string; line2?: string; city?: string;
              region?: string; postal_code?: string; address_type?: string;
            }>;
          };
        }>(`/api/v1/contacts/${contact.id}`);
        const c = detail.contact;
        hasDob = !!c?.date_of_birth && c.date_of_birth !== "[RESTRICTED]";
        if (hasDob && c?.date_of_birth) dobValue = c.date_of_birth;
        if (c?.residential_address && c.residential_address !== "[RESTRICTED]") {
          hasAddress = true;
          addressValue = c.residential_address;
        } else if (c?.contact_addresses?.length) {
          const streetAddr =
            c.contact_addresses.find((a) => a.address_type === "STREET") || c.contact_addresses[0];
          const parts = [streetAddr.line1, streetAddr.line2, streetAddr.city, streetAddr.region, streetAddr.postal_code].filter(Boolean);
          if (parts.length > 0) {
            hasAddress = true;
            addressValue = parts.join(", ");
          }
        }
        emails = c?.contact_emails || [];
        const primary = emails.find((e) => e.is_primary);
        selectedEmail = primary?.email || emails[0]?.email || selectedEmail;
      } catch {
        /* keep search-level values */
      }

      setNewAppointments((prev) => [
        ...prev,
        {
          contact_id: contact.id,
          name: contact.display_name,
          email: contact.email || "",
          positions: ["director"],
          appointment_date: defaultDate,
          has_dob: hasDob,
          has_address: hasAddress,
          dob: dobValue,
          address: addressValue,
          editing_dob: false,
          editing_address: false,
          emails,
          selected_email: selectedEmail,
        },
      ]);
      setContactSearch("");
      setContactResults([]);
    },
    [newAppointments, ceasingDirectors]
  );

  const removeAppointment = (id: number) => {
    setNewAppointments((prev) => prev.filter((a) => a.contact_id !== id));
  };

  const updateAppointmentPositions = (id: number, positions: string[]) => {
    setNewAppointments((prev) =>
      prev.map((a) => (a.contact_id === id ? { ...a, positions } : a))
    );
  };

  const updateAppointmentDate = (id: number, date: string) => {
    setNewAppointments((prev) =>
      prev.map((a) => (a.contact_id === id ? { ...a, appointment_date: date } : a))
    );
  };

  // --- Submit ---

  // Validation: all people must have DOB, address, and email before proceeding
  const ceasingValid = ceasingDirectors.every(
    (cd) => cd.has_dob && cd.has_address && !!cd.selected_email
  );
  const appointmentsValid = newAppointments.every(
    (a) => a.has_dob && a.has_address && !!a.selected_email
  );
  const hasChanges = ceasingDirectors.length > 0 || newAppointments.length > 0;
  const canProceedToReview = hasChanges && ceasingValid && appointmentsValid;
  const canSubmit = canProceedToReview;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        ceasing_directors: ceasingDirectors.map((cd) => ({
          corporate_director_id: cd.corporate_director_id,
          contact_id: cd.contact_id,
          positions: cd.positions,
          cessation_date: cd.cessation_date,
          email: cd.selected_email,
          address: cd.address,
        })),
        new_appointments: newAppointments.map((a) => ({
          contact_id: a.contact_id,
          positions: a.positions,
          appointment_date: a.appointment_date,
          email: a.selected_email,
          address: a.address,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    );
  }

  const stepTitles = ["Company", "Changes", "Review"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Director Change Package</CardTitle>
        <p className="text-sm text-muted-foreground">
          ASIC Form 484 - Change to Company Details
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 pt-2">
          {stepTitles.map((title, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <div key={stepNum} className="flex items-center gap-1.5">
                {i > 0 && <div className="w-8 h-px bg-border" />}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isComplete
                      ? "bg-green-600 text-white"
                      : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Company Details */}
        {step === 1 && company && (() => {
          const missingCompanyFields: string[] = [];
          if (!company.formatted_acn) missingCompanyFields.push("ACN");
          if (!company.registered_office_address) missingCompanyFields.push("Registered Office Address");
          const canProceedStep1 = missingCompanyFields.length === 0;

          return (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Company Name</Label>
                  <p className="font-medium">{company.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ACN</Label>
                  {company.formatted_acn ? (
                    <p>{company.formatted_acn}</p>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Required — edit on company page
                    </div>
                  )}
                </div>
                {company.formatted_abn && (
                  <div>
                    <Label className="text-xs text-muted-foreground">ABN</Label>
                    <p>{company.formatted_abn}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Registered Office</Label>
                  {company.registered_office_address ? (
                    <p className="text-sm">{company.registered_office_address}</p>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Required — edit on company page
                    </div>
                  )}
                </div>
              </div>

              {!canProceedStep1 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Missing: {missingCompanyFields.join(", ")}. Update the company details before proceeding.
                </div>
              )}

              {canProceedStep1 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Confirm the company details above are correct before proceeding. If any details need
                    updating, edit them on the company page first.
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Next <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Step 2: Changes */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Ceasing Officeholders */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-red-500" />
                Ceasing Officeholders
              </h4>

              {ceasingDirectors.map((cd) => (
                <div key={cd.corporate_director_id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{cd.name}</p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        <Pencil className="w-2.5 h-2.5 mr-0.5" /> Signs Resignation
                      </Badge>
                    </div>
                    <button
                      onClick={() => removeCeasingDirector(cd.corporate_director_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* DOB and Address */}
                  <div className="space-y-2 p-2 bg-muted/50 border rounded text-sm">
                    {/* Date of Birth */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                        {cd.has_dob && !cd.editing_dob && (
                          <button
                            onClick={() =>
                              setCeasingDirectors((prev) =>
                                prev.map((c) =>
                                  c.corporate_director_id === cd.corporate_director_id
                                    ? { ...c, editing_dob: true }
                                    : c
                                )
                              )
                            }
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {cd.has_dob && !cd.editing_dob ? (
                        <p className="text-sm">
                          {cd.dob ? format(new Date(cd.dob + "T00:00:00"), DATE_DISPLAY) : "On file"}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!cd.has_dob && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Required
                            </div>
                          )}
                          <DatePickerInput
                            value={cd.editing_dob ? cd.dob : ""}
                            isDob
                            placeholder="Select date of birth..."
                            className="flex-1"
                            onChange={async (date) => {
                              try {
                                await api.patch(`/api/v1/contacts/${cd.contact_id}`, {
                                  contact: { date_of_birth: date },
                                });
                                setCeasingDirectors((prev) =>
                                  prev.map((c) =>
                                    c.corporate_director_id === cd.corporate_director_id
                                      ? { ...c, has_dob: true, dob: date, editing_dob: false }
                                      : c
                                  )
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                          />
                          {cd.editing_dob && (
                            <button
                              onClick={() =>
                                setCeasingDirectors((prev) =>
                                  prev.map((c) =>
                                    c.corporate_director_id === cd.corporate_director_id
                                      ? { ...c, editing_dob: false }
                                      : c
                                  )
                                )
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Residential Address */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Residential Address</Label>
                        {cd.has_address && !cd.editing_address && (
                          <button
                            onClick={() =>
                              setCeasingDirectors((prev) =>
                                prev.map((c) =>
                                  c.corporate_director_id === cd.corporate_director_id
                                    ? { ...c, editing_address: true }
                                    : c
                                )
                              )
                            }
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {cd.has_address && !cd.editing_address ? (
                        <p className="text-sm">{cd.address || "On file"}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!cd.has_address && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Required
                            </div>
                          )}
                          <AddressSearchInput
                            defaultValue={cd.editing_address ? cd.address : ""}
                            className="flex-1"
                            inputClassName="h-8 text-sm"
                            onSelect={async (address) => {
                              if (!address) return;
                              try {
                                await api.patch(`/api/v1/contacts/${cd.contact_id}`, {
                                  contact: { residential_address: address },
                                });
                                setCeasingDirectors((prev) =>
                                  prev.map((c) =>
                                    c.corporate_director_id === cd.corporate_director_id
                                      ? { ...c, has_address: true, address, editing_address: false }
                                      : c
                                  )
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                          />
                          {cd.editing_address && (
                            <button
                              onClick={() =>
                                setCeasingDirectors((prev) =>
                                  prev.map((c) =>
                                    c.corporate_director_id === cd.corporate_director_id
                                      ? { ...c, editing_address: false }
                                      : c
                                  )
                                )
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* E-Signature Email */}
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Resignation sent for signature to
                      </Label>
                      {cd.emails.length > 1 ? (
                        <select
                          value={cd.selected_email}
                          onChange={(e) =>
                            setCeasingDirectors((prev) =>
                              prev.map((c) =>
                                c.corporate_director_id === cd.corporate_director_id
                                  ? { ...c, selected_email: e.target.value }
                                  : c
                              )
                            )
                          }
                          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                        >
                          {cd.emails.map((em) => (
                            <option key={em.id} value={em.email}>
                              {em.email}
                              {em.label ? ` (${em.label})` : ""}
                              {em.is_primary ? " — primary" : ""}
                            </option>
                          ))}
                        </select>
                      ) : cd.selected_email ? (
                        <p className="text-sm font-medium">{cd.selected_email}</p>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3 h-3" />
                          No email on file
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Resigning From</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {POSITION_OPTIONS.filter((pos) => cd.position?.includes(pos.value)).map((pos) => (
                          <label key={pos.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cd.positions.includes(pos.value)}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...cd.positions, pos.value]
                                  : cd.positions.filter((p) => p !== pos.value);
                                updateCeasingPositions(
                                  cd.corporate_director_id,
                                  updated.length > 0 ? updated : [cd.position]
                                );
                              }}
                              className="rounded border-input"
                            />
                            {pos.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Cessation Date</Label>
                      <DatePickerInput
                        value={cd.cessation_date}
                        onChange={(date) => updateCeasingDate(cd.corporate_director_id, date)}
                        placeholder="Select cessation date..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Available officers to add as ceasing */}
              {(() => {
                const availableByContact = currentOfficers
                  .filter(
                    (o) =>
                      o.is_current &&
                      !ceasingDirectors.some((cd) => cd.contact_id === o.contact?.id)
                  )
                  .reduce(
                    (acc, o) => {
                      const cId = o.contact?.id;
                      if (!cId) return acc;
                      if (!acc.has(cId)) acc.set(cId, { officer: o, positions: [] });
                      acc.get(cId)!.positions.push(o.formatted_position);
                      return acc;
                    },
                    new Map<number, { officer: OfficerRecord; positions: string[] }>()
                  );

                if (availableByContact.size === 0 && ceasingDirectors.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-2">
                      No current officers found for this company.
                    </p>
                  );
                }

                if (availableByContact.size === 0) return null;

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Current officers — click to add as ceasing:</p>
                    {[...availableByContact.values()].map(({ officer, positions }) => (
                      <button
                        key={officer.id}
                        onClick={() => addCeasingDirector(officer)}
                        className="w-full text-left p-2.5 border border-dashed rounded-lg hover:border-red-300 hover:bg-red-50/50 dark:hover:border-red-800 dark:hover:bg-red-950/20 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                              {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{officer.contact?.display_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {positions.join(", ")}
                                {officer.appointment_date && (
                                  <> &bull; Appointed {format(new Date(officer.appointment_date + "T00:00:00"), DATE_DISPLAY)}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-red-600 dark:group-hover:text-red-400">
                            <Plus className="w-3.5 h-3.5" /> Add
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* New Appointments */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-500" />
                New Appointments
              </h4>

              {newAppointments.map((appt) => (
                <div key={appt.contact_id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{appt.name}</p>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] px-1.5 py-0">
                        <Pencil className="w-2.5 h-2.5 mr-0.5" /> Signs Consent
                      </Badge>
                    </div>
                    <button
                      onClick={() => removeAppointment(appt.contact_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* DOB and Address */}
                  <div className="space-y-2 p-2 bg-muted/50 border rounded text-sm">
                    {/* Date of Birth */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                        {appt.has_dob && !appt.editing_dob && (
                          <button
                            onClick={() =>
                              setNewAppointments((prev) =>
                                prev.map((a) =>
                                  a.contact_id === appt.contact_id ? { ...a, editing_dob: true } : a
                                )
                              )
                            }
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {appt.has_dob && !appt.editing_dob ? (
                        <p className="text-sm">
                          {appt.dob ? format(new Date(appt.dob + "T00:00:00"), DATE_DISPLAY) : "On file"}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!appt.has_dob && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Required
                            </div>
                          )}
                          <DatePickerInput
                            value={appt.editing_dob ? appt.dob : ""}
                            isDob
                            placeholder="Select date of birth..."
                            className="flex-1"
                            onChange={async (date) => {
                              try {
                                await api.patch(`/api/v1/contacts/${appt.contact_id}`, {
                                  contact: { date_of_birth: date },
                                });
                                setNewAppointments((prev) =>
                                  prev.map((a) =>
                                    a.contact_id === appt.contact_id
                                      ? { ...a, has_dob: true, dob: date, editing_dob: false }
                                      : a
                                  )
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                          />
                          {appt.editing_dob && (
                            <button
                              onClick={() =>
                                setNewAppointments((prev) =>
                                  prev.map((a) =>
                                    a.contact_id === appt.contact_id ? { ...a, editing_dob: false } : a
                                  )
                                )
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Residential Address */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Residential Address</Label>
                        {appt.has_address && !appt.editing_address && (
                          <button
                            onClick={() =>
                              setNewAppointments((prev) =>
                                prev.map((a) =>
                                  a.contact_id === appt.contact_id ? { ...a, editing_address: true } : a
                                )
                              )
                            }
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {appt.has_address && !appt.editing_address ? (
                        <p className="text-sm">{appt.address || "On file"}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!appt.has_address && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Required
                            </div>
                          )}
                          <AddressSearchInput
                            defaultValue={appt.editing_address ? appt.address : ""}
                            className="flex-1"
                            inputClassName="h-8 text-sm"
                            onSelect={async (address) => {
                              if (!address) return;
                              try {
                                await api.patch(`/api/v1/contacts/${appt.contact_id}`, {
                                  contact: { residential_address: address },
                                });
                                setNewAppointments((prev) =>
                                  prev.map((a) =>
                                    a.contact_id === appt.contact_id
                                      ? { ...a, has_address: true, address, editing_address: false }
                                      : a
                                  )
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                          />
                          {appt.editing_address && (
                            <button
                              onClick={() =>
                                setNewAppointments((prev) =>
                                  prev.map((a) =>
                                    a.contact_id === appt.contact_id ? { ...a, editing_address: false } : a
                                  )
                                )
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* E-Signature Email */}
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Consent sent for signature to
                      </Label>
                      {appt.emails.length > 1 ? (
                        <select
                          value={appt.selected_email}
                          onChange={(e) =>
                            setNewAppointments((prev) =>
                              prev.map((a) =>
                                a.contact_id === appt.contact_id
                                  ? { ...a, selected_email: e.target.value }
                                  : a
                              )
                            )
                          }
                          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                        >
                          {appt.emails.map((em) => (
                            <option key={em.id} value={em.email}>
                              {em.email}
                              {em.label ? ` (${em.label})` : ""}
                              {em.is_primary ? " — primary" : ""}
                            </option>
                          ))}
                        </select>
                      ) : appt.selected_email ? (
                        <p className="text-sm font-medium">{appt.selected_email}</p>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3 h-3" />
                          No email on file
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Positions</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {POSITION_OPTIONS.map((pos) => (
                          <label key={pos.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={appt.positions.includes(pos.value)}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...appt.positions, pos.value]
                                  : appt.positions.filter((p) => p !== pos.value);
                                updateAppointmentPositions(
                                  appt.contact_id,
                                  updated.length > 0 ? updated : ["director"]
                                );
                              }}
                              className="rounded border-input"
                            />
                            {pos.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Appointment Date</Label>
                      <DatePickerInput
                        value={appt.appointment_date}
                        onChange={(date) => updateAppointmentDate(appt.contact_id, date)}
                        placeholder="Select appointment date..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Contact Search */}
              <div className="relative" ref={searchDropdownRef}>
                <Input
                  placeholder="Search contacts to appoint..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="h-8 text-sm"
                />
                {searchLoading && (
                  <div className="absolute right-2 top-1.5">
                    <Spinner size={16} />
                  </div>
                )}
                {contactResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {contactResults.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => addNewAppointment(contact)}
                        disabled={newAppointments.some((a) => a.contact_id === contact.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <p className="font-medium">{contact.display_name}</p>
                        {contact.email && (
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Validation message */}
            {hasChanges && !canProceedToReview && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                All people must have a date of birth, residential address, and email before proceeding.
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedToReview}>
                Review <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="text-sm font-semibold">Summary</h4>

              {ceasingDirectors.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Ceasing Officeholders</Label>
                  {ceasingDirectors.map((cd) => (
                    <div key={cd.corporate_director_id} className="flex items-center gap-2 py-1">
                      <Badge variant="destructive" className="text-[10px]">
                        Ceasing
                      </Badge>
                      <span className="text-sm">{cd.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({cd.positions.join(", ")}) — {format(new Date(cd.cessation_date + "T00:00:00"), DATE_DISPLAY)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {newAppointments.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">New Appointments</Label>
                  {newAppointments.map((appt) => (
                    <div key={appt.contact_id} className="flex items-center gap-2 py-1">
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]">
                        Appointed
                      </Badge>
                      <span className="text-sm">{appt.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({appt.positions.join(", ")}) — {format(new Date(appt.appointment_date + "T00:00:00"), DATE_DISPLAY)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-1">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Submitting will generate the ASIC document package (Form 484, Resignation Letters,
                Consent to Act, Directors Minutes) and send them for e-signature automatically.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Document type: ASIC Form 484 - Director Changes &bull; Folder: ASIC
              </p>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner size={16} className="mr-2" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Submit & Start Workflow
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
