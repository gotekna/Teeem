"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Mail,
  Search,
  Trash2,
  Plus,
  Building2,
  User,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Phone,
  Globe,
  ExternalLink,
  Merge,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

interface MatchingContact {
  id: number;
  display_name: string;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null; // Direct line for person
  entity_type: string;
  xero_contact_type: string | null; // CUSTOMER, SUPPLIER, or null
  xero_invoice_count: number | null; // If > 0, likely a customer
  relationship_to_domain_company_exists: boolean;
  relationships_to_parent_companies: {
    company_id: number;
    company_name: string;
    exists: boolean;
  }[];
}

interface Company {
  id: number | null;
  name: string;
  entity_type: string;
  office_phone: string | null;
  website: string | null;
  exists: boolean;
}

interface Phones {
  mobile?: string;
  office?: string;
  direct?: string;
}

interface PreviewItem {
  email: string;
  person_name_from_email: string;
  email_exists_on_contact: boolean;
  existing_contact_with_email: {
    id: number;
    display_name: string;
    entity_type: string;
  } | null;
  matching_contacts: MatchingContact[];
  domain_company: Company | null; // null for personal email domains (gmail, hotmail, etc.)
  parent_companies: Company[];
  phones: Phones;
}

interface SelectionState {
  selected: boolean;
  selectedContactId: number | null;
  createNewContact: boolean; // If true, create a new contact instead of matching existing
  newContactName: string; // Name for the new contact (editable)
  addEmail: boolean;
  addMobile: boolean;
  addDirect: boolean; // Add direct line to contact
  addOfficeToCompany: boolean; // Add office phone to company
  isPerfectMatch: boolean; // If true, this is a perfect match - no confirmation needed for mobile
  linkToDomainCompany: boolean;
  parentCompanyLinks: Record<number, boolean>; // company_id -> enabled
  mergeContacts: boolean; // If true, merge duplicate contacts into selected one
  contactsToMerge: number[]; // IDs of contacts to merge into selected contact
}

interface Mailbox {
  user_id: number;
  user_name: string;
  email: string;
}

function ExtractEmployeesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get emails from URL params if present
  const emailsFromUrl = searchParams.get("emails");
  const initialEmails = emailsFromUrl ? emailsFromUrl.split(",") : [""];

  const [emailPatterns, setEmailPatterns] = React.useState<string[]>(initialEmails);
  const [searching, setSearching] = React.useState(false);
  const [executing, setExecuting] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<PreviewItem[]>([]);
  const [selections, setSelections] = React.useState<Record<number, SelectionState>>({});
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(1); // Always start at step 1, auto-search will move to step 2
  const [initialLoadDone, setInitialLoadDone] = React.useState(false);

  // Mailbox selection state
  const [mailboxes, setMailboxes] = React.useState<Mailbox[]>([]);
  const [selectedMailboxes, setSelectedMailboxes] = React.useState<Set<string>>(new Set());
  const [loadingMailboxes, setLoadingMailboxes] = React.useState(true);

  // Fetch connected mailboxes on mount
  React.useEffect(() => {
    const fetchMailboxes = async () => {
      try {
        const result = await api.get<{ success: boolean; mailboxes: Mailbox[] }>(
          "/api/v1/contacts/connected_mailboxes"
        );
        setMailboxes(result.mailboxes || []);
      } catch (error) {
        console.error("Failed to fetch mailboxes:", error);
        toast({
          title: "Warning",
          description: "Could not load connected mailboxes",
          variant: "destructive",
        });
      } finally {
        setLoadingMailboxes(false);
      }
    };
    fetchMailboxes();
  }, []);

  // Auto-search on load if emails are in URL
  React.useEffect(() => {
    if (emailsFromUrl && !initialLoadDone) {
      setInitialLoadDone(true);
      const validEmails = initialEmails.filter((e) => e.trim().length > 0);
      if (validEmails.length > 0) {
        handleSearchWithEmails(validEmails);
      }
    }
  }, [emailsFromUrl, initialLoadDone]);

  const toggleMailbox = (email: string) => {
    setSelectedMailboxes((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const selectAllMailboxes = () => {
    setSelectedMailboxes(new Set(mailboxes.map((m) => m.email)));
  };

  const deselectAllMailboxes = () => {
    setSelectedMailboxes(new Set());
  };

  const handleSearchWithEmails = async (emails: string[]) => {
    if (emails.length === 0) return;

    setSearching(true);
    try {
      const result = await api.get<{ preview: PreviewItem[]; total_found: number }>(
        "/api/v1/contacts/preview_employee_extraction",
        {
          params: { email_patterns: emails.join(",") },
        }
      );
      setPreviewData(result.preview || []);

      // Initialize selections
      const defaultSelections: Record<number, SelectionState> = {};
      result.preview.forEach((item: PreviewItem, idx: number) => {
        // Select contact to keep: prioritize the one with Xero data (invoices)
        // to preserve accounting connections during merge
        const primaryContact = item.matching_contacts.length > 0
          ? item.matching_contacts.reduce((best, current) => {
              // Prefer contact with invoices
              const bestHasInvoices = (best.xero_invoice_count ?? 0) > 0;
              const currentHasInvoices = (current.xero_invoice_count ?? 0) > 0;
              if (currentHasInvoices && !bestHasInvoices) return current;
              if (bestHasInvoices && !currentHasInvoices) return best;
              // If both or neither have invoices, prefer the one with more invoices
              if ((current.xero_invoice_count ?? 0) > (best.xero_invoice_count ?? 0)) return current;
              // Otherwise keep first one
              return best;
            }, item.matching_contacts[0])
          : undefined;
        const hasNoMatches = item.matching_contacts.length === 0;

        const parentLinks: Record<number, boolean> = {};
        item.parent_companies.forEach((pc) => {
          if (pc.id) {
            const existingRel = primaryContact?.relationships_to_parent_companies.find(
              (r) => r.company_id === pc.id
            );
            parentLinks[pc.id] = !existingRel?.exists;
          }
        });

        // If multiple contacts found, suggest merging them (they're likely duplicates)
        // Merge all OTHER contacts into the primary (the one with Xero data)
        const otherContactIds = item.matching_contacts
          .filter((c) => c.id !== primaryContact?.id)
          .map((c) => c.id);

        // Don't suggest employee relationships for customers - they are clients, not employees
        // Check xero_contact_type or fallback to xero_invoice_count (if they have invoices, they're likely a customer)
        const isCustomer = primaryContact?.xero_contact_type === "CUSTOMER" ||
          (primaryContact?.xero_invoice_count && primaryContact.xero_invoice_count > 0);

        // Perfect match = single contact match + employer already linked + email matches (case-insensitive)
        // For perfect matches, we auto-add mobile without asking
        const isPerfectMatch = !hasNoMatches &&
          item.matching_contacts.length === 1 &&
          !!primaryContact?.relationship_to_domain_company_exists &&
          (primaryContact?.email?.toLowerCase() === item.email.toLowerCase() || !primaryContact?.email);

        defaultSelections[idx] = {
          selected: true,
          selectedContactId: primaryContact?.id || null,
          createNewContact: hasNoMatches, // Create new if no matches found
          newContactName: item.person_name_from_email, // Default to extracted name
          addEmail: true, // Always add email for new contacts
          addMobile: !!item.phones?.mobile, // Auto-add mobile if found
          addDirect: !!(item.phones?.direct && !primaryContact?.office_phone), // Add direct if found and contact doesn't have one
          addOfficeToCompany: !!(item.phones?.office && item.domain_company?.exists && !item.domain_company?.office_phone), // Add office to company if found and company doesn't have one
          isPerfectMatch: !!isPerfectMatch,
          // Default to YES for new contacts (they're employees of the domain company)
          linkToDomainCompany: hasNoMatches ? true : (isCustomer ? false : !!primaryContact && !primaryContact.relationship_to_domain_company_exists),
          parentCompanyLinks: hasNoMatches ? {} : (isCustomer ? {} : parentLinks),
          mergeContacts: otherContactIds.length > 0, // Default to merge if duplicates found
          contactsToMerge: otherContactIds,
        };
      });
      setSelections(defaultSelections);
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Failed to search:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to search email warehouse",
        variant: "destructive",
      });
      setCurrentStep(1);
    } finally {
      setSearching(false);
    }
  };

  const handleAddEmail = () => {
    setEmailPatterns([...emailPatterns, ""]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmailPatterns(emailPatterns.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    const newPatterns = [...emailPatterns];
    newPatterns[index] = value;
    setEmailPatterns(newPatterns);
  };

  const handleSearch = async () => {
    // Combine mailbox selections with manual email patterns
    const mailboxEmails = Array.from(selectedMailboxes);
    const manualEmails = emailPatterns.filter((p) => p.trim().length > 0);
    const allEmails = [...new Set([...mailboxEmails, ...manualEmails])]; // Dedupe

    if (allEmails.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one mailbox or enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Update URL with email patterns so refresh works
    const newUrl = `/admin/system/extract-employees?emails=${encodeURIComponent(allEmails.join(","))}`;
    window.history.replaceState({}, "", newUrl);

    setSearching(true);
    try {
      const result = await api.get<{ preview: PreviewItem[]; total_found: number }>(
        "/api/v1/contacts/preview_employee_extraction",
        {
          params: { email_patterns: allEmails.join(",") },
        }
      );
      setPreviewData(result.preview || []);

      // Initialize selections - prioritize contact with Xero data when merging
      const defaultSelections: Record<number, SelectionState> = {};
      result.preview.forEach((item: PreviewItem, idx: number) => {
        // Select contact to keep: prioritize the one with Xero data (invoices)
        // to preserve accounting connections during merge
        const primaryContact = item.matching_contacts.length > 0
          ? item.matching_contacts.reduce((best, current) => {
              // Prefer contact with invoices
              const bestHasInvoices = (best.xero_invoice_count ?? 0) > 0;
              const currentHasInvoices = (current.xero_invoice_count ?? 0) > 0;
              if (currentHasInvoices && !bestHasInvoices) return current;
              if (bestHasInvoices && !currentHasInvoices) return best;
              // If both or neither have invoices, prefer the one with more invoices
              if ((current.xero_invoice_count ?? 0) > (best.xero_invoice_count ?? 0)) return current;
              // Otherwise keep first one
              return best;
            }, item.matching_contacts[0])
          : undefined;
        const hasNoMatches = item.matching_contacts.length === 0;

        const parentLinks: Record<number, boolean> = {};
        item.parent_companies.forEach((pc) => {
          if (pc.id) {
            // Check if relationship already exists for this contact
            const existingRel = primaryContact?.relationships_to_parent_companies.find(
              (r) => r.company_id === pc.id
            );
            parentLinks[pc.id] = !existingRel?.exists; // Default ON if doesn't exist
          }
        });

        // If multiple contacts found, suggest merging them (they're likely duplicates)
        // Merge all OTHER contacts into the primary (the one with Xero data)
        const otherContactIds = item.matching_contacts
          .filter((c) => c.id !== primaryContact?.id)
          .map((c) => c.id);

        // Don't suggest employee relationships for customers - they are clients, not employees
        // Check xero_contact_type or fallback to xero_invoice_count (if they have invoices, they're likely a customer)
        const isCustomer = primaryContact?.xero_contact_type === "CUSTOMER" ||
          (primaryContact?.xero_invoice_count && primaryContact.xero_invoice_count > 0);

        // Perfect match = single contact match + employer already linked + email matches (case-insensitive)
        // For perfect matches, we auto-add mobile without asking
        const isPerfectMatch = !hasNoMatches &&
          item.matching_contacts.length === 1 &&
          !!primaryContact?.relationship_to_domain_company_exists &&
          (primaryContact?.email?.toLowerCase() === item.email.toLowerCase() || !primaryContact?.email);

        defaultSelections[idx] = {
          selected: true,
          selectedContactId: primaryContact?.id || null,
          createNewContact: hasNoMatches, // Create new if no matches found
          newContactName: item.person_name_from_email, // Default to extracted name
          addEmail: true, // Always add email
          addMobile: !!item.phones?.mobile, // Auto-add mobile if found
          addDirect: !!(item.phones?.direct && !primaryContact?.office_phone), // Add direct if found and contact doesn't have one
          addOfficeToCompany: !!(item.phones?.office && item.domain_company?.exists && !item.domain_company?.office_phone), // Add office to company if found and company doesn't have one
          isPerfectMatch: !!isPerfectMatch,
          // Default to YES for new contacts (they're employees of the domain company)
          linkToDomainCompany: hasNoMatches ? true : (isCustomer ? false : !!primaryContact && !primaryContact.relationship_to_domain_company_exists),
          parentCompanyLinks: hasNoMatches ? {} : (isCustomer ? {} : parentLinks),
          mergeContacts: otherContactIds.length > 0, // Default to merge if duplicates found
          contactsToMerge: otherContactIds,
        };
      });
      setSelections(defaultSelections);
      setCurrentStep(2);
      toast({
        title: "Search Complete",
        description: `Found ${result.total_found} potential matches`,
      });
    } catch (error: any) {
      console.error("Failed to search:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to search email warehouse",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleExecute = async () => {
    const extractions = previewData
      .map((item, idx) => {
        const sel = selections[idx];
        if (!sel?.selected) return null;
        // For new contacts, we don't need a selectedContactId
        if (!sel.createNewContact && !sel.selectedContactId) return null;

        return {
          contact_id: sel.selectedContactId,
          create_new_contact: sel.createNewContact,
          new_contact_name: sel.newContactName || item.person_name_from_email,
          email: item.email,
          add_email: sel.addEmail,
          mobile: item.phones?.mobile,
          add_mobile: sel.addMobile,
          direct: item.phones?.direct,
          add_direct: sel.addDirect,
          office: item.phones?.office,
          add_office_to_company: sel.addOfficeToCompany,
          link_to_domain_company: sel.linkToDomainCompany && item.domain_company != null,
          domain_company_id: item.domain_company?.id || null,
          domain_company_name: item.domain_company?.name || null,
          parent_company_ids: Object.entries(sel.parentCompanyLinks)
            .filter(([_, enabled]) => enabled)
            .map(([id, _]) => parseInt(id)),
          merge_contacts: sel.mergeContacts,
          contacts_to_merge: sel.mergeContacts ? sel.contactsToMerge : [],
        };
      })
      .filter(Boolean);

    if (extractions.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item to process",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    try {
      const result = await api.post<any>("/api/v1/contacts/extract_employees", {
        extractions,
      });
      const parts = [];
      if (result.contacts_created > 0) parts.push(`${result.contacts_created} contacts created`);
      if (result.relationships_created > 0) parts.push(`${result.relationships_created} relationships`);
      if (result.emails_added > 0) parts.push(`${result.emails_added} emails`);
      if (result.mobiles_added > 0) parts.push(`${result.mobiles_added} mobiles`);
      if (result.directs_added > 0) parts.push(`${result.directs_added} direct lines`);
      if (result.company_phones_added > 0) parts.push(`${result.company_phones_added} company phones`);
      if (result.contacts_merged > 0) parts.push(`${result.contacts_merged} contacts merged`);
      toast({
        title: "Success!",
        description: parts.length > 0 ? `Added: ${parts.join(", ")}` : "No changes made",
      });
      router.push("/contacts");
    } catch (error: any) {
      console.error("Failed to create relationships:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to create relationships",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const toggleSelection = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        selected: !prev[idx]?.selected,
      },
    }));
  };

  const selectContact = (idx: number, contactId: number) => {
    const item = previewData[idx];
    const contact = item.matching_contacts.find((c) => c.id === contactId);

    // Recalculate defaults for this contact
    const parentLinks: Record<number, boolean> = {};
    item.parent_companies.forEach((pc) => {
      if (pc.id) {
        const existingRel = contact?.relationships_to_parent_companies.find(
          (r) => r.company_id === pc.id
        );
        parentLinks[pc.id] = !existingRel?.exists;
      }
    });

    // Recalculate which contacts to merge (all except newly selected)
    const otherContactIds = item.matching_contacts
      .filter((c) => c.id !== contactId)
      .map((c) => c.id);

    // Check if this is a perfect match (employer linked + email matches)
    const isPerfectMatch = !!(contact?.relationship_to_domain_company_exists &&
      (contact?.email?.toLowerCase() === item.email.toLowerCase() || !contact?.email));

    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        selectedContactId: contactId,
        addEmail: !contact?.email || contact.email.toLowerCase() !== item.email.toLowerCase(), // Add email if contact doesn't have one or has different (case-insensitive)
        addMobile: !!item.phones?.mobile && !contact?.mobile_phone, // Add mobile if found and contact doesn't have one
        addDirect: !!item.phones?.direct && !contact?.office_phone, // Add direct if found and contact doesn't have one
        addOfficeToCompany: !!(item.phones?.office && item.domain_company?.exists && !item.domain_company?.office_phone), // Add office to company
        isPerfectMatch: !!isPerfectMatch,
        linkToDomainCompany: !contact?.relationship_to_domain_company_exists,
        parentCompanyLinks: parentLinks,
        contactsToMerge: otherContactIds,
      },
    }));
  };

  const toggleMergeContacts = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        mergeContacts: !prev[idx]?.mergeContacts,
      },
    }));
  };

  const toggleAddEmail = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        addEmail: !prev[idx]?.addEmail,
      },
    }));
  };

  const toggleAddMobile = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        addMobile: !prev[idx]?.addMobile,
      },
    }));
  };

  const toggleAddDirect = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        addDirect: !prev[idx]?.addDirect,
      },
    }));
  };

  const toggleAddOfficeToCompany = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        addOfficeToCompany: !prev[idx]?.addOfficeToCompany,
      },
    }));
  };

  const toggleDomainCompanyLink = (idx: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        linkToDomainCompany: !prev[idx]?.linkToDomainCompany,
      },
    }));
  };

  const toggleParentCompanyLink = (idx: number, companyId: number) => {
    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        parentCompanyLinks: {
          ...prev[idx]?.parentCompanyLinks,
          [companyId]: !prev[idx]?.parentCompanyLinks?.[companyId],
        },
      },
    }));
  };

  const toggleAll = () => {
    const allSelected = Object.values(selections).every((s) => s.selected);
    setSelections((prev) => {
      const newSelections = { ...prev };
      Object.keys(newSelections).forEach((key) => {
        newSelections[parseInt(key)] = {
          ...newSelections[parseInt(key)],
          selected: !allSelected,
        };
      });
      return newSelections;
    });
  };

  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  // Count what will be created
  const emailsToAdd = previewData.filter((_, idx) => selections[idx]?.selected && selections[idx]?.addEmail).length;
  const relationshipsToCreate = previewData.reduce((count, item, idx) => {
    const sel = selections[idx];
    if (!sel?.selected) return count;
    let c = 0;
    if (sel.linkToDomainCompany) c++;
    c += Object.values(sel.parentCompanyLinks).filter(Boolean).length;
    return count + c;
  }, 0);
  const contactsToMerge = previewData.reduce((count, _, idx) => {
    const sel = selections[idx];
    if (!sel?.selected || !sel.mergeContacts) return count;
    return count + sel.contactsToMerge.length;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/system/contact-types")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Extract Relationships from Email</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Find people in your email warehouse and link them to existing contacts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? "text-primary" : "text-muted-foreground"}`}>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep === 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                }`}
              >
                1
              </div>
              <span className="font-medium">Search Email Warehouse</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed" />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep === 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                }`}
              >
                2
              </div>
              <span className="font-medium">Review & Create</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {currentStep === 1 ? (
          /* Step 1: Search */
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Email Warehouse Search</CardTitle>
                </div>
                <CardDescription>
                  Select which mailboxes to search for external contacts.
                  The system will find people who have emailed these addresses and match them to existing contacts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connected Mailboxes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Connected Mailboxes</label>
                    {mailboxes.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllMailboxes}
                          disabled={selectedMailboxes.size === mailboxes.length}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllMailboxes}
                          disabled={selectedMailboxes.size === 0}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  {loadingMailboxes ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Spinner size={20} className="mr-2" />
                      Loading mailboxes...
                    </div>
                  ) : mailboxes.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No connected mailboxes found. Connect Outlook in Settings to enable mailbox selection.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mailboxes.map((mailbox) => (
                        <div
                          key={mailbox.email}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedMailboxes.has(mailbox.email)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => toggleMailbox(mailbox.email)}
                        >
                          <Checkbox
                            checked={selectedMailboxes.has(mailbox.email)}
                            onCheckedChange={() => toggleMailbox(mailbox.email)}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{mailbox.user_name}</div>
                              <div className="text-sm text-muted-foreground truncate">{mailbox.email}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Email (optional) */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Or add an additional email address</label>
                  {emailPatterns.map((pattern, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={pattern}
                          onChange={(e) => handleEmailChange(idx, e.target.value)}
                          placeholder="e.g., accounts@company.com.au"
                          className="pl-10"
                        />
                      </div>
                      {emailPatterns.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveEmail(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddEmail} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Email
                  </Button>
                </div>

                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    <strong>How it works:</strong> The system searches your email warehouse for anyone who has sent or
                    received emails to/from the selected mailboxes. It then matches them to existing contacts by name and lets
                    you add email addresses and create relationships.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleSearch}
                  disabled={searching || (selectedMailboxes.size === 0 && emailPatterns.every((p) => !p.trim()))}
                  className="w-full"
                  size="lg"
                >
                  {searching ? (
                    <>
                      <Spinner size={20} className="mr-2" />
                      Searching Email Warehouse...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Search & Preview Results
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Step 2: Review & Create */
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{selectedCount}</div>
                      <div className="text-xs text-muted-foreground">Selected</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{emailsToAdd}</div>
                      <div className="text-xs text-muted-foreground">Emails to Add</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <LinkIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{relationshipsToCreate}</div>
                      <div className="text-xs text-muted-foreground">Relationships</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {contactsToMerge > 0 && (
                <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <Merge className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{contactsToMerge}</div>
                        <div className="text-xs text-muted-foreground">Duplicates to Merge</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Found {previewData.length} Email Matches</CardTitle>
                    <CardDescription>Match emails to existing contacts and create relationships</CardDescription>
                  </div>
                  <Button variant="outline" onClick={toggleAll}>
                    {selectedCount === previewData.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {previewData.map((item, idx) => {
                    const sel = selections[idx];
                    const selectedContact = item.matching_contacts.find((c) => c.id === sel?.selectedContactId);

                    return (
                      <div
                        key={idx}
                        className={`border-2 rounded-xl p-6 transition-all ${
                          sel?.selected ? "bg-primary/5 border-primary" : "bg-card border-border opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={sel?.selected}
                            onCheckedChange={() => toggleSelection(idx)}
                            className="mt-1"
                          />

                          <div className="flex-1 space-y-4">
                            {/* Email Found */}
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                                  Email Found
                                </div>
                                <div className="font-mono text-lg">{item.email}</div>
                                <div className="text-sm text-muted-foreground">
                                  Extracted name: <span className="font-medium">{item.person_name_from_email}</span>
                                </div>
                                {/* Phone numbers from signature */}
                                {(item.phones?.mobile || item.phones?.office || item.phones?.direct) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.phones.mobile && (
                                      <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                                        <Phone className="h-3 w-3" />
                                        Mobile: {item.phones.mobile}
                                      </Badge>
                                    )}
                                    {item.phones.office && (
                                      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300">
                                        <Phone className="h-3 w-3" />
                                        Office: {item.phones.office}
                                      </Badge>
                                    )}
                                    {item.phones.direct && (
                                      <Badge variant="outline" className="gap-1 text-purple-700 border-purple-300">
                                        <Phone className="h-3 w-3" />
                                        Direct: {item.phones.direct}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex items-center justify-center">
                              <ArrowRight className="h-6 w-6 text-muted-foreground" />
                            </div>

                            {/* Match to Contact or Create New */}
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                              <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">
                                {item.matching_contacts.length === 0 ? "Create New Contact" : "Match to Existing Contact"}
                              </div>

                              {item.matching_contacts.length === 0 ? (
                                /* No matches - offer to create new contact */
                                <div className="space-y-3">
                                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700">
                                    <div className="flex items-start gap-2">
                                      <Plus className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-blue-800 dark:text-blue-300">
                                          No Matching Contact Found
                                        </div>
                                        <div className="text-sm text-blue-700 dark:text-blue-400">
                                          We couldn&apos;t find an existing contact matching &quot;{item.person_name_from_email}&quot;.
                                          A new contact will be created.
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border">
                                    <User className="h-5 w-5 text-blue-600" />
                                    <div className="flex-1">
                                      <Input
                                        value={sel?.newContactName || item.person_name_from_email}
                                        onChange={(e) => {
                                          setSelections((prev) => ({
                                            ...prev,
                                            [idx]: {
                                              ...prev[idx],
                                              newContactName: e.target.value,
                                            },
                                          }));
                                        }}
                                        className="font-semibold"
                                        placeholder="Contact name"
                                      />
                                      <div className="text-xs text-muted-foreground font-mono mt-1">{item.email}</div>
                                    </div>
                                    <Badge className="bg-blue-600">
                                      <Plus className="h-3 w-3 mr-1" />
                                      New
                                    </Badge>
                                  </div>
                                </div>
                              ) : item.matching_contacts.length > 1 ? (
                                <>
                                  {/* Warning about duplicate contacts */}
                                  <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-amber-800 dark:text-amber-300">
                                          Duplicate Contacts Found
                                        </div>
                                        <div className="text-sm text-amber-700 dark:text-amber-400">
                                          These {item.matching_contacts.length} contacts appear to be the same person.
                                          Select one to keep and merge the others into it.
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    {item.matching_contacts.map((contact) => (
                                      <button
                                        key={contact.id}
                                        onClick={() => selectContact(idx, contact.id)}
                                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                          sel?.selectedContactId === contact.id
                                            ? "border-green-500 bg-green-100 dark:bg-green-900/50"
                                            : "border-transparent bg-white dark:bg-gray-800 hover:border-green-300"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <User className="h-5 w-5 text-green-600" />
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold">{contact.display_name}</span>
                                              {(contact.xero_contact_type === "CUSTOMER" || (contact.xero_invoice_count != null && contact.xero_invoice_count > 0)) && (
                                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                                  Customer{contact.xero_invoice_count != null && contact.xero_invoice_count > 0 ? ` (${contact.xero_invoice_count} invoices)` : ""}
                                                </Badge>
                                              )}
                                              {contact.xero_contact_type === "SUPPLIER" && (
                                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Supplier</Badge>
                                              )}
                                            </div>
                                            {contact.email && (
                                              <div className="text-xs text-muted-foreground font-mono">{contact.email}</div>
                                            )}
                                            {contact.mobile_phone && (
                                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                {contact.mobile_phone}
                                              </div>
                                            )}
                                          </div>
                                          {sel?.selectedContactId === contact.id ? (
                                            <Badge className="bg-green-600">Keep This One</Badge>
                                          ) : sel?.mergeContacts ? (
                                            <Badge variant="outline" className="text-amber-600 border-amber-400">
                                              <Merge className="h-3 w-3 mr-1" />
                                              Will Merge
                                            </Badge>
                                          ) : null}
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  {/* Merge toggle */}
                                  <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300">
                                    <div className="flex items-center gap-2">
                                      <Merge className="h-4 w-4 text-amber-600" />
                                      <span className="text-sm font-medium">
                                        Merge {sel?.contactsToMerge.length} duplicate{sel?.contactsToMerge.length !== 1 ? "s" : ""} into{" "}
                                        <span className="font-semibold">{selectedContact?.display_name}</span>
                                      </span>
                                    </div>
                                    <div className="flex rounded-lg overflow-hidden border-2 border-amber-400">
                                      <button
                                        onClick={() => toggleMergeContacts(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          sel?.mergeContacts
                                            ? "bg-amber-500 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleMergeContacts(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.mergeContacts
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border">
                                  <User className="h-5 w-5 text-green-600" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold">{selectedContact?.display_name}</span>
                                      {sel?.isPerfectMatch && (
                                        <Badge className="bg-green-600 text-xs gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Perfect Match
                                        </Badge>
                                      )}
                                      {(selectedContact?.xero_contact_type === "CUSTOMER" || (selectedContact?.xero_invoice_count != null && selectedContact.xero_invoice_count > 0)) && (
                                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                          Customer{selectedContact?.xero_invoice_count != null && selectedContact.xero_invoice_count > 0 ? ` (${selectedContact.xero_invoice_count} invoices)` : ""}
                                        </Badge>
                                      )}
                                      {selectedContact?.xero_contact_type === "SUPPLIER" && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Supplier</Badge>
                                      )}
                                    </div>
                                    {selectedContact?.email && (
                                      <div className="text-xs text-muted-foreground font-mono">{selectedContact.email}</div>
                                    )}
                                    {selectedContact?.mobile_phone && (
                                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {selectedContact.mobile_phone}
                                      </div>
                                    )}
                                  </div>
                                  <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />
                                </div>
                              )}

                              {/* Actions: Add Email / Add Mobile */}
                              <div className="mt-4 space-y-2">
                                {/* Show "Nothing to update" message for perfect matches with no changes needed */}
                                {sel?.isPerfectMatch &&
                                 selectedContact?.email?.toLowerCase() === item.email.toLowerCase() &&
                                 !item.phones?.mobile &&
                                 selectedContact?.relationship_to_domain_company_exists && (
                                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted dark:bg-gray-800/50 border border-border text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-sm">
                                      Contact is already up to date — no phone found in email signature
                                    </span>
                                  </div>
                                )}

                                {/* Add Email Option - show if selected contact doesn't have an email OR has a different email (case-insensitive) */}
                                {(!selectedContact?.email || selectedContact.email.toLowerCase() !== item.email.toLowerCase()) && (
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200">
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-purple-600" />
                                      <span className="text-sm">
                                        Add email <span className="font-mono font-semibold">{item.email}</span>
                                      </span>
                                    </div>
                                    <div className="flex rounded-lg overflow-hidden border-2 border-purple-400">
                                      <button
                                        onClick={() => toggleAddEmail(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          sel?.addEmail
                                            ? "bg-purple-500 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleAddEmail(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.addEmail
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Add Mobile Option - show if we found a mobile AND contact doesn't have one */}
                                {item.phones?.mobile && !selectedContact?.mobile_phone && (
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4 text-green-600" />
                                      <span className="text-sm">
                                        Add mobile <span className="font-mono font-semibold">{item.phones.mobile}</span>
                                      </span>
                                    </div>
                                    {/* For perfect matches, auto-add mobile without asking */}
                                    {sel?.isPerfectMatch ? (
                                      <Badge className="bg-green-600 gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Will Add
                                      </Badge>
                                    ) : (
                                      <div className="flex rounded-lg overflow-hidden border-2 border-green-400">
                                        <button
                                          onClick={() => toggleAddMobile(idx)}
                                          className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                            sel?.addMobile
                                              ? "bg-green-500 text-white"
                                              : "bg-white dark:bg-gray-800 text-muted-foreground"
                                          }`}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={() => toggleAddMobile(idx)}
                                          className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                            !sel?.addMobile
                                              ? "bg-gray-400 text-white"
                                              : "bg-white dark:bg-gray-800 text-muted-foreground"
                                          }`}
                                        >
                                          No
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Add Direct Line Option - show if we found a direct AND contact doesn't have office_phone */}
                                {item.phones?.direct && !selectedContact?.office_phone && (
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm">
                                        Add direct line <span className="font-mono font-semibold">{item.phones.direct}</span>
                                      </span>
                                    </div>
                                    {sel?.isPerfectMatch ? (
                                      <Badge className="bg-blue-600 gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Will Add
                                      </Badge>
                                    ) : (
                                      <div className="flex rounded-lg overflow-hidden border-2 border-blue-400">
                                        <button
                                          onClick={() => toggleAddDirect(idx)}
                                          className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                            sel?.addDirect
                                              ? "bg-blue-500 text-white"
                                              : "bg-white dark:bg-gray-800 text-muted-foreground"
                                          }`}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={() => toggleAddDirect(idx)}
                                          className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                            !sel?.addDirect
                                              ? "bg-gray-400 text-white"
                                              : "bg-white dark:bg-gray-800 text-muted-foreground"
                                          }`}
                                        >
                                          No
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Add Office Phone to Company Option - show if we found office AND company exists AND company doesn't have office_phone */}
                                {item.phones?.office && item.domain_company?.exists && !item.domain_company?.office_phone && (
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-orange-600" />
                                      <span className="text-sm">
                                        Add office phone to <span className="font-semibold">{item.domain_company.name}</span>: <span className="font-mono font-semibold">{item.phones.office}</span>
                                      </span>
                                    </div>
                                    <div className="flex rounded-lg overflow-hidden border-2 border-orange-400">
                                      <button
                                        onClick={() => toggleAddOfficeToCompany(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          sel?.addOfficeToCompany
                                            ? "bg-orange-500 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleAddOfficeToCompany(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.addOfficeToCompany
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Relationships to Create - only show if there's a domain company OR parent companies (and not a customer) */}
                            {(item.domain_company || (item.parent_companies.length > 0 && !(selectedContact?.xero_contact_type === "CUSTOMER" || (selectedContact?.xero_invoice_count && selectedContact.xero_invoice_count > 0)))) && (
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Create Relationships
                              </div>

                              {/* Domain Company Relationship - only show for business email domains */}
                              {item.domain_company && (
                              <div className="p-3 rounded-lg border bg-card space-y-2">
                                <div className="flex items-center gap-3">
                                  <Building2 className="h-5 w-5 text-orange-600" />
                                  <div className="flex-1">
                                    <div className="font-medium">{item.domain_company.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      From email domain @{item.email.split("@")[1]}
                                    </div>
                                  </div>
                                  {selectedContact?.relationship_to_domain_company_exists ? (
                                    <Badge variant="secondary" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Already Linked
                                    </Badge>
                                  ) : (
                                    <div className="flex rounded-lg overflow-hidden border-2 border-green-400">
                                      <button
                                        onClick={() => toggleDomainCompanyLink(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          sel?.linkToDomainCompany
                                            ? "bg-green-500 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleDomainCompanyLink(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.linkToDomainCompany
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-muted-foreground"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  )}
                                  {!item.domain_company.exists && (
                                    <Badge className="gap-1 bg-orange-500">
                                      <Plus className="h-3 w-3" />
                                      Will Create
                                    </Badge>
                                  )}
                                </div>
                                {/* Company details: phone & website */}
                                {(item.domain_company.office_phone || item.domain_company.website) && (
                                  <div className="flex flex-wrap gap-2 ml-8">
                                    {item.domain_company.office_phone && (
                                      <Badge variant="outline" className="gap-1 text-xs">
                                        <Phone className="h-3 w-3" />
                                        {item.domain_company.office_phone}
                                      </Badge>
                                    )}
                                    {item.domain_company.website && (
                                      <a
                                        href={item.domain_company.website.startsWith("http") ? item.domain_company.website : `https://${item.domain_company.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex"
                                      >
                                        <Badge variant="outline" className="gap-1 text-xs hover:bg-blue-50 cursor-pointer">
                                          <Globe className="h-3 w-3" />
                                          {item.domain_company.website.replace(/^https?:\/\//, "")}
                                          <ExternalLink className="h-2.5 w-2.5" />
                                        </Badge>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              )}

                              {/* Parent Company Relationships - only show if:
                                  1. Person doesn't already have an employer (domain company)
                                  2. Selected contact is NOT a customer (customers are clients, not employees) */}
                              {(!item.domain_company || !item.domain_company.exists) &&
                               !(selectedContact?.xero_contact_type === "CUSTOMER" || (selectedContact?.xero_invoice_count && selectedContact.xero_invoice_count > 0)) &&
                               item.parent_companies.map((pc) => {
                                const existingRel = selectedContact?.relationships_to_parent_companies.find(
                                  (r) => r.company_id === pc.id
                                );

                                return (
                                  <div key={pc.id} className="p-3 rounded-lg border bg-card space-y-2">
                                    <div className="flex items-center gap-3">
                                      <Building2 className="h-5 w-5 text-blue-600" />
                                      <div className="flex-1">
                                        <div className="font-medium">{pc.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Communicated via searched email
                                        </div>
                                      </div>
                                      {existingRel?.exists ? (
                                        <Badge variant="secondary" className="gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Already Linked
                                        </Badge>
                                      ) : (
                                        <div className="flex rounded-lg overflow-hidden border-2 border-green-400">
                                          <button
                                            onClick={() => pc.id && toggleParentCompanyLink(idx, pc.id)}
                                            className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                              pc.id && sel?.parentCompanyLinks?.[pc.id]
                                                ? "bg-green-500 text-white"
                                                : "bg-white dark:bg-gray-800 text-muted-foreground"
                                            }`}
                                          >
                                            Yes
                                          </button>
                                          <button
                                            onClick={() => pc.id && toggleParentCompanyLink(idx, pc.id)}
                                            className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                              pc.id && !sel?.parentCompanyLinks?.[pc.id]
                                                ? "bg-gray-400 text-white"
                                                : "bg-white dark:bg-gray-800 text-muted-foreground"
                                            }`}
                                          >
                                            No
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {/* Company details: phone & website */}
                                    {(pc.office_phone || pc.website) && (
                                      <div className="flex flex-wrap gap-2 ml-8">
                                        {pc.office_phone && (
                                          <Badge variant="outline" className="gap-1 text-xs">
                                            <Phone className="h-3 w-3" />
                                            {pc.office_phone}
                                          </Badge>
                                        )}
                                        {pc.website && (
                                          <a
                                            href={pc.website.startsWith("http") ? pc.website : `https://${pc.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex"
                                          >
                                            <Badge variant="outline" className="gap-1 text-xs hover:bg-blue-50 cursor-pointer">
                                              <Globe className="h-3 w-3" />
                                              {pc.website.replace(/^https?:\/\//, "")}
                                              <ExternalLink className="h-2.5 w-2.5" />
                                            </Badge>
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {previewData.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No matching contacts found. Try different email addresses.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setPreviewData([]);
                  setSelections({});
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
              <Button onClick={handleExecute} disabled={executing || selectedCount === 0} size="lg">
                {executing ? (
                  <>
                    <Spinner size={20} className="mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Create {relationshipsToCreate} Relationship{relationshipsToCreate !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function ExtractEmployeesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Extract Relationships from Email</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Loading...
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

export default function ExtractEmployeesPage() {
  return (
    <Suspense fallback={<ExtractEmployeesLoading />}>
      <ExtractEmployeesContent />
    </Suspense>
  );
}
