"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Search,
  X,
  Plus,
  User,
  Building2,
  Users,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";

interface Contact {
  id: number;
  display_name: string;
  email?: string;
  company_name?: string;
}

interface JobType {
  id: number;
  name: string;
}

interface JobStatus {
  id: number;
  name: string;
}

interface ExtractedContact {
  contact_id?: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  contact_exists?: boolean;
}

interface EmailProposal {
  id: number;
  email?: {
    from_email: string;
    subject: string;
    has_attachments: boolean;
  };
  extracted_data?: {
    job_title?: string;
    property_address?: string;
    job_type?: string;
    contract_value?: number;
    confidence_score?: number;
    description?: string;
    customer?: ExtractedContact;
    referral_contact?: ExtractedContact;
    external_sales?: ExtractedContact[];
    internal_sales?: {
      user_name: string;
      user_email: string;
    };
  };
}

interface ProposalApprovalDialogProps {
  proposal: EmailProposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (proposalId: number, userEdits: Record<string, unknown>) => void;
  processing: boolean;
  priceOverride?: string;
}

export function ProposalApprovalDialog({
  proposal,
  open,
  onOpenChange,
  onApprove,
  processing,
  priceOverride,
}: ProposalApprovalDialogProps) {
  const data = proposal.extracted_data || {};

  // Contact states
  const [clientContact, setClientContact] = useState<ExtractedContact | null>(null);
  const [externalSalesContacts, setExternalSalesContacts] = useState<ExtractedContact[]>([]);
  const [referralContact, setReferralContact] = useState<ExtractedContact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searchMode, setSearchMode] = useState<"client" | "external_sales" | "referral" | null>(null);
  const [searching, setSearching] = useState(false);

  // Job detail states
  const [jobAddress, setJobAddress] = useState(data.property_address || data.job_title || "");
  const [jobType, setJobType] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<number | null>(null);
  const [jobEstimate, setJobEstimate] = useState<string>(
    priceOverride || data.contract_value?.toString() || ""
  );
  const [notes, setNotes] = useState("");

  // Dropdown options
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Initialize with AI-detected contacts
    if (data.customer) {
      setClientContact(data.customer);
    }
    if (data.external_sales?.length) {
      setExternalSalesContacts(data.external_sales.filter((s) => s.contact_exists || s.email));
    }
    if (data.referral_contact) {
      setReferralContact(data.referral_contact);
    }

    loadJobOptions();
     
  }, [open]);

  const loadJobOptions = async () => {
    setLoadingOptions(true);
    try {
      const [typesRes, statusesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
      ]);

      setJobTypes(typesRes.job_types || []);
      setJobStatuses(statusesRes.job_statuses || []);

      // Match AI-detected job type
      if (data.job_type && typesRes.job_types) {
        const matched = typesRes.job_types.find(
          (t) =>
            t.name.toLowerCase().includes(data.job_type!.toLowerCase()) ||
            data.job_type!.toLowerCase().includes(t.name.toLowerCase())
        );
        if (matched) setJobType(matched.id);
      }

      // Default to "Enquiry" status
      if (statusesRes.job_statuses) {
        const enquiry = statusesRes.job_statuses.find((s) => s.name === "Enquiry");
        if (enquiry) setJobStatus(enquiry.id);
      }
    } catch (error) {
      console.error("Failed to load job options:", error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const searchContacts = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get<{ contacts: Contact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(response.contacts || []);
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchContacts(value);
  };

  const handleSetClient = (contact: Contact) => {
    setClientContact({
      contact_id: contact.id,
      name: contact.display_name,
      email: contact.email,
      contact_exists: true,
    });
    resetSearch();
  };

  const handleAddExternalSales = (contact: Contact) => {
    if (!externalSalesContacts.find((c) => c.contact_id === contact.id)) {
      setExternalSalesContacts([
        ...externalSalesContacts,
        {
          contact_id: contact.id,
          name: contact.display_name,
          email: contact.email,
          contact_exists: true,
        },
      ]);
    }
    resetSearch();
  };

  const handleSetReferral = (contact: Contact) => {
    setReferralContact({
      contact_id: contact.id,
      name: contact.display_name,
      email: contact.email,
      contact_exists: true,
    });
    resetSearch();
  };

  const resetSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchMode(null);
  };

  const handleSubmit = () => {
    const userEdits: Record<string, unknown> = {};

    if (clientContact?.contact_id) {
      userEdits.client_contact_id = clientContact.contact_id;
    }

    if (referralContact?.contact_id) {
      userEdits.referral_contact_id = referralContact.contact_id;
    }

    if (externalSalesContacts.length > 0) {
      userEdits.external_sales_contact_ids = externalSalesContacts.map((c) => c.contact_id);
    }

    if (jobAddress && jobAddress !== data.job_title) {
      userEdits.job_title = jobAddress;
    }

    if (jobType) {
      userEdits.job_type_id = jobType;
    }

    if (jobStatus) {
      userEdits.job_status_id = jobStatus;
    }

    if (jobEstimate) {
      userEdits.contract_value = parseFloat(jobEstimate);
    }

    if (notes) {
      userEdits.notes = notes;
    }

    onApprove(proposal.id, userEdits);
  };

  const ContactSearchSection = ({
    title,
    icon: Icon,
    mode,
    selectedContact,
    onRemove,
    onSelect,
  }: {
    title: string;
    icon: typeof User;
    mode: "client" | "external_sales" | "referral";
    selectedContact: ExtractedContact | null;
    onRemove: () => void;
    onSelect: (contact: Contact) => void;
  }) => (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <Label>{title}</Label>
          </div>
          {!selectedContact && searchMode !== mode && (
            <Button variant="ghost" size="sm" onClick={() => setSearchMode(mode)}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {selectedContact ? (
          <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
            <div className="text-sm">
              <div className="font-medium">{selectedContact.name}</div>
              {selectedContact.email && (
                <div className="text-muted-foreground text-xs">{selectedContact.email}</div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : searchMode === mode ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9"
                autoFocus
              />
            </div>
            {searching && <Spinner className="h-4 w-4" />}
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => onSelect(contact)}
                    className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{contact.display_name}</div>
                    {contact.email && (
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={resetSearch}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">No {title.toLowerCase()} selected</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review & Approve Proposal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client */}
          <ContactSearchSection
            title="Client"
            icon={Building2}
            mode="client"
            selectedContact={clientContact}
            onRemove={() => setClientContact(null)}
            onSelect={handleSetClient}
          />

          {/* Referral */}
          <ContactSearchSection
            title="Referral"
            icon={User}
            mode="referral"
            selectedContact={referralContact}
            onRemove={() => setReferralContact(null)}
            onSelect={handleSetReferral}
          />

          {/* External Sales */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Label>External Sales</Label>
                </div>
                {searchMode !== "external_sales" && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchMode("external_sales")}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              {searchMode === "external_sales" && (
                <div className="space-y-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {searchResults.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleAddExternalSales(contact)}
                          className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">{contact.display_name}</div>
                          {contact.email && (
                            <div className="text-xs text-muted-foreground">{contact.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={resetSearch}>
                    Cancel
                  </Button>
                </div>
              )}

              {externalSalesContacts.length > 0 ? (
                <div className="space-y-2">
                  {externalSalesContacts.map((contact, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                      <div className="text-sm">
                        <div className="font-medium">{contact.name}</div>
                        {contact.email && (
                          <div className="text-muted-foreground text-xs">{contact.email}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExternalSalesContacts(
                            externalSalesContacts.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                searchMode !== "external_sales" && (
                  <div className="text-sm text-muted-foreground italic">No external sales selected</div>
                )
              )}
            </CardContent>
          </Card>

          {/* Job Address */}
          <Card>
            <CardContent className="pt-4">
              <Label htmlFor="jobAddress">Job Address</Label>
              <Input
                id="jobAddress"
                value={jobAddress}
                onChange={(e) => setJobAddress(e.target.value)}
                placeholder="Enter full address"
                className="mt-2"
              />
              {data.description && (
                <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Job Type */}
          <Card>
            <CardContent className="pt-4">
              <Label>Job Type</Label>
              <Select
                value={jobType?.toString() || ""}
                onValueChange={(val) => setJobType(val ? parseInt(val) : null)}
                disabled={loadingOptions}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select job type..." />
                </SelectTrigger>
                <SelectContent>
                  {jobTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.job_type && (
                <p className="mt-1 text-xs text-muted-foreground">AI detected: {data.job_type}</p>
              )}
            </CardContent>
          </Card>

          {/* Job Status */}
          <Card>
            <CardContent className="pt-4">
              <Label>Job Status</Label>
              <Select
                value={jobStatus?.toString() || ""}
                onValueChange={(val) => setJobStatus(val ? parseInt(val) : null)}
                disabled={loadingOptions}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select job status..." />
                </SelectTrigger>
                <SelectContent>
                  {jobStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Job Estimate */}
          <Card>
            <CardContent className="pt-4">
              <Label htmlFor="jobEstimate">Job Estimate</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="jobEstimate"
                  type="number"
                  value={jobEstimate}
                  onChange={(e) => setJobEstimate(e.target.value)}
                  placeholder="0.00"
                  className="pl-9"
                />
              </div>
              {data.contract_value && (
                <p className="mt-1 text-xs text-muted-foreground">
                  AI detected: ${data.contract_value.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-4">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the job..."
                className="mt-2"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing}
            className="bg-green-600 hover:bg-green-700"
          >
            {processing ? "Creating Job..." : "Approve & Create Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
