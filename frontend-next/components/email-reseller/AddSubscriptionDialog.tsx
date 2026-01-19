"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Mail,
  Users,
  Building,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { useEmailSubscriptions, useEmailPricing } from "@/hooks/useEmailSubscriptions";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import type {
  CreateSubscriptionData,
  MailboxType,
  DiscoveredMailbox,
  EmailPricing,
} from "@/lib/email-reseller-types";

interface AddSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "contact" | "domain" | "mailboxes" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "contact", label: "Select Customer" },
  { id: "domain", label: "Domain" },
  { id: "mailboxes", label: "Mailboxes" },
  { id: "review", label: "Review" },
];

interface MailboxEntry {
  email: string;
  display_name: string;
  mailbox_type: MailboxType;
  source_email?: string;
}

export function AddSubscriptionDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddSubscriptionDialogProps) {
  const { createSubscription } = useEmailSubscriptions();
  const { pricing, fetchPricing } = useEmailPricing();

  // Step state
  const [step, setStep] = React.useState<Step>("contact");
  const [loading, setLoading] = React.useState(false);

  // Form data
  const [contactId, setContactId] = React.useState<number | null>(null);
  const [contactName, setContactName] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [mailboxes, setMailboxes] = React.useState<MailboxEntry[]>([]);
  const [sendInvite, setSendInvite] = React.useState(true);

  // Contact search
  const [contactSearch, setContactSearch] = React.useState("");
  const [contactItems, setContactItems] = React.useState<(ComboboxItem & { email?: string })[]>([]);
  const [searchingContacts, setSearchingContacts] = React.useState(false);

  // O365 discovery
  const [discovering, setDiscovering] = React.useState(false);
  const [discoveredMailboxes, setDiscoveredMailboxes] = React.useState<DiscoveredMailbox[]>([]);

  // New mailbox form
  const [newEmail, setNewEmail] = React.useState("");
  const [newType, setNewType] = React.useState<MailboxType>("user");

  // Fetch pricing on open
  React.useEffect(() => {
    if (open && !pricing) {
      fetchPricing();
    }
  }, [open, pricing, fetchPricing]);

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setStep("contact");
      setContactId(null);
      setContactName("");
      setDomain("");
      setMailboxes([]);
      setSendInvite(true);
      setDiscoveredMailboxes([]);
      setContactSearch("");
    }
  }, [open]);

  // Search contacts
  const searchContacts = React.useCallback(async (query: string) => {
    if (query.length < 2) {
      setContactItems([]);
      return;
    }

    setSearchingContacts(true);
    try {
      // SSoT: Backend returns { success, contacts } with display_name field
      const response = await api.get<{ success: boolean; contacts: { id: number; display_name: string; email?: string }[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&limit=10`
      );

      const items: (ComboboxItem & { email?: string })[] = (response.contacts || []).map((contact) => ({
        id: String(contact.id),
        label: contact.display_name,
        email: contact.email,
        searchText: contact.email, // Allow searching by email too
      }));

      setContactItems(items);
    } catch (err) {
      console.error("Failed to search contacts:", err);
    } finally {
      setSearchingContacts(false);
    }
  }, []);

  // Debounced contact search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (contactSearch) {
        searchContacts(contactSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, searchContacts]);

  // Discover O365 mailboxes
  const handleDiscover = async () => {
    if (!contactId) return;

    setDiscovering(true);
    try {
      const response = await api.get<{ success: boolean; data: DiscoveredMailbox[] }>(
        `/api/v1/email_subscriptions/discover_mailboxes?contact_id=${contactId}`
      );

      if (response.success && response.data) {
        setDiscoveredMailboxes(response.data);

        // Auto-populate domain from first mailbox
        if (response.data.length > 0 && !domain) {
          const firstEmail = response.data[0].email;
          const emailDomain = firstEmail.split("@")[1];
          if (emailDomain) {
            setDomain(emailDomain);
          }
        }
      }
    } catch (err) {
      console.error("Failed to discover mailboxes:", err);
    } finally {
      setDiscovering(false);
    }
  };

  // Add discovered mailbox to selection
  const addDiscoveredMailbox = (mailbox: DiscoveredMailbox) => {
    if (mailboxes.some((m) => m.email === mailbox.email)) return;

    setMailboxes([
      ...mailboxes,
      {
        email: mailbox.email.split("@")[0], // Just the local part
        display_name: mailbox.display_name,
        mailbox_type: mailbox.mailbox_type,
        source_email: mailbox.email,
      },
    ]);
  };

  // Add manual mailbox
  const addManualMailbox = () => {
    if (!newEmail || !domain) return;

    const fullEmail = newEmail.includes("@") ? newEmail : `${newEmail}@${domain}`;
    if (mailboxes.some((m) => m.email === newEmail || m.email === fullEmail)) return;

    setMailboxes([
      ...mailboxes,
      {
        email: newEmail,
        display_name: "",
        mailbox_type: newType,
      },
    ]);

    setNewEmail("");
    setNewType("user");
  };

  // Remove mailbox
  const removeMailbox = (index: number) => {
    setMailboxes(mailboxes.filter((_, i) => i !== index));
  };

  // Calculate pricing
  const calculateTotal = () => {
    if (!pricing) return { retail: 0, wholesale: 0, margin: 0 };

    let retail = 0;
    let wholesale = 0;

    mailboxes.forEach((m) => {
      const prices = pricing[m.mailbox_type] || pricing.user;
      retail += prices.retail;
      wholesale += prices.wholesale;
    });

    return {
      retail,
      wholesale,
      margin: retail - wholesale,
    };
  };

  // Submit
  const handleSubmit = async () => {
    if (!contactId || !domain || mailboxes.length === 0) return;

    setLoading(true);
    try {
      const data: CreateSubscriptionData = {
        contact_id: contactId,
        domain,
        mailboxes: mailboxes.map((m) => ({
          email: m.email.includes("@") ? m.email : `${m.email}@${domain}`,
          display_name: m.display_name || undefined,
          mailbox_type: m.mailbox_type,
          source_email: m.source_email,
        })),
        send_invite: sendInvite,
      };

      await createSubscription(data);
      onSuccess();
    } catch (err) {
      console.error("Failed to create subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const canProceed = () => {
    switch (step) {
      case "contact":
        return !!contactId;
      case "domain":
        return !!domain && domain.includes(".");
      case "mailboxes":
        return mailboxes.length > 0;
      case "review":
        return true;
    }
  };

  const goNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].id);
    }
  };

  const totals = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Email Subscription</DialogTitle>
          <DialogDescription>
            Set up a new PolarisMail subscription for a customer
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, index) => (
            <React.Fragment key={s.id}>
              <div
                className={cn(
                  "flex items-center gap-2",
                  step === s.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                    step === s.id
                      ? "bg-primary text-primary-foreground"
                      : STEPS.findIndex((x) => x.id === step) > index
                        ? "bg-primary/20 text-primary"
                        : "bg-muted"
                  )}
                >
                  {STEPS.findIndex((x) => x.id === step) > index ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-sm hidden sm:inline">{s.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border mx-2" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {/* Step 1: Select Contact */}
          {step === "contact" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <ComboboxDropdown
                  items={contactItems}
                  selectedItem={contactItems.find((i) => i.id === String(contactId))}
                  onSelect={(item) => {
                    const id = parseInt(item.id);
                    setContactId(id);
                    setContactName(item.label);
                  }}
                  placeholder="Search for a contact..."
                  searchPlaceholder="Type at least 2 characters..."
                  onInputChange={(value) => {
                    setContactSearch(value);
                    searchContacts(value);
                  }}
                  disableInternalFilter={true}
                  isLoading={searchingContacts}
                  emptyResults={
                    contactSearch.length < 2
                      ? "Type at least 2 characters to search"
                      : "No contacts found"
                  }
                  clearable={true}
                  onClear={() => {
                    setContactId(null);
                    setContactName("");
                    setContactSearch("");
                  }}
                  renderListItem={({ item }) => (
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.email && (
                        <span className="text-xs text-muted-foreground">{item.email}</span>
                      )}
                    </div>
                  )}
                />
              </div>

              {contactId && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{contactName}</p>
                  <p className="text-sm text-muted-foreground">Contact ID: {contactId}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Domain */}
          {step === "domain" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email Domain</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">
                  The domain for the customer's email addresses (e.g., acme.com)
                </p>
              </div>

              {/* O365 Discovery */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleDiscover}
                  disabled={!contactId || discovering}
                  className="w-full"
                >
                  {discovering ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Discover Mailboxes from O365
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Automatically find existing mailboxes to migrate
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Mailboxes */}
          {step === "mailboxes" && (
            <div className="space-y-4">
              {/* Discovered mailboxes */}
              {discoveredMailboxes.length > 0 && (
                <div className="space-y-2">
                  <Label>Discovered from O365</Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {discoveredMailboxes.map((mailbox) => {
                      const isAdded = mailboxes.some((m) => m.source_email === mailbox.email);
                      return (
                        <div
                          key={mailbox.email}
                          className={cn(
                            "flex items-center justify-between p-2 border rounded",
                            isAdded && "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {mailbox.mailbox_type === "user" && <Mail className="h-4 w-4" />}
                            {mailbox.mailbox_type === "shared" && <Users className="h-4 w-4" />}
                            {mailbox.mailbox_type === "resource" && <Building className="h-4 w-4" />}
                            <div>
                              <p className="text-sm font-medium">{mailbox.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {mailbox.display_name} • {mailbox.size_display}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant={isAdded ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => addDiscoveredMailbox(mailbox)}
                            disabled={isAdded}
                          >
                            {isAdded ? "Added" : "Add"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected mailboxes */}
              {mailboxes.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Mailboxes ({mailboxes.length})</Label>
                  <div className="space-y-2">
                    {mailboxes.map((mailbox, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {mailbox.mailbox_type}
                          </Badge>
                          <span>
                            {mailbox.email}@{domain}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeMailbox(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add manual mailbox */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Add Mailbox Manually</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value.toLowerCase())}
                    placeholder="user"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">@{domain || "domain.com"}</span>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as MailboxType)}
                    className="border rounded px-2 py-2 text-sm"
                  >
                    <option value="user">User</option>
                    <option value="shared">Shared</option>
                    <option value="resource">Resource</option>
                  </select>
                  <Button variant="outline" size="icon" onClick={addManualMailbox}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{contactName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium">{domain}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Mailboxes</span>
                  <span className="font-medium">{mailboxes.length}</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Monthly Retail</span>
                  <span className="font-medium">{formatCurrency(totals.retail)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Wholesale Cost</span>
                  <span>{formatCurrency(totals.wholesale)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-medium text-green-600">
                  <span>Your Margin</span>
                  <span>{formatCurrency(totals.margin)}/mo</span>
                </div>
              </div>

              {/* Send invite option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-invite"
                  checked={sendInvite}
                  onCheckedChange={(checked) => setSendInvite(!!checked)}
                />
                <Label htmlFor="send-invite" className="cursor-pointer">
                  Send migration invite to customer
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {step !== "contact" && (
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div>
            {step !== "review" ? (
              <Button onClick={goNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Create Subscription
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
