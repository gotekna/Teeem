"use client";

/**
 * DirectorChangeWizard - ASIC Form 484 Director Change Package
 *
 * 4-step wizard for processing director changes:
 * 1. Company - Confirm company details
 * 2. Changes - Select ceasing/new directors
 * 3. Preview - View generated PDF
 * 4. Send - Send for e-signature
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import type { Corporate, OfficerRecord } from "@/lib/types/corporate";

// --- Types ---

interface CeasingDirector {
  corporate_director_id: number;
  contact_id: number;
  officer_ids: number[];
  name: string;
  position: string;
  positions: string[];
  cessation_date: string;
}

interface NewAppointment {
  contact_id: number;
  name: string;
  email: string;
  positions: string[];
  appointment_date: string;
  has_dob: boolean;
  has_address: boolean;
}

interface ContactSearchResult {
  id: number;
  display_name: string;
  email?: string;
  date_of_birth?: string;
  full_address?: string;
  entity_type?: string;
}

const POSITION_OPTIONS = [
  { value: "director", label: "Director" },
  { value: "secretary", label: "Secretary" },
  { value: "public_officer", label: "Public Officer" },
];

// --- Component ---

interface DirectorChangeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Corporate;
  companyId: string;
  officers: OfficerRecord[];
  onComplete?: () => void;
}

export function DirectorChangeWizard({
  open,
  onOpenChange,
  company,
  companyId,
  officers,
  onComplete,
}: DirectorChangeWizardProps) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 2 state
  const [ceasingDirectors, setCeasingDirectors] = React.useState<CeasingDirector[]>([]);
  const [newAppointments, setNewAppointments] = React.useState<NewAppointment[]>([]);

  // Step 3 state
  const [pdfBase64, setPdfBase64] = React.useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = React.useState<string>("");
  const [generatedDocuments, setGeneratedDocuments] = React.useState<Array<{ type: string; name: string }>>([]);

  // Step 4 state
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [requestNumber, setRequestNumber] = React.useState<string>("");

  // Contact search
  const [contactSearch, setContactSearch] = React.useState("");
  const [contactResults, setContactResults] = React.useState<ContactSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);

  // Current officers (for ceasing selection)
  const currentOfficers = officers.filter((o) => o.is_current);

  // Reset state when wizard opens/closes
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setCeasingDirectors([]);
      setNewAppointments([]);
      setPdfBase64(null);
      setGeneratedFilename("");
      setGeneratedDocuments([]);
      setSent(false);
      setRequestNumber("");
      setError(null);
    }
  }, [open]);

  // Contact search debounce
  React.useEffect(() => {
    if (contactSearch.length < 2) {
      setContactResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get<{ contacts: ContactSearchResult[] }>(
          `/api/v1/contacts?search=${encodeURIComponent(contactSearch)}&per_page=10`
        );
        // Filter to people only (not companies)
        const people = (response.contacts || []).filter(
          (c) => c.entity_type === "person" || c.entity_type === "sole_trader"
        );
        setContactResults(people);
      } catch {
        setContactResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearch]);

  // --- Ceasing Directors ---

  const addCeasingDirector = (officer: OfficerRecord) => {
    // Check if this contact is already added (by contact id, not officer id)
    const contactId = officer.contact?.id;
    if (contactId && ceasingDirectors.some((cd) => cd.contact_id === contactId)) return;

    // Find ALL positions this person holds (they may have multiple officer records)
    const allPositions = currentOfficers
      .filter((o) => o.contact?.id === contactId && o.is_current)
      .map((o) => o.position);
    const uniquePositions = [...new Set(allPositions)];

    // Collect all officer record IDs for this contact
    const officerIds = currentOfficers
      .filter((o) => o.contact?.id === contactId && o.is_current)
      .map((o) => o.id);

    setCeasingDirectors((prev) => [
      ...prev,
      {
        corporate_director_id: officer.id,
        contact_id: contactId || 0,
        officer_ids: officerIds,
        name: officer.contact?.display_name || "Unknown",
        position: officer.position,
        positions: uniquePositions.length > 0 ? uniquePositions : [officer.position],
        cessation_date: format(new Date(), "yyyy-MM-dd"),
      },
    ]);
  };

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

  const addNewAppointment = (contact: ContactSearchResult) => {
    if (newAppointments.some((a) => a.contact_id === contact.id)) return;

    // Default appointment date to the first ceasing director's cessation date (continuity)
    const defaultDate = ceasingDirectors[0]?.cessation_date || format(new Date(), "yyyy-MM-dd");

    setNewAppointments((prev) => [
      ...prev,
      {
        contact_id: contact.id,
        name: contact.display_name,
        email: contact.email || "",
        positions: ["director"],
        appointment_date: defaultDate,
        has_dob: !!contact.date_of_birth,
        has_address: !!contact.full_address,
      },
    ]);
    setContactSearch("");
    setContactResults([]);
  };

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

  // --- Actions ---

  const canProceedToPreview = ceasingDirectors.length > 0 || newAppointments.length > 0;

  const generatePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        pdf_base64: string;
        filename: string;
        documents: Array<{ type: string; name: string }>;
        error?: string;
      }>(`/api/v1/companies/${companyId}/director_changes`, {
        ceasing_directors: ceasingDirectors.map((cd) => ({
          corporate_director_id: cd.corporate_director_id,
          positions: cd.positions,
          cessation_date: cd.cessation_date,
        })),
        new_appointments: newAppointments.map((a) => ({
          contact_id: a.contact_id,
          positions: a.positions,
          appointment_date: a.appointment_date,
        })),
        send_for_signing: false,
      });

      if (response?.success) {
        setPdfBase64(response.pdf_base64);
        setGeneratedFilename(response.filename);
        setGeneratedDocuments(response.documents);
        setStep(3);
      } else {
        setError(response?.error || "Failed to generate package");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate package");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfBase64) return;

    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generatedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sendForSigning = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        request_number: string;
        error?: string;
      }>(`/api/v1/companies/${companyId}/director_changes`, {
        ceasing_directors: ceasingDirectors.map((cd) => ({
          corporate_director_id: cd.corporate_director_id,
          positions: cd.positions,
          cessation_date: cd.cessation_date,
        })),
        new_appointments: newAppointments.map((a) => ({
          contact_id: a.contact_id,
          positions: a.positions,
          appointment_date: a.appointment_date,
        })),
        send_for_signing: true,
      });

      if (response?.success) {
        setSent(true);
        setRequestNumber(response.request_number);
        onComplete?.();
      } else {
        setError(response?.error || "Failed to send for signing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send for signing");
    } finally {
      setSending(false);
    }
  };

  // --- Render ---

  const stepTitles = ["Company", "Changes", "Preview", "Send"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Director Change Package</SheetTitle>
          <SheetDescription>ASIC Form 484 - Change to Company Details</SheetDescription>
        </SheetHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 my-4">
          {stepTitles.map((title, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <React.Fragment key={stepNum}>
                {i > 0 && <div className="flex-1 h-px bg-border" />}
                <div className="flex items-center gap-1.5">
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
              </React.Fragment>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <p className="font-medium">{company.name}</p>
              </div>
              {company.formatted_acn && (
                <div>
                  <Label className="text-xs text-muted-foreground">ACN</Label>
                  <p>{company.formatted_acn}</p>
                </div>
              )}
              {company.formatted_abn && (
                <div>
                  <Label className="text-xs text-muted-foreground">ABN</Label>
                  <p>{company.formatted_abn}</p>
                </div>
              )}
              {company.registered_office_address && (
                <div>
                  <Label className="text-xs text-muted-foreground">Registered Office</Label>
                  <p className="text-sm">{company.registered_office_address}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Confirm the company details above are correct before proceeding. If any details need
                updating, edit them on the company page first.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

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
                    <p className="font-medium text-sm">{cd.name}</p>
                    <button
                      onClick={() => removeCeasingDirector(cd.corporate_director_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Resigning From</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {POSITION_OPTIONS.map((pos) => (
                          <label key={pos.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cd.positions.includes(pos.value)}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...cd.positions, pos.value]
                                  : cd.positions.filter((p) => p !== pos.value);
                                updateCeasingPositions(cd.corporate_director_id, updated.length > 0 ? updated : [cd.position]);
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
                      <Input
                        type="date"
                        value={cd.cessation_date}
                        onChange={(e) => updateCeasingDate(cd.corporate_director_id, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add ceasing director - grouped by contact to avoid duplicates */}
              {(() => {
                // Group officers by contact, excluding already-added contacts
                const availableByContact = currentOfficers
                  .filter((o) => o.is_current && !ceasingDirectors.some((cd) => cd.contact_id === o.contact?.id))
                  .reduce((acc, o) => {
                    const cId = o.contact?.id;
                    if (!cId) return acc;
                    if (!acc.has(cId)) acc.set(cId, { officer: o, positions: [] });
                    acc.get(cId)!.positions.push(o.formatted_position);
                    return acc;
                  }, new Map<number, { officer: OfficerRecord; positions: string[] }>());

                if (availableByContact.size === 0) return null;

                return (
                  <Select
                    onValueChange={(val) => {
                      const officer = currentOfficers.find((o) => o.id === Number(val));
                      if (officer) addCeasingDirector(officer);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select officer to resign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {[...availableByContact.values()].map(({ officer, positions }) => (
                        <SelectItem key={officer.id} value={String(officer.id)}>
                          {officer.contact?.display_name} - {positions.join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <div>
                      <p className="font-medium text-sm">{appt.name}</p>
                      {appt.email && <p className="text-xs text-muted-foreground">{appt.email}</p>}
                    </div>
                    <button
                      onClick={() => removeAppointment(appt.contact_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Warnings */}
                  {(!appt.has_dob || !appt.has_address) && (
                    <a
                      href={`/contacts/${appt.contact_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing: {[!appt.has_dob && "Date of Birth", !appt.has_address && "Address"].filter(Boolean).join(", ")}
                      <span className="text-[10px] opacity-70">(click to update)</span>
                    </a>
                  )}

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
                                updateAppointmentPositions(appt.contact_id, updated.length > 0 ? updated : ["director"]);
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
                      <Input
                        type="date"
                        value={appt.appointment_date}
                        onChange={(e) => updateAppointmentDate(appt.contact_id, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Contact Search */}
              <div className="relative">
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

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={generatePreview} disabled={!canProceedToPreview || loading}>
                {loading ? (
                  <>
                    <Spinner size={16} className="mr-1" /> Generating...
                  </>
                ) : (
                  <>
                    Generate Preview <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Generated Documents</h4>
              {generatedDocuments.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>{doc.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {doc.type}
                  </Badge>
                </div>
              ))}
            </div>

            {/* PDF Preview */}
            {pdfBase64 && (
              <div className="border rounded-lg overflow-hidden" style={{ height: "400px" }}>
                <iframe
                  src={`data:application/pdf;base64,${pdfBase64}`}
                  className="w-full h-full"
                  title="Director Change Package Preview"
                />
              </div>
            )}

            <Button variant="outline" onClick={downloadPdf} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download {generatedFilename}
            </Button>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Proceed to Send <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Send for Signing */}
        {step === 4 && !sent && (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Signers</h4>

              {/* Ceasing directors need to sign resignation */}
              {ceasingDirectors.map((cd) => (
                <div key={cd.corporate_director_id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{cd.name}</p>
                    <p className="text-xs text-muted-foreground">Resignation Letter</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">Resigning</Badge>
                </div>
              ))}

              {/* New appointments need to sign consent */}
              {newAppointments.map((appt) => (
                <div key={appt.contact_id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{appt.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {appt.email || "No email - add email to contact first"}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
                    Appointing
                  </Badge>
                </div>
              ))}
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Each signer will receive an email with a secure link to view and sign their document.
                Documents will be signed sequentially (resignation first, then consent).
              </p>
            </div>

            {/* Check all signers have emails */}
            {(ceasingDirectors.length > 0 || newAppointments.some((a) => !a.email)) && (
              <div className="space-y-1">
                {newAppointments
                  .filter((a) => !a.email)
                  .map((a) => (
                    <div key={a.contact_id} className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {a.name} has no email address - add one before sending
                    </div>
                  ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={sendForSigning}
                disabled={sending || newAppointments.some((a) => !a.email)}
              >
                {sending ? (
                  <>
                    <Spinner size={16} className="mr-1" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Send for Signing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Sent Confirmation */}
        {step === 4 && sent && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Package Sent</h3>
              <p className="text-sm text-muted-foreground">
                Director change package has been sent for signing.
              </p>
              {requestNumber && (
                <p className="text-sm">
                  Reference: <span className="font-mono font-medium">{requestNumber}</span>
                </p>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
