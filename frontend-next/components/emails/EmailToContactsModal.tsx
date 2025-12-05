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
  Loader2,
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
import { cn } from "@/lib/utils";
import { extractEmailsFromRows } from "@/lib/email-utils";

interface EmailCandidate {
  email: string;
  displayName: string | null;
  isExistingContact: boolean;
  existingContactId: number | null;
  existingContactName: string | null;
  domain: string;
  isGenericDomain: boolean;
  suggestedCompany: {
    name: string;
    exists: boolean;
    existingCompanyId: number | null;
    action: "link" | "create" | "none";
  } | null;
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
}

type Step = "scope" | "analyze" | "create" | "results";

export function EmailToContactsModal({
  open,
  onOpenChange,
  emailData,
  onComplete,
}: EmailToContactsModalProps) {
  const { toast } = useToast();

  // State
  const [step, setStep] = React.useState<Step>("scope");
  const [scope, setScope] = React.useState<"current_view" | "all_history">("current_view");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [candidates, setCandidates] = React.useState<EmailCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [companyActions, setCompanyActions] = React.useState<Map<string, CompanyAction>>(new Map());
  const [creating, setCreating] = React.useState(false);
  const [results, setResults] = React.useState<{
    createdContacts: number;
    createdCompanies: number;
    linkedToCompanies: number;
    errors: Array<{ email: string; error: string }>;
  } | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("scope");
        setScope("current_view");
        setCandidates([]);
        setSelected(new Set());
        setCompanyActions(new Map());
        setResults(null);
      }, 300);
    }
  }, [open]);

  // Analyze emails
  const handleAnalyze = async () => {
    setAnalyzing(true);

    try {
      const response = await api.post("/email_to_contacts/analyze", {
        email_data: emailData,
        scope: scope,
      });

      if (response.data.success) {
        const emailCandidates: EmailCandidate[] = response.data.emails.map((e: any) => ({
          email: e.email,
          displayName: e.display_name,
          isExistingContact: e.is_existing_contact,
          existingContactId: e.existing_contact_id,
          existingContactName: e.existing_contact_name,
          domain: e.domain,
          isGenericDomain: e.is_generic_domain,
          suggestedCompany: e.suggested_company,
        }));

        setCandidates(emailCandidates);

        // Initialize company actions based on suggestions
        const initialActions = new Map<string, CompanyAction>();
        emailCandidates.forEach((candidate) => {
          if (candidate.suggestedCompany) {
            initialActions.set(candidate.email, {
              action: candidate.suggestedCompany.action,
              companyId: candidate.suggestedCompany.existingCompanyId || undefined,
              companyName: candidate.suggestedCompany.name,
            });
          } else {
            initialActions.set(candidate.email, {
              action: "none",
            });
          }
        });
        setCompanyActions(initialActions);

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
          description: `Found ${response.data.stats.total_emails} email addresses, ${response.data.stats.existing_contacts} already in contacts.`,
        });
      } else {
        toast({
          title: "Analysis failed",
          description: response.data.error || "Unknown error",
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

        return {
          email: email,
          display_name: candidate?.displayName || null,
          entity_type: "person",
          company_action: companyAction.action,
          company_id: companyAction.companyId,
          company_name: companyAction.companyName,
        };
      });

      const response = await api.post("/email_to_contacts/bulk_create", {
        selections: selections,
      });

      if (response.data.success || response.data.created_contacts.length > 0) {
        setResults({
          createdContacts: response.data.created_contacts.length,
          createdCompanies: response.data.created_companies.length,
          linkedToCompanies: response.data.linked_to_companies.length,
          errors: response.data.errors || [],
        });

        setStep("results");

        toast({
          title: "Contacts created",
          description: `Successfully created ${response.data.created_contacts.length} contact(s)`,
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
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create contacts",
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

    setCompanyActions(
      new Map(
        companyActions.set(email, {
          action: action as "link" | "create" | "none",
          companyId: action === "link" ? candidate?.suggestedCompany?.existingCompanyId || undefined : undefined,
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
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Found {candidates.length} unique email address{candidates.length !== 1 ? "es" : ""}
                    {" · "}
                    <span className="text-green-600">{candidates.filter((c) => c.isExistingContact).length} existing</span>
                    {" · "}
                    <span className="text-orange-600">{candidates.filter((c) => !c.isExistingContact).length} new</span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selected.size === candidates.filter((c) => !c.isExistingContact).length
                    ? "Deselect All"
                    : "Select All New"}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2">
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
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
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
                        {candidate.isExistingContact && candidate.existingContactName && (
                          <p className="text-sm text-muted-foreground">
                            Already exists as: {candidate.existingContactName}
                          </p>
                        )}

                        {/* Company Suggestion */}
                        {!candidate.isExistingContact && candidate.suggestedCompany && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-600" />
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
                                        Link to {candidate.suggestedCompany.name}
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
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Creating */}
        {step === "create" && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
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
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Contacts Created Successfully</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-primary">{results.createdContacts}</div>
                  <div className="text-sm text-muted-foreground">Contacts Created</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{results.createdCompanies}</div>
                  <div className="text-sm text-muted-foreground">Companies Created</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{results.linkedToCompanies}</div>
                  <div className="text-sm text-muted-foreground">Linked to Companies</div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
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
                {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyze Emails
              </Button>
            </>
          )}

          {step === "analyze" && (
            <>
              <Button variant="outline" onClick={() => setStep("scope")}>
                Back
              </Button>
              <Button onClick={handleCreateContacts} disabled={selected.size === 0}>
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
