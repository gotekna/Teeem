"use client";

import * as React from "react";
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
  Loader2,
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
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface MatchingContact {
  id: number;
  full_name: string;
  email: string | null;
  mobile_phone: string | null;
  entity_type: string;
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
    full_name: string;
    entity_type: string;
  } | null;
  matching_contacts: MatchingContact[];
  domain_company: Company;
  parent_companies: Company[];
  phones: Phones;
}

interface SelectionState {
  selected: boolean;
  selectedContactId: number | null;
  addEmail: boolean;
  addMobile: boolean;
  linkToDomainCompany: boolean;
  parentCompanyLinks: Record<number, boolean>; // company_id -> enabled
}

export default function ExtractEmployeesPage() {
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
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(emailsFromUrl ? 2 : 1);
  const [initialLoadDone, setInitialLoadDone] = React.useState(false);

  // Auto-search on load if emails are in URL
  React.useEffect(() => {
    if (emailsFromUrl && !initialLoadDone) {
      setInitialLoadDone(true);
      handleSearchWithEmails(initialEmails.filter((e) => e.trim().length > 0));
    }
  }, [emailsFromUrl, initialLoadDone]);

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
        const firstContact = item.matching_contacts[0];
        const parentLinks: Record<number, boolean> = {};
        item.parent_companies.forEach((pc) => {
          if (pc.id) {
            const existingRel = firstContact?.relationships_to_parent_companies.find(
              (r) => r.company_id === pc.id
            );
            parentLinks[pc.id] = !existingRel?.exists;
          }
        });

        defaultSelections[idx] = {
          selected: true,
          selectedContactId: firstContact?.id || null,
          addEmail: !firstContact?.email || firstContact.email !== item.email,
          addMobile: !!item.phones?.mobile && !firstContact?.mobile_phone,
          linkToDomainCompany: !firstContact?.relationship_to_domain_company_exists,
          parentCompanyLinks: parentLinks,
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
    const validPatterns = emailPatterns.filter((p) => p.trim().length > 0);

    if (validPatterns.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one email address",
        variant: "destructive",
      });
      return;
    }

    // Update URL with email patterns so refresh works
    const newUrl = `/admin/system/extract-employees?emails=${encodeURIComponent(validPatterns.join(","))}`;
    window.history.replaceState({}, "", newUrl);

    setSearching(true);
    try {
      const result = await api.get<{ preview: PreviewItem[]; total_found: number }>(
        "/api/v1/contacts/preview_employee_extraction",
        {
          params: { email_patterns: validPatterns.join(",") },
        }
      );
      setPreviewData(result.preview || []);

      // Initialize selections - select first matching contact by default
      const defaultSelections: Record<number, SelectionState> = {};
      result.preview.forEach((item: PreviewItem, idx: number) => {
        const firstContact = item.matching_contacts[0];
        const parentLinks: Record<number, boolean> = {};
        item.parent_companies.forEach((pc) => {
          if (pc.id) {
            // Check if relationship already exists for this contact
            const existingRel = firstContact?.relationships_to_parent_companies.find(
              (r) => r.company_id === pc.id
            );
            parentLinks[pc.id] = !existingRel?.exists; // Default ON if doesn't exist
          }
        });

        defaultSelections[idx] = {
          selected: true,
          selectedContactId: firstContact?.id || null,
          addEmail: !firstContact?.email || firstContact.email !== item.email, // Add email if contact doesn't have one or has different
          addMobile: !!item.phones?.mobile && !firstContact?.mobile_phone, // Add mobile if found and contact doesn't have one
          linkToDomainCompany: !firstContact?.relationship_to_domain_company_exists,
          parentCompanyLinks: parentLinks,
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
        if (!sel?.selected || !sel.selectedContactId) return null;

        return {
          contact_id: sel.selectedContactId,
          email: item.email,
          add_email: sel.addEmail,
          mobile: item.phones?.mobile,
          add_mobile: sel.addMobile,
          link_to_domain_company: sel.linkToDomainCompany,
          domain_company_id: item.domain_company.id,
          domain_company_name: item.domain_company.name,
          parent_company_ids: Object.entries(sel.parentCompanyLinks)
            .filter(([_, enabled]) => enabled)
            .map(([id, _]) => parseInt(id)),
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
      if (result.relationships_created > 0) parts.push(`${result.relationships_created} relationships`);
      if (result.emails_added > 0) parts.push(`${result.emails_added} emails`);
      if (result.mobiles_added > 0) parts.push(`${result.mobiles_added} mobiles`);
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

    setSelections((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        selectedContactId: contactId,
        addEmail: !contact?.email || contact.email !== item.email, // Add email if contact doesn't have one or has different
        addMobile: !!item.phones?.mobile && !contact?.mobile_phone, // Add mobile if found and contact doesn't have one
        linkToDomainCompany: !contact?.relationship_to_domain_company_exists,
        parentCompanyLinks: parentLinks,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/system?tab=contact-types")}
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
                  Enter email addresses to search for people who have communicated with them.
                  The system will match email senders/recipients to existing contacts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Email Addresses to Search</label>
                  {emailPatterns.map((pattern, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={pattern}
                          onChange={(e) => handleEmailChange(idx, e.target.value)}
                          placeholder="e.g., rachel@tekna.com.au"
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
                    received emails to/from these addresses. It then matches them to existing contacts by name and lets
                    you add email addresses and create relationships.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleSearch}
                  disabled={searching || emailPatterns.every((p) => !p.trim())}
                  className="w-full"
                  size="lg"
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <div className="text-xs text-muted-foreground">Relationships to Create</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

                            {/* Match to Contact */}
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                              <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">
                                Match to Existing Contact
                              </div>

                              {item.matching_contacts.length > 1 ? (
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
                                        <div>
                                          <div className="font-semibold">{contact.full_name}</div>
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
                                        {sel?.selectedContactId === contact.id && (
                                          <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border">
                                  <User className="h-5 w-5 text-green-600" />
                                  <div>
                                    <div className="font-semibold">{selectedContact?.full_name}</div>
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
                                {/* Add Email Option - show if selected contact doesn't have an email OR has a different email */}
                                {(!selectedContact?.email || selectedContact.email !== item.email) && (
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
                                            : "bg-white dark:bg-gray-800 text-gray-400"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleAddEmail(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.addEmail
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-gray-400"
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
                                    <div className="flex rounded-lg overflow-hidden border-2 border-green-400">
                                      <button
                                        onClick={() => toggleAddMobile(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          sel?.addMobile
                                            ? "bg-green-500 text-white"
                                            : "bg-white dark:bg-gray-800 text-gray-400"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleAddMobile(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.addMobile
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-gray-400"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Relationships to Create */}
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Create Relationships
                              </div>

                              {/* Domain Company Relationship */}
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
                                            : "bg-white dark:bg-gray-800 text-gray-400"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => toggleDomainCompanyLink(idx)}
                                        className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                          !sel?.linkToDomainCompany
                                            ? "bg-gray-400 text-white"
                                            : "bg-white dark:bg-gray-800 text-gray-400"
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

                              {/* Parent Company Relationships */}
                              {item.parent_companies.map((pc) => {
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
                                                : "bg-white dark:bg-gray-800 text-gray-400"
                                            }`}
                                          >
                                            Yes
                                          </button>
                                          <button
                                            onClick={() => pc.id && toggleParentCompanyLink(idx, pc.id)}
                                            className={`px-3 py-1.5 font-bold text-sm transition-colors ${
                                              pc.id && !sel?.parentCompanyLinks?.[pc.id]
                                                ? "bg-gray-400 text-white"
                                                : "bg-white dark:bg-gray-800 text-gray-400"
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
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
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
