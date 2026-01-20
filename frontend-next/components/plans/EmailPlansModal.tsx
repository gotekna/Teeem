"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send,
  FileText,
  User,
  Building2,
  HardHat,
  Users,
  X,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";

interface JobPlan {
  id: number;
  display_name: string;
  current_revision?: {
    revision_label: string;
    has_file: boolean;
    file_name: string | null;
  } | null;
}

interface SuggestedRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
  type: "client" | "supervisor" | "contractor" | "contact";
}

interface EmailPlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  jobTitle: string;
  selectedPlans: JobPlan[];
  onSent?: () => void;
}

export function EmailPlansModal({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  selectedPlans,
  onSent,
}: EmailPlansModalProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggestedRecipients, setSuggestedRecipients] = useState<SuggestedRecipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customRecipients, setCustomRecipients] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SuggestedRecipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [senderEmail, setSenderEmail] = useState<string>("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch suggested recipients when modal opens
  useEffect(() => {
    if (open) {
      fetchSuggestedRecipients();
      // Set default subject
      const planNames = selectedPlans.map(p => p.display_name).join(", ");
      setSubject(`Plans for ${jobTitle}: ${planNames}`);
      setBody(`Hi,\n\nPlease find attached the following plans for ${jobTitle}:\n\n${selectedPlans.map(p => `- ${p.display_name}${p.current_revision ? ` (Rev ${p.current_revision.revision_label})` : ""}`).join("\n")}\n\nPlease let us know if you have any questions.\n\nBest regards`);
      setSelectedRecipients([]);
      setCustomRecipients("");
      setError(null);
    }
  }, [open, jobId, jobTitle, selectedPlans]);

  const fetchSuggestedRecipients = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: SuggestedRecipient[]; sender_email?: string }>(
        `/api/v1/jobs/${jobId}/job_plans/suggested_recipients`
      );
      if (response.success) {
        setSuggestedRecipients(response.data || []);
        if (response.sender_email) {
          setSenderEmail(response.sender_email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch suggested recipients:", err);
      setSuggestedRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  const searchContacts = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await api.get<{ success: boolean; data: Array<{ id: number; display_name: string; email: string }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&per_page=10`
      );
      if (response.success && response.data) {
        // Transform contacts to SuggestedRecipient format, filtering to only those with email
        const withEmail = response.data
          .filter(c => c.email)
          .map(c => ({
            id: c.id,
            name: c.display_name,
            email: c.email,
            role: 'Contact',
            type: 'contact' as const
          }));
        setSearchResults(withEmail);
      }
    } catch (err) {
      console.error("Failed to search contacts:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchContacts(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const addFromSearch = (recipient: SuggestedRecipient) => {
    if (!selectedRecipients.includes(recipient.email)) {
      setSelectedRecipients(prev => [...prev, recipient.email]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const getRecipientIcon = (type: string) => {
    switch (type) {
      case "client":
        return <User className="h-4 w-4" />;
      case "supervisor":
        return <HardHat className="h-4 w-4" />;
      case "contractor":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const handleSend = async () => {
    setError(null);

    // Combine selected recipients with custom recipients
    const allRecipients = [...selectedRecipients];
    if (customRecipients.trim()) {
      const customEmails = customRecipients.split(/[,;\s]+/).filter(e => e.includes("@"));
      allRecipients.push(...customEmails);
    }

    if (allRecipients.length === 0) {
      setError("Please select at least one recipient");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    // Check if any plans have files
    const plansWithFiles = selectedPlans.filter(p => p.current_revision?.has_file);
    if (plansWithFiles.length === 0) {
      setError("None of the selected plans have files attached");
      return;
    }

    setSending(true);
    try {
      const response = await api.post<{ success: boolean; message: string; error?: string }>(
        `/api/v1/jobs/${jobId}/job_plans/email`,
        {
          plan_ids: selectedPlans.map(p => p.id),
          recipients: allRecipients,
          subject,
          body,
        }
      );

      if (response?.success) {
        onOpenChange(false);
        onSent?.();
      } else {
        setError(response?.error || "Failed to send email");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Plans</DialogTitle>
          <DialogDescription>
            Send {selectedPlans.length} plan{selectedPlans.length !== 1 ? "s" : ""} to recipients.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* From Email */}
            {senderEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground">From:</Label>
                <span className="font-medium">{senderEmail}</span>
              </div>
            )}

            {/* Selected Plans Summary */}
            <div className="space-y-2">
              <Label>Plans to Send</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                {selectedPlans.map(plan => (
                  <Badge key={plan.id} variant="secondary" className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {plan.display_name}
                    {plan.current_revision && (
                      <span className="text-xs opacity-70">
                        Rev {plan.current_revision.revision_label}
                      </span>
                    )}
                    {!plan.current_revision?.has_file && (
                      <span className="text-xs text-red-500 dark:text-red-400">(no file)</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Suggested Recipients */}
            {suggestedRecipients.length > 0 && (
              <div className="space-y-2">
                <Label>Suggested Recipients</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestedRecipients.map(recipient => (
                    <div
                      key={recipient.email}
                      className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleRecipient(recipient.email)}
                    >
                      <Checkbox
                        checked={selectedRecipients.includes(recipient.email)}
                        onCheckedChange={() => toggleRecipient(recipient.email)}
                      />
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {getRecipientIcon(recipient.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {recipient.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {recipient.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search for contacts */}
            <div className="space-y-2">
              <Label>Search Contacts</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                {searching && (
                  <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                  {searchResults.map(result => (
                    <div
                      key={result.email}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => addFromSearch(result)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                      </div>
                      <Button variant="ghost" size="sm">Add</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom recipients */}
            <div className="space-y-2">
              <Label>Additional Recipients</Label>
              <Input
                placeholder="Enter email addresses separated by commas..."
                value={customRecipients}
                onChange={e => setCustomRecipients(e.target.value)}
              />
            </div>

            {/* Selected recipients summary */}
            {selectedRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedRecipients.map(email => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => toggleRecipient(email)}
                      className="ml-1 hover:text-red-500 dark:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Type your message..."
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
