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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AddressSearchInput } from "@/components/ui/address-search-input";
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
  CalendarIcon,
  Check,
  Clock,
  Download,
  FileText,
  Pencil,
  Plus,
  Mail,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { pollPdfGeneration, type PdfGenerationStatus } from "@/lib/pdf-generation";
import type { Corporate, OfficerRecord } from "@/lib/types/corporate";

// --- Date Picker (standard Popover + Calendar, replaces native input[type=date]) ---

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
  const [open, setOpen] = React.useState(false);
  const parsed = value ? new Date(value + "T00:00:00") : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full justify-start text-left font-normal text-sm",
            !parsed && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-3 w-3" />
          {parsed ? format(parsed, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          defaultMonth={parsed || (isDob ? new Date(1980, 0) : new Date())}
          onSelect={(date) => {
            if (date) {
              const iso = format(date, "yyyy-MM-dd");
              onChange(iso);
              setOpen(false);
            }
          }}
          {...(isDob ? {
            captionLayout: "dropdown",
            fromYear: 1920,
            toYear: currentYear,
          } : {
            fromYear: currentYear - 5,
            toYear: currentYear + 1,
          })}
        />
      </PopoverContent>
    </Popover>
  );
}

// --- Types ---

interface ContactEmail {
  id: number;
  email: string;
  is_primary: boolean;
  label: string | null;
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
  emails: ContactEmail[];      // All available emails
  selected_email: string;      // Email selected for e-signature
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
  emails: ContactEmail[];      // All available emails
  selected_email: string;      // Email selected for e-signature
}

interface ContactSearchResult {
  id: number;
  display_name: string;
  email?: string;
  date_of_birth?: string;
  full_address?: string;
  entity_type?: string;
}

interface PendingGeneration {
  id: number;
  status: string;
  generatorType: string;
  filename: string | null;
  downloadUrl?: string | null;
  createdAt: string;
  companyName?: string;
  companyId?: string;
  userName?: string;
  error?: string;
  result?: Record<string, unknown>;
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

/**
 * Fetch a PDF from the backend download endpoint and return a blob URL.
 * The backend streams content directly when Authorization header is present,
 * avoiding CORS issues with S3/Wasabi presigned URL redirects.
 */
async function fetchPdfAsBlob(downloadPath: string): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null);
    const resp = await fetch(`${baseUrl}${downloadPath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (resp.ok) {
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    }
    console.error("[DirectorChangeWizard] PDF fetch failed:", resp.status, resp.statusText);
    return null;
  } catch (err) {
    console.error("[DirectorChangeWizard] PDF fetch error:", err);
    return null;
  }
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
  const [loadingMessage, setLoadingMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Step 2 state
  const [ceasingDirectors, setCeasingDirectors] = React.useState<CeasingDirector[]>([]);
  const [newAppointments, setNewAppointments] = React.useState<NewAppointment[]>([]);

  // Step 3 state
  const [pdfGenerationId, setPdfGenerationId] = React.useState<number | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = React.useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = React.useState<string>("");
  const [generatedDocuments, setGeneratedDocuments] = React.useState<Array<{ type: string; name: string }>>([]);

  // Step 4 state
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [requestNumber, setRequestNumber] = React.useState<string>("");
  const [eSignRequestId, setESignRequestId] = React.useState<number | null>(null);

  // Pending generations (cross-tenant)
  const [pendingGenerations, setPendingGenerations] = React.useState<PendingGeneration[]>([]);
  const [loadingPending, setLoadingPending] = React.useState(false);

  // Contact search
  const [contactSearch, setContactSearch] = React.useState("");
  const [contactResults, setContactResults] = React.useState<ContactSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);

  // Current officers (for ceasing selection)
  const currentOfficers = officers.filter((o) => o.is_current);

  // Reset state when wizard opens/closes - check for unprocessed PDF generations
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setCeasingDirectors([]);
      setNewAppointments([]);
      setPdfGenerationId(null);
      if (pdfDownloadUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(pdfDownloadUrl);
      }
      setPdfDownloadUrl(null);
      setGeneratedFilename("");
      setGeneratedDocuments([]);
      setSent(false);
      setRequestNumber("");
      setError(null);
      setPendingGenerations([]);

      // Check for ALL unprocessed PDF generations across the tenant
      checkPendingGenerations();
    }
  }, [open]);

  // Check for unprocessed PDF generations across the entire tenant
  const checkPendingGenerations = async () => {
    setLoadingPending(true);
    try {
      const response = await api.get<{ success: boolean; data: PendingGeneration[] }>(
        `/api/v1/pdf_generations?status=pending,processing,completed&limit=20`
      );
      if (response?.success && response.data?.length) {
        // Only show recent ones (within last 24 hours)
        const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = response.data.filter(
          (pg) => new Date(pg.createdAt || "").getTime() > recentCutoff
        );
        setPendingGenerations(recent);
      }
    } catch {
      // Silently fail - not critical
    } finally {
      setLoadingPending(false);
    }
  };

  // Cancel (pending/processing) or dismiss (completed) a PDF generation
  const dismissGeneration = async (gen: PendingGeneration) => {
    try {
      const endpoint = gen.status === "completed"
        ? `/api/v1/pdf_generations/${gen.id}/dismiss`
        : `/api/v1/pdf_generations/${gen.id}/cancel`;
      await api.patch(endpoint, {});
      setPendingGenerations((prev) => prev.filter((pg) => pg.id !== gen.id));
    } catch {
      setError("Failed to dismiss generation");
    }
  };

  // Continue/resume a pending, processing, or completed PDF generation
  const continueGeneration = async (gen: PendingGeneration) => {
    setPendingGenerations([]); // Dismiss the list

    if (gen.status === "completed" && gen.downloadUrl) {
      // Already done - skip to preview
      setPdfGenerationId(gen.id);
      setLoadingMessage("Loading completed preview...");
      setLoading(true);
      try {
        const blobUrl = await fetchPdfAsBlob(gen.downloadUrl!);
        if (blobUrl) setPdfDownloadUrl(blobUrl);
        setGeneratedFilename(gen.filename || "");
        const docs = gen.result?.documents as Array<{ type: string; name: string }> | undefined;
        if (docs) setGeneratedDocuments(docs);
        setStep(3);
      } finally {
        setLoading(false);
      }
    } else if (gen.status === "pending" || gen.status === "processing") {
      // Still in progress - resume polling
      setPdfGenerationId(gen.id);
      setLoading(true);
      setLoadingMessage(gen.status === "processing" ? "Generating PDF documents..." : "Queued — waiting for worker...");
      setStep(2);
      try {
        const result = await pollPdfGeneration(gen.id, {
          intervalMs: 1500,
          maxWaitMs: 120_000,
          onProgress: (status) => {
            if (status.status === "processing") setLoadingMessage("Generating PDF documents...");
            else if (status.status === "pending") setLoadingMessage("Queued — waiting for worker...");
          },
        });
        if (result.status === "completed" && result.downloadUrl) {
          setLoadingMessage("Downloading preview...");
          const blobUrl = await fetchPdfAsBlob(result.downloadUrl);
          if (blobUrl) setPdfDownloadUrl(blobUrl);
          setGeneratedFilename(result.filename || "");
          const docs = result.result?.documents as Array<{ type: string; name: string }> | undefined;
          if (docs) setGeneratedDocuments(docs);
          setStep(3);
        } else {
          setError(result.error || "PDF generation failed — please try again");
        }
      } finally {
        setLoading(false);
      }
    }
  };

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

  const addCeasingDirector = async (officer: OfficerRecord) => {
    // Check if this contact is already added (by contact id, not officer id)
    const contactId = officer.contact?.id;
    if (contactId && ceasingDirectors.some((cd) => cd.contact_id === contactId)) return;

    // Find ALL positions this person holds (they may have multiple officer records)
    const allPositions = currentOfficers
      .filter((o) => o.contact?.id === contactId && o.is_current)
      .map((o) => o.position);
    const deduped = [...new Set(allPositions)];
    // Remove combined position strings (e.g. "Director Secretary Public Officer")
    // that are just concatenations of individual positions already in the list
    const uniquePositions = deduped.filter((pos) => {
      const others = deduped.filter(
        (p) => p !== pos && pos.toLowerCase().includes(p.toLowerCase())
      );
      return others.length < 2;
    });

    // Collect all officer record IDs for this contact
    const officerIds = currentOfficers
      .filter((o) => o.contact?.id === contactId && o.is_current)
      .map((o) => o.id);

    // Fetch contact details for DOB/address/emails
    let dob = "";
    let address = "";
    let hasDob = false;
    let hasAddress = false;
    let emails: ContactEmail[] = [];
    let selectedEmail = officer.contact?.email || "";
    if (contactId) {
      try {
        const detail = await api.get<{ contact: { date_of_birth?: string; residential_address?: string | null; full_address?: string; contact_emails?: ContactEmail[]; contact_addresses?: Array<{ line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; country?: string; address_type?: string }> } }>(
          `/api/v1/contacts/${contactId}`
        );
        const c = detail.contact;
        dob = c?.date_of_birth || "";
        hasDob = !!dob && dob !== "[RESTRICTED]";
        // Check residential_address first, fall back to contact_addresses
        if (c?.residential_address && c.residential_address !== "[RESTRICTED]") {
          hasAddress = true;
          address = c.residential_address;
        } else if (c?.contact_addresses?.length) {
          const streetAddr = c.contact_addresses.find((a) => a.address_type === "STREET") || c.contact_addresses[0];
          const parts = [streetAddr.line1, streetAddr.line2, streetAddr.city, streetAddr.region, streetAddr.postal_code].filter(Boolean);
          if (parts.length > 0) {
            hasAddress = true;
            address = parts.join(", ");
          }
        }
        // Emails for e-signature delivery
        emails = c?.contact_emails || [];
        const primary = emails.find((e) => e.is_primary);
        selectedEmail = primary?.email || emails[0]?.email || selectedEmail;
      } catch { /* proceed without details */ }
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
        cessation_date: format(new Date(), "yyyy-MM-dd"),
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

  const addNewAppointment = async (contact: ContactSearchResult) => {
    if (newAppointments.some((a) => a.contact_id === contact.id)) return;

    // Default appointment date to the first ceasing director's cessation date (continuity)
    const defaultDate = ceasingDirectors[0]?.cessation_date || format(new Date(), "yyyy-MM-dd");

    // Fetch full contact details to get DOB, residential address, and emails
    // ASIC forms require residential_address specifically, not just contact_addresses
    let hasDob = !!contact.date_of_birth;
    let hasAddress = false;
    let dobValue = "";
    let addressValue = "";
    let emails: ContactEmail[] = [];
    let selectedEmail = contact.email || "";
    try {
      const detail = await api.get<{ contact: { date_of_birth?: string; residential_address?: string | null; contact_emails?: ContactEmail[]; contact_addresses?: Array<{ line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; country?: string; address_type?: string }> } }>(
        `/api/v1/contacts/${contact.id}`
      );
      const c = detail.contact;
      hasDob = !!c?.date_of_birth && c.date_of_birth !== "[RESTRICTED]";
      if (hasDob && c?.date_of_birth) {
        dobValue = c.date_of_birth;
      }
      // Check residential_address first (ASIC requirement), fall back to contact_addresses
      if (c?.residential_address && c.residential_address !== "[RESTRICTED]") {
        hasAddress = true;
        addressValue = c.residential_address;
      } else if (c?.contact_addresses?.length) {
        const streetAddr = c.contact_addresses.find((a) => a.address_type === "STREET") || c.contact_addresses[0];
        const parts = [streetAddr.line1, streetAddr.line2, streetAddr.city, streetAddr.region, streetAddr.postal_code].filter(Boolean);
        if (parts.length > 0) {
          hasAddress = true;
          addressValue = parts.join(", ");
        }
      }
      // Emails for e-signature delivery
      emails = c?.contact_emails || [];
      const primary = emails.find((e) => e.is_primary);
      selectedEmail = primary?.email || emails[0]?.email || selectedEmail;
    } catch {
      // If fetch fails, keep search-level values
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
    setLoadingMessage("Submitting request...");
    setError(null);
    try {
      // Enqueue async PDF generation on worker dyno
      const response = await api.post<{
        success: boolean;
        data: {
          pdfGenerationId: number;
          statusUrl: string;
          downloadUrl: string;
        };
        error?: string;
      }>(`/api/v1/companies/${companyId}/director_changes`, {
        ceasing_directors: ceasingDirectors.map((cd) => ({
          corporate_director_id: cd.corporate_director_id,
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

      if (!response?.success || !response.data?.pdfGenerationId) {
        setError("Failed to start PDF generation");
        return;
      }

      const genId = response.data.pdfGenerationId;
      setPdfGenerationId(genId);
      setLoadingMessage("Queued — waiting for worker...");

      // Poll until complete
      const result = await pollPdfGeneration(genId, {
        intervalMs: 1500,
        maxWaitMs: 120_000,
        onProgress: (status) => {
          if (status.status === "processing") {
            setLoadingMessage("Generating PDF documents...");
          } else if (status.status === "pending") {
            setLoadingMessage("Queued — waiting for worker...");
          }
        },
      });

      if (result.status === "completed" && result.downloadUrl) {
        setLoadingMessage("Downloading preview...");
        const blobUrl = await fetchPdfAsBlob(result.downloadUrl);
        if (blobUrl) {
          setPdfDownloadUrl(blobUrl);
        } else {
          setError("Failed to download generated PDF");
        }
        setGeneratedFilename(result.filename || "");
        const docs = result.result?.documents as Array<{ type: string; name: string }> | undefined;
        if (docs) {
          setGeneratedDocuments(docs);
        }
        setStep(3);
      } else {
        setError(result.error || "PDF generation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate package");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfDownloadUrl) return;
    const link = document.createElement("a");
    link.href = pdfDownloadUrl;
    link.download = generatedFilename || "director-change-package.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendForSigning = async () => {
    setSending(true);
    setLoadingMessage("Submitting request...");
    setError(null);
    try {
      // Enqueue async PDF generation + send on worker dyno
      const response = await api.post<{
        success: boolean;
        data: {
          pdfGenerationId: number;
        };
        error?: string;
      }>(`/api/v1/companies/${companyId}/director_changes`, {
        ceasing_directors: ceasingDirectors.map((cd) => ({
          corporate_director_id: cd.corporate_director_id,
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
        send_for_signing: true,
      });

      if (!response?.success || !response.data?.pdfGenerationId) {
        setError("Failed to start send process");
        return;
      }

      setLoadingMessage("Queued — waiting for worker...");

      // Poll until complete
      const result = await pollPdfGeneration(response.data.pdfGenerationId, {
        intervalMs: 1500,
        maxWaitMs: 120_000,
        onProgress: (status) => {
          if (status.status === "processing") {
            setLoadingMessage("Generating & sending documents...");
          } else if (status.status === "pending") {
            setLoadingMessage("Queued — waiting for worker...");
          }
        },
      });

      if (result.status === "completed") {
        setSent(true);
        setRequestNumber((result.result?.request_number as string) || "");
        setESignRequestId((result.result?.e_signature_request_id as number) || null);
        onComplete?.();
      } else {
        setError(result.error || "Failed to send for signing");
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
    <Sheet open={open} onOpenChange={(v) => {
      // Prevent closing while PDF is generating or sending
      if (!v && (loading || sending)) return;
      onOpenChange(v);
    }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto"
        onInteractOutside={(e) => { if (loading || sending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (loading || sending) e.preventDefault(); }}
      >
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

        {/* Pending Generations List (cross-tenant) */}
        {step === 1 && pendingGenerations.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {pendingGenerations.length} unfinished PDF generation{pendingGenerations.length > 1 ? "s" : ""} found. Continue or cancel before starting a new one.
              </p>
            </div>

            <div className="space-y-2">
              {pendingGenerations.map((gen) => (
                <div key={gen.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {gen.companyName || "Unknown Company"}
                      </p>
                      <Badge
                        variant={gen.status === "completed" ? "default" : "secondary"}
                        className={`text-xs shrink-0 ${
                          gen.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : gen.status === "processing"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : ""
                        }`}
                      >
                        {gen.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {gen.generatorType?.replace(/_/g, " ")} &middot;{" "}
                      {gen.createdAt ? format(new Date(gen.createdAt), "dd/MM HH:mm") : "Unknown time"}
                      {gen.userName ? ` · by ${gen.userName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => continueGeneration(gen)}
                    >
                      {gen.status === "completed" ? "View" : "Continue"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 text-xs ${gen.status === "completed" ? "text-muted-foreground" : "text-destructive hover:text-destructive"}`}
                      onClick={() => dismissGeneration(gen)}
                    >
                      {gen.status === "completed" ? "Dismiss" : "Cancel"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={async () => {
                // Dismiss all on backend, then clear local state
                await Promise.allSettled(
                  pendingGenerations.map((gen) => {
                    const endpoint = gen.status === "completed"
                      ? `/api/v1/pdf_generations/${gen.id}/dismiss`
                      : `/api/v1/pdf_generations/${gen.id}/cancel`;
                    return api.patch(endpoint, {});
                  })
                );
                setPendingGenerations([]);
              }}
            >
              Dismiss all — start new generation
            </Button>
          </div>
        )}

        {loadingPending && step === 1 && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Spinner size={16} /> Checking for unfinished generations...
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

                  {/* DOB and Address for ceasing director */}
                  <div className="space-y-2 p-2 bg-muted/50 border rounded text-sm">
                    {/* Date of Birth */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                        {cd.has_dob && !cd.editing_dob && (
                          <button
                            onClick={() => setCeasingDirectors((prev) =>
                              prev.map((c) => c.corporate_director_id === cd.corporate_director_id ? { ...c, editing_dob: true } : c)
                            )}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {cd.has_dob && !cd.editing_dob ? (
                        <p className="text-sm">
                          {cd.dob ? format(new Date(cd.dob + "T00:00:00"), "dd/MM/yyyy") : "On file"}
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
                                  prev.map((c) => c.corporate_director_id === cd.corporate_director_id
                                    ? { ...c, has_dob: true, dob: date, editing_dob: false }
                                    : c)
                                );
                              } catch { /* ignore */ }
                            }}
                          />
                          {cd.editing_dob && (
                            <button
                              onClick={() => setCeasingDirectors((prev) =>
                                prev.map((c) => c.corporate_director_id === cd.corporate_director_id ? { ...c, editing_dob: false } : c)
                              )}
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
                            onClick={() => setCeasingDirectors((prev) =>
                              prev.map((c) => c.corporate_director_id === cd.corporate_director_id ? { ...c, editing_address: true } : c)
                            )}
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
                                  prev.map((c) => c.corporate_director_id === cd.corporate_director_id
                                    ? { ...c, has_address: true, address, editing_address: false }
                                    : c)
                                );
                              } catch { /* ignore */ }
                            }}
                          />
                          {cd.editing_address && (
                            <button
                              onClick={() => setCeasingDirectors((prev) =>
                                prev.map((c) => c.corporate_director_id === cd.corporate_director_id ? { ...c, editing_address: false } : c)
                              )}
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
                          onChange={(e) => setCeasingDirectors((prev) =>
                            prev.map((c) => c.corporate_director_id === cd.corporate_director_id
                              ? { ...c, selected_email: e.target.value } : c)
                          )}
                          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                        >
                          {cd.emails.map((em) => (
                            <option key={em.id} value={em.email}>
                              {em.email}{em.label ? ` (${em.label})` : ""}{em.is_primary ? " \u2014 primary" : ""}
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
                      <DatePickerInput
                        value={cd.cessation_date}
                        onChange={(date) => updateCeasingDate(cd.corporate_director_id, date)}
                        placeholder="Select cessation date..."
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

                  {/* DOB and Address - display values for confirmation or inline entry if missing */}
                  <div className="space-y-2 p-2 bg-muted/50 border rounded text-sm">
                    {/* Date of Birth */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                        {appt.has_dob && !appt.editing_dob && (
                          <button
                            onClick={() => setNewAppointments((prev) =>
                              prev.map((a) => a.contact_id === appt.contact_id ? { ...a, editing_dob: true } : a)
                            )}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                        )}
                      </div>
                      {appt.has_dob && !appt.editing_dob ? (
                        <p className="text-sm">
                          {appt.dob ? format(new Date(appt.dob + "T00:00:00"), "dd/MM/yyyy") : "On file"}
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
                                  prev.map((a) => a.contact_id === appt.contact_id
                                    ? { ...a, has_dob: true, dob: date, editing_dob: false }
                                    : a)
                                );
                              } catch { /* ignore */ }
                            }}
                          />
                          {appt.editing_dob && (
                            <button
                              onClick={() => setNewAppointments((prev) =>
                                prev.map((a) => a.contact_id === appt.contact_id ? { ...a, editing_dob: false } : a)
                              )}
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
                            onClick={() => setNewAppointments((prev) =>
                              prev.map((a) => a.contact_id === appt.contact_id ? { ...a, editing_address: true } : a)
                            )}
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
                                  prev.map((a) => a.contact_id === appt.contact_id
                                    ? { ...a, has_address: true, address, editing_address: false }
                                    : a)
                                );
                              } catch { /* ignore */ }
                            }}
                          />
                          {appt.editing_address && (
                            <button
                              onClick={() => setNewAppointments((prev) =>
                                prev.map((a) => a.contact_id === appt.contact_id ? { ...a, editing_address: false } : a)
                              )}
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
                          onChange={(e) => setNewAppointments((prev) =>
                            prev.map((a) => a.contact_id === appt.contact_id
                              ? { ...a, selected_email: e.target.value } : a)
                          )}
                          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                        >
                          {appt.emails.map((em) => (
                            <option key={em.id} value={em.email}>
                              {em.email}{em.label ? ` (${em.label})` : ""}{em.is_primary ? " \u2014 primary" : ""}
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
                    <Spinner size={16} className="mr-1" /> {loadingMessage || "Generating..."}
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
              {generatedDocuments.map((doc, i) => {
                // Determine signer for this document
                let signerLabel = "";
                let signerColor = "text-muted-foreground";
                if (doc.type === "resignation") {
                  const cd = ceasingDirectors.find((c) => doc.name.includes(c.name));
                  signerLabel = cd ? `${cd.name} signs → ${cd.selected_email}` : "";
                  signerColor = "text-red-600 dark:text-red-400";
                } else if (doc.type === "consent") {
                  const appt = newAppointments.find((a) => doc.name.includes(a.name));
                  signerLabel = appt ? `${appt.name} signs → ${appt.selected_email}` : "";
                  signerColor = "text-green-600 dark:text-green-400";
                } else if (doc.type === "minutes") {
                  signerLabel = "Signed by Chairperson at meeting";
                  signerColor = "text-blue-600 dark:text-blue-400";
                } else if (doc.type === "form_484") {
                  signerLabel = "Internal record — no signature required";
                }

                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm cursor-pointer hover:bg-muted transition-colors"
                    onDoubleClick={() => pdfDownloadUrl && window.open(pdfDownloadUrl, "_blank")}
                    title="Double-click to open in new window"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="select-none">{doc.name}</span>
                      {signerLabel && (
                        <div className={`text-xs ${signerColor} flex items-center gap-1`}>
                          <Pencil className="w-3 h-3" />
                          {signerLabel}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                      {doc.type}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* PDF Preview */}
            {pdfDownloadUrl && (
              <div className="border rounded-lg overflow-hidden" style={{ height: "500px" }}>
                <object
                  data={`${pdfDownloadUrl}#toolbar=1&navpanes=0`}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <p className="p-4 text-center text-muted-foreground">
                    PDF preview not available in this browser.{" "}
                    <button onClick={downloadPdf} className="text-primary underline">Download PDF</button>
                  </p>
                </object>
              </div>
            )}

            <Button variant="outline" onClick={downloadPdf} disabled={!pdfDownloadUrl} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download {generatedFilename || "PDF"}
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
                    <p className="text-xs text-muted-foreground">Resignation Letter → {cd.selected_email}</p>
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
                      Consent to Act → {appt.email || "No email - add email to contact first"}
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
                    <Spinner size={16} className="mr-1" /> {loadingMessage || "Sending..."}
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
              <h3 className="text-lg font-semibold">Package Sent for Signing</h3>
              <p className="text-sm text-muted-foreground">
                Signing invitations have been sent to all signers.
              </p>
              {requestNumber && (
                <p className="text-xs text-muted-foreground">
                  Reference: <span className="font-mono font-medium">{requestNumber}</span>
                </p>
              )}
            </div>

            {/* Show who received emails */}
            <div className="w-full space-y-2 px-2">
              <p className="text-xs font-medium text-muted-foreground text-center">Emails sent to:</p>
              {ceasingDirectors.map((cd) => (
                <div key={cd.corporate_director_id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{cd.name}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{cd.selected_email}</span>
                </div>
              ))}
              {newAppointments.map((appt) => (
                <div key={appt.contact_id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{appt.name}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{appt.email}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              {eSignRequestId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    window.location.href = `/e-signature/${eSignRequestId}`;
                  }}
                >
                  <FileText className="w-4 h-4 mr-1" /> View Signing Status
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
