"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  UserPlus,
  Link as LinkIcon,
  Plus,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { extractEmailsFromRows } from "@/lib/email-utils";

interface EmailCandidate {
  email: string;
  displayName: string | null;
  isExistingContact: boolean;
  existingContactId: number | null;
  existingContactName: string | null;
  existingContactCompanyName: string | null;
  existingContactCompanyId: number | null;
  domain: string;
  isGenericDomain: boolean;
  suggestedCompany: {
    name: string;
    exists: boolean;
    existingCompanyId: number | null;
    multipleMatches?: boolean;
    matches?: Array<{ id: number; name: string }>;
    action: "link" | "create" | "none";
    source?: "domain" | "signature";
    websiteDetails?: {
      website?: string;
      display_name?: string;
      abn?: string;
      acn?: string;
      phone?: string;
      email?: string;
      address?: string;
      description?: string;
    };
  } | null;
  possibleDuplicate: {
    id: number;
    name: string;
    email: string;
    matchConfidence: number;
  } | null;
  phones?: {
    mobile?: string;
    office?: string;
    direct?: string;
  };
}

interface CompanyAction {
  action: "link" | "create" | "none";
  companyId?: number;
  companyName?: string;
}

interface EmailToContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailData: Array<Record<string, any>>;
  onComplete: () => void;
  caseId?: number; // Optional case ID to link contacts to
  caseNumber?: string; // Optional case number for display
}

type Step = "scope" | "analyze" | "create" | "results";

export function EmailToContactsModal({
  open,
  onOpenChange,
  emailData,
  onComplete,
  caseId,
  caseNumber,
}: EmailToContactsModalProps) {
  const { toast } = useToast();

  // State
  const [step, setStep] = React.useState<Step>("scope");
  const [scope, setScope] = React.useState<"current_view" | "all_history">("current_view");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [candidates, setCandidates] = React.useState<EmailCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [companyActions, setCompanyActions] = React.useState<Map<string, CompanyAction>>(new Map());
  const [duplicateActions, setDuplicateActions] = React.useState<Map<string, { addToExisting: boolean; setAsPrimary: boolean }>>(new Map());
  const [creating, setCreating] = React.useState(false);
  const [results, setResults] = React.useState<{
    createdContacts: number;
    createdCompanies: number;
    linkedToCompanies: number;
    addedEmails: number;
    errors: Array<{ email: string; error: string }>;
  } | null>(null);

  // Case linking state (when caseId is provided)
  const [defaultRelationshipType, setDefaultRelationshipType] = React.useState<string>("client");
  const [defaultReason, setDefaultReason] = React.useState<string>("");

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("scope");
        setScope("current_view");
        setCandidates([]);
        setSelected(new Set());
        setCompanyActions(new Map());
        setDuplicateActions(new Map());
        setResults(null);
      }, 300);
    }
  }, [open]);

  // Analyze emails
  const handleAnalyze = async () => {
    setAnalyzing(true);

    try {
      const response: any = await api.post("/api/v1/email_to_contacts/analyze", {
        email_data: emailData,
        scope: scope,
      });

      if (response.success) {
        const emailCandidates: EmailCandidate[] = response.emails.map((e: any) => ({
          email: e.email,
          displayName: e.display_name,
          isExistingContact: e.is_existing_contact,
          existingContactId: e.existing_contact_id,
          existingContactName: e.existing_contact_name,
          existingContactCompanyName: e.existing_contact_company_name,
          existingContactCompanyId: e.existing_contact_company_id,
          domain: e.domain,
          isGenericDomain: e.is_generic_domain,
          suggestedCompany: e.suggested_company,
          possibleDuplicate: e.possible_duplicate ? {
            id: e.possible_duplicate.id,
            name: e.possible_duplicate.name,
            email: e.possible_duplicate.email,
            matchConfidence: e.possible_duplicate.match_confidence,
          } : null,
        }));

        setCandidates(emailCandidates);

        // Initialize company actions based on suggestions
        const initialActions = new Map<string, CompanyAction>();
        emailCandidates.forEach((candidate) => {
          if (candidate.suggestedCompany) {
            // If multiple matches, default to first one but user can change
            if (candidate.suggestedCompany.multipleMatches && candidate.suggestedCompany.matches?.length) {
              initialActions.set(candidate.email, {
                action: candidate.suggestedCompany.action,
                companyId: candidate.suggestedCompany.matches[0].id,
                companyName: candidate.suggestedCompany.matches[0].name,
              });
            } else {
              initialActions.set(candidate.email, {
                action: candidate.suggestedCompany.action,
                companyId: candidate.suggestedCompany.existingCompanyId || undefined,
                companyName: candidate.suggestedCompany.name,
              });
            }
          } else {
            initialActions.set(candidate.email, {
              action: "none",
            });
          }
        });
        setCompanyActions(initialActions);

        // Initialize duplicate actions - default to adding to existing if duplicate found
        const initialDuplicateActions = new Map<string, { addToExisting: boolean; setAsPrimary: boolean }>();
        emailCandidates.forEach((candidate) => {
          if (candidate.possibleDuplicate) {
            initialDuplicateActions.set(candidate.email, {
              addToExisting: true,  // Default to adding to existing
              setAsPrimary: false,  // Default to not primary
            });
          }
        });
        setDuplicateActions(initialDuplicateActions);

        // Auto-select new candidates
        const newCandidates = new Set(
          emailCandidates
            .filter((c) => !c.isExistingContact)
            .map((c) => c.email)
        );
        setSelected(newCandidates);

        setStep("analyze");

        toast({
          title: "Analysis complete",
          description: `Found ${response.stats.total_emails} email addresses, ${response.stats.existing_contacts} already in contacts.`,
        });
      } else {
        toast({
          title: "Analysis failed",
          description: response.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error analyzing emails:", error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to analyze emails",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Bulk create contacts
  const handleCreateContacts = async () => {
    if (selected.size === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select at least one contact to create",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    setStep("create");

    try {
      const selections = Array.from(selected).map((email) => {
        const candidate = candidates.find((c) => c.email === email);
        const companyAction = companyActions.get(email) || { action: "none" };
        const duplicateAction = duplicateActions.get(email);

        // Check if we should add to existing contact instead of creating new
        if (candidate?.possibleDuplicate && duplicateAction?.addToExisting) {
          return {
            email: email,
            add_to_existing_contact_id: candidate.possibleDuplicate.id,
            set_as_primary: duplicateAction.setAsPrimary || false,
            phones: candidate?.phones || {}, // Include phone numbers when adding to existing contact
            // Add company fields:
            company_action: companyAction.action,
            company_id: companyAction.companyId || null,
            company_name: companyAction.companyName || null,
          };
        }

        return {
          email: email,
          display_name: candidate?.displayName || null,
          entity_type: "person",
          company_action: companyAction.action,
          company_id: companyAction.companyId,
          company_name: companyAction.companyName,
          website_details: candidate?.suggestedCompany?.websiteDetails || {},
          phones: candidate?.phones || {},
        };
      });

      const response = await api.post<{
        success?: boolean;
        created_contacts?: any[];
        created_companies?: any[];
        linked_to_companies?: any[];
        added_emails?: any[];
        errors?: any[];
      }>("/api/v1/email_to_contacts/bulk_create", {
        selections: selections,
        case_id: caseId,
        default_relationship_type: caseId ? defaultRelationshipType : undefined,
        default_reason: caseId ? defaultReason : undefined,
      });

      if (response?.success || (response?.created_contacts?.length ?? 0) > 0 || (response?.added_emails?.length ?? 0) > 0) {
        setResults({
          createdContacts: response?.created_contacts?.length || 0,
          createdCompanies: response?.created_companies?.length || 0,
          linkedToCompanies: response?.linked_to_companies?.length || 0,
          addedEmails: response?.added_emails?.length || 0,
          errors: response?.errors || [],
        });

        setStep("results");

        toast({
          title: "Contacts created",
          description: `Successfully created ${response?.created_contacts?.length || 0} contact(s)`,
        });
      } else {
        toast({
          title: "Creation failed",
          description: "Failed to create contacts",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error creating contacts:", error);
      console.error("Error details:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      // Handle errors array from backend
      const errors = error.response?.data?.errors || [];
      const errorMessage = error.response?.data?.error;

      let description = errorMessage || "Failed to create contacts";

      if (errors.length > 0) {
        // Format errors array into readable message
        const errorMessages = errors.map((err: any) => {
          if (typeof err === 'string') return err;
          if (err.email && err.error) return `${err.email}: ${err.error}`;
          if (err.error) return err.error;
          return JSON.stringify(err);
        });
        description = errorMessages.join('\n');
      }

      toast({
        title: "Error Creating Contacts",
        description: description,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Handle company action change
  const handleCompanyActionChange = (email: string, action: string) => {
    const candidate = candidates.find((c) => c.email === email);
    const currentAction = companyActions.get(email);

    // For "link" action with multiple matches, preserve existing companyId
    let companyId;
    if (action === "link") {
      if (candidate?.suggestedCompany?.multipleMatches && candidate?.suggestedCompany?.matches?.length) {
        // Keep current selection or default to first match
        companyId = currentAction?.companyId || candidate.suggestedCompany.matches[0].id;
      } else {
        // Single match - use existingCompanyId
        companyId = candidate?.suggestedCompany?.existingCompanyId || undefined;
      }
    }

    setCompanyActions(
      new Map(
        companyActions.set(email, {
          action: action as "link" | "create" | "none",
          companyId: companyId,
          companyName: action === "create" ? candidate?.suggestedCompany?.name : undefined,
        })
      )
    );
  };

  // Toggle selection
  const toggleSelection = (email: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelected(newSelected);
  };

  // Toggle all
  const toggleAll = () => {
    if (selected.size === candidates.filter((c) => !c.isExistingContact).length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.filter((c) => !c.isExistingContact).map((c) => c.email)));
    }
  };

  // Handle finish
  const handleFinish = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Extract Contacts from Emails
            </div>
          </DialogTitle>
          <DialogDescription>
            {step === "scope" && "Choose which emails to analyze"}
            {step === "analyze" && "Select contacts to create"}
            {step === "create" && "Creating contacts..."}
            {step === "results" && "Results"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Scope Selection */}
        {step === "scope" && (
          <div className="flex-1 py-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Email Scope</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose which emails to extract contacts from
                </p>
              </div>

              <RadioGroup value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="current_view" id="current" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="current" className="font-medium cursor-pointer">
                      Current View
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Extract from the {emailData.length} email{emailData.length !== 1 ? "s" : ""} currently displayed in the table
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="all_history" id="all" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="all" className="font-medium cursor-pointer">
                      All History
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Extract from all emails in conversation history (may take longer)
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {/* Step 2: Analysis Results */}
        {step === "analyze" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Found {candidates.length} unique email address{candidates.length !== 1 ? "es" : ""}
                    {" · "}
                    <span className="text-green-600 dark:text-green-400">{candidates.filter((c) => c.isExistingContact).length} existing</span>
                    {" · "}
                    <span className="text-orange-600 dark:text-orange-400">{candidates.filter((c) => !c.isExistingContact).length} new</span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selected.size === candidates.filter((c) => !c.isExistingContact).length
                    ? "Deselect All"
                    : "Select All New"}
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto -mx-6 px-6">
              <div className="space-y-2 pb-2">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.email}
                    className={cn(
                      "border rounded-lg p-3 transition-colors",
                      candidate.isExistingContact ? "bg-muted/30" : "",
                      selected.has(candidate.email) && !candidate.isExistingContact ? "border-primary" : ""
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        {candidate.isExistingContact ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Checkbox
                            checked={selected.has(candidate.email)}
                            onCheckedChange={() => toggleSelection(candidate.email)}
                          />
                        )}
                      </div>

                      {/* Email Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {candidate.displayName || candidate.email}
                          </span>
                          {candidate.isExistingContact && (
                            <Badge variant="secondary" className="text-xs">
                              Existing
                            </Badge>
                          )}
                        </div>
                        {candidate.displayName && (
                          <p className="text-sm text-muted-foreground truncate">{candidate.email}</p>
                        )}

                        {/* Extracted Phone Numbers */}
                        {!candidate.isExistingContact && candidate.phones && Object.keys(candidate.phones).length > 0 && (
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            {candidate.phones.mobile && (
                              <p className="flex items-center gap-1">
                                <span className="text-blue-600 dark:text-blue-400">📱</span>
                                Mobile: {candidate.phones.mobile}
                              </p>
                            )}
                            {candidate.phones.office && (
                              <p className="flex items-center gap-1">
                                <span className="text-green-600 dark:text-green-400">☎️</span>
                                Office: {candidate.phones.office}
                              </p>
                            )}
                            {candidate.phones.direct && (
                              <p className="flex items-center gap-1">
                                <span className="text-purple-600 dark:text-purple-400">📞</span>
                                Direct: {candidate.phones.direct}
                              </p>
                            )}
                          </div>
                        )}

                        {candidate.isExistingContact && candidate.existingContactName && (
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <p>Already exists as: {candidate.existingContactName}</p>
                            {candidate.existingContactCompanyName && (
                              <p className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {candidate.existingContactCompanyName}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Company Suggestion */}
                        {!candidate.isExistingContact && candidate.suggestedCompany && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              {candidate.suggestedCompany.source === 'signature' && (
                                <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200">
                                  From Signature
                                </Badge>
                              )}
                              {candidate.suggestedCompany.websiteDetails && Object.keys(candidate.suggestedCompany.websiteDetails).length > 1 && (
                                <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200">
                                  Details from Website
                                </Badge>
                              )}
                              <Select
                                value={companyActions.get(candidate.email)?.action || "none"}
                                onValueChange={(value) => handleCompanyActionChange(candidate.email, value)}
                                disabled={!selected.has(candidate.email)}
                              >
                                <SelectTrigger className="h-8 text-xs w-full max-w-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {candidate.suggestedCompany.exists && (
                                    <SelectItem value="link">
                                      <div className="flex items-center gap-2">
                                        <LinkIcon className="h-3 w-3" />
                                        {candidate.suggestedCompany.multipleMatches
                                          ? "Link to Company"
                                          : `Link to ${candidate.suggestedCompany.name}`
                                        }
                                      </div>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="create">
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-3 w-3" />
                                      Create {candidate.suggestedCompany.name}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="none">
                                    <div className="flex items-center gap-2">
                                      <X className="h-3 w-3" />
                                      No Company
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Multiple Company Matches - Show Dropdown to Select Specific One */}
                            {companyActions.get(candidate.email)?.action === "link" &&
                             candidate.suggestedCompany.multipleMatches &&
                             candidate.suggestedCompany.matches && (
                              <div className="ml-6">
                                <Select
                                  value={companyActions.get(candidate.email)?.companyId?.toString()}
                                  onValueChange={(value) => {
                                    const selectedMatch = candidate.suggestedCompany!.matches!.find(m => m.id.toString() === value);
                                    if (selectedMatch) {
                                      setCompanyActions(new Map(companyActions.set(candidate.email, {
                                        action: "link",
                                        companyId: selectedMatch.id,
                                        companyName: selectedMatch.name,
                                      })));
                                    }
                                  }}
                                  disabled={!selected.has(candidate.email)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select company..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {candidate.suggestedCompany.matches.map((match) => (
                                      <SelectItem key={match.id} value={match.id.toString()}>
                                        {match.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {candidate.suggestedCompany.matches.length} matching companies found
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Website Details Info */}
                        {!candidate.isExistingContact &&
                         companyActions.get(candidate.email)?.action === "create" &&
                         candidate.suggestedCompany?.websiteDetails &&
                         Object.keys(candidate.suggestedCompany.websiteDetails).length > 1 && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                            <p className="font-medium text-green-900 mb-1">Company details from website:</p>
                            <div className="text-green-700 space-y-0.5">
                              {candidate.suggestedCompany.websiteDetails.display_name && (
                                <p>• Name: {candidate.suggestedCompany.websiteDetails.display_name}</p>
                              )}
                              {candidate.suggestedCompany.websiteDetails.abn && (
                                <p>• ABN: {candidate.suggestedCompany.websiteDetails.abn}</p>
                              )}
                              {candidate.suggestedCompany.websiteDetails.acn && (
                                <p>• ACN: {candidate.suggestedCompany.websiteDetails.acn}</p>
                              )}
                              {candidate.suggestedCompany.websiteDetails.phone && (
                                <p>• Phone: {candidate.suggestedCompany.websiteDetails.phone}</p>
                              )}
                              {candidate.suggestedCompany.websiteDetails.address && (
                                <p>• Address: {candidate.suggestedCompany.websiteDetails.address}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Possible Duplicate Warning */}
                        {!candidate.isExistingContact && candidate.possibleDuplicate && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-900">Possible match found</p>
                                <p className="text-amber-700">
                                  {candidate.possibleDuplicate.name} ({candidate.possibleDuplicate.email})
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`add-to-existing-${candidate.email}`}
                                checked={duplicateActions.get(candidate.email)?.addToExisting ?? true}
                                onCheckedChange={(checked) => {
                                  const current = duplicateActions.get(candidate.email) || { addToExisting: true, setAsPrimary: false };
                                  setDuplicateActions(new Map(duplicateActions.set(candidate.email, {
                                    ...current,
                                    addToExisting: !!checked,
                                  })));
                                }}
                                disabled={!selected.has(candidate.email)}
                              />
                              <label htmlFor={`add-to-existing-${candidate.email}`} className="text-xs font-medium cursor-pointer">
                                Add email to existing contact
                              </label>
                            </div>
                            {duplicateActions.get(candidate.email)?.addToExisting && (
                              <div className="flex items-center gap-2 ml-6">
                                <Checkbox
                                  id={`set-primary-${candidate.email}`}
                                  checked={duplicateActions.get(candidate.email)?.setAsPrimary ?? false}
                                  onCheckedChange={(checked) => {
                                    const current = duplicateActions.get(candidate.email) || { addToExisting: true, setAsPrimary: false };
                                    setDuplicateActions(new Map(duplicateActions.set(candidate.email, {
                                      ...current,
                                      setAsPrimary: !!checked,
                                    })));
                                  }}
                                  disabled={!selected.has(candidate.email)}
                                />
                                <label htmlFor={`set-primary-${candidate.email}`} className="text-xs cursor-pointer">
                                  Set as primary email
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        {!candidate.isExistingContact && candidate.isGenericDomain && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Generic email domain - no company suggestion
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Case Linking Section - Only show when caseId is provided */}
            {caseId && (
              <div className="mt-6 pt-6 border-t">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900">
                      These contacts will be linked to Case #{caseNumber || caseId}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="relationship-type" className="text-sm font-medium">
                        Relationship Type <span className="text-red-500 dark:text-red-400">*</span>
                      </Label>
                      <Select value={defaultRelationshipType} onValueChange={setDefaultRelationshipType}>
                        <SelectTrigger id="relationship-type" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>
                          <SelectItem value="lawyer">Lawyer</SelectItem>
                          <SelectItem value="previous_accountant">Previous Accountant</SelectItem>
                          <SelectItem value="advisor">Advisor</SelectItem>
                          <SelectItem value="opposing_party">Opposing Party</SelectItem>
                          <SelectItem value="witness">Witness</SelectItem>
                          <SelectItem value="related_party">Related Party</SelectItem>
                          <SelectItem value="ato_officer">ATO Officer</SelectItem>
                          <SelectItem value="afsa_officer">AFSA Officer</SelectItem>
                          <SelectItem value="inspector_general">Inspector General</SelectItem>
                          <SelectItem value="trustee">Trustee</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="shareholder">Shareholder</SelectItem>
                          <SelectItem value="bank_manager">Bank Manager</SelectItem>
                          <SelectItem value="insurer">Insurer</SelectItem>
                          <SelectItem value="broker">Broker</SelectItem>
                          <SelectItem value="creditor">Creditor</SelectItem>
                          <SelectItem value="debtor">Debtor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="reason" className="text-sm font-medium">
                        Reason <span className="text-red-500 dark:text-red-400">*</span>
                      </Label>
                      <textarea
                        id="reason"
                        value={defaultReason}
                        onChange={(e) => setDefaultReason(e.target.value)}
                        placeholder="Why are these contacts relevant to this case?"
                        className="mt-1.5 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Explain why these contacts are being added to this case
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Creating */}
        {step === "create" && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Spinner size={48} className="mx-auto text-primary" />
              <div>
                <p className="font-medium">Creating contacts...</p>
                <p className="text-sm text-muted-foreground">Please wait</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && results && (
          <div className="flex-1 py-4">
            <div className="space-y-4">
              <div className="text-center pb-4">
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Contacts Created Successfully</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-primary">{results.createdContacts}</div>
                  <div className="text-sm text-muted-foreground">Contacts Created</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{results.addedEmails}</div>
                  <div className="text-sm text-muted-foreground">Emails Added</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{results.createdCompanies}</div>
                  <div className="text-sm text-muted-foreground">Companies Created</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{results.linkedToCompanies}</div>
                  <div className="text-sm text-muted-foreground">Linked to Companies</div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    Errors ({results.errors.length})
                  </h4>
                  <ScrollArea className="h-32 border rounded-lg p-3">
                    <div className="space-y-2">
                      {results.errors.map((error, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{error.email}:</span>{" "}
                          <span className="text-muted-foreground">{error.error}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "scope" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing && <Spinner size={16} className="mr-2" />}
                Analyze Emails
              </Button>
            </>
          )}

          {step === "analyze" && (
            <>
              <Button variant="outline" onClick={() => setStep("scope")}>
                Back
              </Button>
              <Button
                onClick={handleCreateContacts}
                disabled={selected.size === 0 || Boolean(caseId && !defaultReason.trim())}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create {selected.size} Contact{selected.size !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "results" && (
            <Button onClick={handleFinish}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
