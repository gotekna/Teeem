"use client";

/**
 * CaseEntitiesTab - Entities view for a case
 *
 * Displays all entities related to a case including:
 * - Case info & sub-cases
 * - Contacts (grouped by alignment: Friendly, Neutral, Opposing)
 * - Companies
 * - Jobs
 *
 * Fully self-contained: manages its own state and data fetching.
 * Includes the Add Contact modal.
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Users,
  Building2,
  Briefcase,
  ExternalLink,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { api } from "@/lib/api";
import { PAGE_SIZE_AUTOCOMPLETE } from "@/lib/constants/pagination-constants";

interface CaseContact {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  role: string;
  relationship_type?: string;
  formatted_relationship_type?: string;
  alignment?: string;
  formatted_alignment?: string;
  alignment_color?: string;
  is_primary?: boolean;
  notes: string | null;
  created_at: string;
  reason?: string;
  added_by_name?: string;
  added_at?: string;
  email_count?: number;
}

interface CaseCompany {
  id: number;
  company_id: number;
  company_name: string;
  abn: string | null;
  role: string;
  notes: string | null;
  created_at: string;
}

interface CaseJob {
  id: number;
  job_id: number;
  job_number: string;
  job_title: string;
  client_name: string | null;
  role: string;
  notes: string | null;
  created_at: string;
}

interface ChildCase {
  id: number;
  case_number: string;
  title: string;
  case_type: string;
  formatted_case_type: string;
  status: string;
  formatted_status: string;
  priority: string;
  formatted_priority: string;
  deadline: string | null;
  overdue: boolean;
  assigned_to: string | null;
  has_children: boolean;
  child_cases_count: number;
  created_at: string;
}

interface CaseData {
  id: number;
  case_number: string;
  title: string;
  case_type: string;
  formatted_case_type: string;
  status: string;
  formatted_status: string;
  priority: string;
  formatted_priority: string;
  child_cases?: ChildCase[];
}

interface ContactSearchResult {
  id: number;
  display_name: string;
  email: string | null;
  company_name: string | null;
}

interface CaseEntitiesTabProps {
  caseId: string;
  caseData: CaseData | null;
}

export function CaseEntitiesTab({ caseId, caseData }: CaseEntitiesTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Entity state
  const [contacts, setContacts] = React.useState<CaseContact[]>([]);
  const [companies, setCompanies] = React.useState<CaseCompany[]>([]);
  const [jobs, setJobs] = React.useState<CaseJob[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Add contact modal state
  const [showAddContact, setShowAddContact] = React.useState(false);
  const [contactSearchQuery, setContactSearchQuery] = React.useState("");
  const [contactSearchResults, setContactSearchResults] = React.useState<ContactSearchResult[]>([]);
  const [searchingContacts, setSearchingContacts] = React.useState(false);
  const [selectedContactRole, setSelectedContactRole] = React.useState("related_party");
  const [contactReason, setContactReason] = React.useState("");
  const [addingContact, setAddingContact] = React.useState(false);

  // Load entities
  const loadEntities = React.useCallback(async () => {
    try {
      setLoading(true);
      const [contactsRes, companiesRes, jobsRes] = await Promise.all([
        api.get<{ success: boolean; data: CaseContact[] }>(`/api/v1/cases/${caseId}/contacts`),
        api.get<{ success: boolean; data: CaseCompany[] }>(`/api/v1/cases/${caseId}/companies`),
        api.get<{ success: boolean; data: CaseJob[] }>(`/api/v1/cases/${caseId}/jobs`),
      ]);
      setContacts(contactsRes.data || []);
      setCompanies(companiesRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  // Search contacts for add dialog
  const searchContactsForCase = async (query: string) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }
    try {
      setSearchingContacts(true);
      // SSoT: Uses PAGE_SIZE_AUTOCOMPLETE from pagination-constants.ts
      const response = await api.get<{ contacts?: ContactSearchResult[] }>("/api/v1/contacts", {
        params: { search: query, per_page: PAGE_SIZE_AUTOCOMPLETE },
      });
      // Filter out contacts already in the case
      const existingIds = contacts.map((c) => c.contact_id);
      const filtered = (response.contacts || []).filter(
        (c) => !existingIds.includes(c.id)
      );
      setContactSearchResults(filtered);
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setSearchingContacts(false);
    }
  };

  // Debounced contact search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (showAddContact && contactSearchQuery.length >= 2) {
        searchContactsForCase(contactSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearchQuery, showAddContact]);

  // Add contact to case
  const handleAddContactToCase = async (contactId: number) => {
    if (!contactReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for adding this contact",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddingContact(true);
      const response = await api.post<{ success: boolean; data: CaseContact }>(
        `/api/v1/cases/${caseId}/add_contact`,
        {
          contact_id: contactId,
          role: selectedContactRole,
          reason: contactReason,
        }
      );
      if (response?.success && response?.data) {
        setContacts([...contacts, response.data]);
        toast({
          title: "Success",
          description: "Contact added to case",
        });
      }
      // Reset dialog state
      setShowAddContact(false);
      setContactSearchQuery("");
      setContactSearchResults([]);
      setSelectedContactRole("related_party");
      setContactReason("");
    } catch (error) {
      console.error("Failed to add contact:", error);
      toast({
        title: "Error",
        description: "Failed to add contact to case",
        variant: "destructive",
      });
    } finally {
      setAddingContact(false);
    }
  };

  // Delete contact from case
  const handleDeleteContact = async (contactId: number, contactName: string) => {
    if (!confirm(`Remove ${contactName} from this case? This will also remove all emails involving this contact.`)) {
      return;
    }

    try {
      const response = await api.delete<{ success: boolean; message: string }>(
        `/api/v1/cases/${caseId}/contacts/${contactId}`
      );

      if (response?.success) {
        setContacts(contacts.filter((c) => c.contact_id !== contactId));
        toast({
          title: "Success",
          description: response.message || "Contact removed from case",
        });
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast({
        title: "Error",
        description: "Failed to remove contact from case",
        variant: "destructive",
      });
    }
  };

  // Filter contacts by alignment
  const friendlyContacts = contacts.filter((c) => c.alignment === "friendly");
  const neutralContacts = contacts.filter((c) => !c.alignment || c.alignment === "neutral");
  const opposingContacts = contacts.filter((c) => c.alignment === "opposing");

  // Render contact card
  const renderContactCard = (
    contact: CaseContact,
    colorClass: string,
    bgClass: string
  ) => (
    <div key={contact.id} className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 ${bgClass} rounded-full ${colorClass}`}>
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{contact.contact_name}</span>
              {contact.is_primary && (
                <Badge variant="default" className="bg-blue-600">
                  Primary
                </Badge>
              )}
              {contact.formatted_alignment && (
                <Badge
                  variant="secondary"
                  className={
                    contact.alignment === "friendly"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : contact.alignment === "opposing"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      : ""
                  }
                >
                  {contact.formatted_alignment}
                </Badge>
              )}
              {contact.email_count !== undefined && contact.email_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {contact.email_count}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {contact.contact_email || "No email"}
            </p>
            {contact.formatted_relationship_type && (
              <Badge variant="outline" className="mt-1 text-xs">
                {contact.formatted_relationship_type}
              </Badge>
            )}
            {contact.reason && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold">Reason:</span> {contact.reason}
              </p>
            )}
            {contact.notes && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">Notes:</span> {contact.notes}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/contacts/${contact.contact_id}`)}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteContact(contact.contact_id, contact.contact_name)}
            className="text-red-600 dark:text-red-400 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Section 1: Case Info & Sub-cases */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <FileText className="h-4 w-4 inline mr-2" />
              Case & Sub-cases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Case Info */}
            {caseData && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{caseData.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {caseData.case_number} &bull; {caseData.formatted_case_type}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={
                          caseData.status === "open"
                            ? "default"
                            : caseData.status === "in_progress"
                            ? "secondary"
                            : caseData.status === "closed"
                            ? "outline"
                            : "default"
                        }
                      >
                        {caseData.formatted_status}
                      </Badge>
                      <Badge
                        variant={
                          caseData.priority === "urgent"
                            ? "destructive"
                            : caseData.priority === "high"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {caseData.formatted_priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-cases */}
            {caseData?.child_cases && caseData.child_cases.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Sub-cases ({caseData.child_cases.length})
                </h4>
                <div className="space-y-2">
                  {caseData.child_cases.map((subCase) => (
                    <div
                      key={subCase.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/cases/${subCase.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{subCase.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {subCase.case_number} &bull; {subCase.formatted_case_type}
                          </p>
                        </div>
                        <Badge variant={subCase.status === "open" ? "default" : "outline"}>
                          {subCase.formatted_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Friendly Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-green-600 dark:text-green-400">Friendly</span> Contacts
              <span className="text-muted-foreground text-sm">
                ({friendlyContacts.length})
              </span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddContact(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </CardHeader>
          <CardContent>
            {friendlyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No friendly contacts
              </p>
            ) : (
              <div className="divide-y">
                {friendlyContacts.map((contact) =>
                  renderContactCard(contact, "text-green-600 dark:text-green-400", "bg-green-100")
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Neutral Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">Neutral</span> Contacts
              <span className="text-muted-foreground text-sm">
                ({neutralContacts.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {neutralContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No neutral contacts
              </p>
            ) : (
              <div className="divide-y">
                {neutralContacts.map((contact) =>
                  renderContactCard(contact, "text-muted-foreground", "bg-muted")
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Opposing Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-red-600 dark:text-red-400">Opposing</span> Contacts
              <span className="text-muted-foreground text-sm">
                ({opposingContacts.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opposingContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No opposing contacts
              </p>
            ) : (
              <div className="divide-y">
                {opposingContacts.map((contact) =>
                  renderContactCard(contact, "text-red-600 dark:text-red-400", "bg-red-100")
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Companies Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              <Building2 className="h-4 w-4 inline mr-2" />
              Companies ({companies.length})
            </CardTitle>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </CardHeader>
          <CardContent>
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No companies linked to this case
              </p>
            ) : (
              <div className="divide-y">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded text-blue-600 dark:text-blue-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{company.company_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {company.abn && `ABN: ${company.abn}`}
                          {company.role && (
                            <Badge variant="outline" className="ml-2">
                              {company.role}
                            </Badge>
                          )}
                        </div>
                        {company.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {company.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/corporate/companies/${company.company_id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              <Briefcase className="h-4 w-4 inline mr-2" />
              Jobs ({jobs.length})
            </CardTitle>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No jobs linked to this case
              </p>
            ) : (
              <div className="divide-y">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded text-amber-600">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{job.job_number}</span>
                          <span className="font-medium">{job.job_title}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {job.client_name && `Client: ${job.client_name}`}
                          {job.role && (
                            <Badge variant="outline" className="ml-2">
                              {job.role}
                            </Badge>
                          )}
                        </div>
                        {job.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/jobs/${job.job_id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Contact Dialog */}
      <Dialog
        open={showAddContact}
        onOpenChange={(open) => {
          setShowAddContact(open);
          if (!open) {
            setContactSearchQuery("");
            setContactSearchResults([]);
            setSelectedContactRole("related_party");
            setContactReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Add Contact to Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedContactRole} onValueChange={setSelectedContactRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">Subject</SelectItem>
                  <SelectItem value="witness">Witness</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="opposing_party">Opposing Party</SelectItem>
                  <SelectItem value="related_party">Related Party</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_reason">
                Reason <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Textarea
                id="contact_reason"
                placeholder="Why is this contact being added to the case? (e.g., 'Key witness in ATO audit', 'Client's accountant')"
                value={contactReason}
                onChange={(e) => setContactReason(e.target.value)}
                rows={3}
                className={!contactReason.trim() ? "border-red-300" : ""}
              />
              {!contactReason.trim() && (
                <p className="text-xs text-red-500 dark:text-red-400">Reason is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Search Contact</Label>
              <SearchInput
                value={contactSearchQuery}
                onChange={setContactSearchQuery}
                placeholder="Search by name, email, or company..."
              />
            </div>
            {searchingContacts && (
              <div className="flex items-center justify-center py-4">
                <Spinner size={20} className="text-muted-foreground" />
              </div>
            )}
            {!searchingContacts &&
              contactSearchQuery.length >= 2 &&
              contactSearchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No contacts found matching &quot;{contactSearchQuery}&quot;
                </p>
              )}
            {contactSearchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {contactSearchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center justify-between"
                    onClick={() => handleAddContactToCase(contact.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-full text-teal-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {contact.display_name || "No name"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {contact.email || "No email"}
                          {contact.company_name && (
                            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                              {contact.company_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {addingContact && <Spinner size={16} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CaseEntitiesTab;
