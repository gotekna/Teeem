"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Save,
  Globe,
  Inbox,
  FileText,
  Briefcase,
  AlertCircle,
  Info,
  Sparkles,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

interface EmailConfig {
  internal_domains: string[];
  monitored_mailboxes: {
    pay: string;
    newtask: string;
    newjob: string;
    newcase: string;
    docsort: string;
  };
}

function MailboxField({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  description,
  connectedAliases,
  keywords,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  description: string;
  connectedAliases?: string[];
  keywords: string[];
}) {
  const suggestions = React.useMemo(() => {
    if (!connectedAliases?.length) return [];
    return connectedAliases.filter((alias) => {
      const local = alias.split("@")[0]?.toLowerCase() || "";
      return keywords.some((kw) => local.includes(kw));
    });
  }, [connectedAliases, keywords]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {suggestions.length > 0 && !value && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {suggestions.map((alias) => (
            <Badge
              key={alias}
              variant="outline"
              className="cursor-pointer text-xs h-5 px-1.5 hover:bg-accent transition-colors"
              onClick={() => onChange(alias)}
            >
              {alias}
            </Badge>
          ))}
        </div>
      )}
      {connectedAliases && connectedAliases.length > 0 && suggestions.length === 0 && !value && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Connected:</span>
          {connectedAliases.slice(0, 4).map((alias) => (
            <Badge
              key={alias}
              variant="outline"
              className="cursor-pointer text-xs h-5 px-1.5 hover:bg-accent transition-colors"
              onClick={() => onChange(alias)}
            >
              {alias}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

interface EmailConfigTabProps {
  connectedDomains?: string[];
  connectedAliases?: string[];
}

// SSoT: Standard mailbox prefixes (same as Tekna's shared mailbox naming)
const MAILBOX_PREFIXES = [
  { prefix: "pay", label: "Bills/Invoices", description: "Incoming supplier invoices are routed here for automated processing" },
  { prefix: "newtask", label: "New Tasks", description: "Emails forwarded here automatically create tasks" },
  { prefix: "newjob", label: "New Jobs", description: "Emails here trigger AI job extraction and proposal creation" },
  { prefix: "newcase", label: "New Cases", description: "Emails here trigger case creation proposals" },
  { prefix: "docsort", label: "Document Sorting", description: "Documents emailed here are AI-classified and routed automatically" },
];

export function EmailConfigTab({ connectedDomains, connectedAliases }: EmailConfigTabProps = {}) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    internal_email_domains: "",
    monitored_mailbox_pay: "",
    monitored_mailbox_newtask: "",
    monitored_mailbox_newjob: "",
    monitored_mailbox_newcase: "",
    monitored_mailbox_docsort: "",
  });

  // Load email config on mount
  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: EmailConfig }>(
        "/api/v1/tenant_settings/email_config"
      );
      if (response?.success && response.data) {
        setFormData({
          internal_email_domains: response.data.internal_domains?.join(", ") || "",
          monitored_mailbox_pay: response.data.monitored_mailboxes?.pay || "",
          monitored_mailbox_newtask: response.data.monitored_mailboxes?.newtask || "",
          monitored_mailbox_newjob: response.data.monitored_mailboxes?.newjob || "",
          monitored_mailbox_newcase: response.data.monitored_mailboxes?.newcase || "",
          monitored_mailbox_docsort: response.data.monitored_mailboxes?.docsort || "",
        });
      }
    } catch (error) {
      console.error("Failed to load email config:", error);
      toast({
        title: "Error",
        description: "Failed to load email configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.patch<{ success: boolean; data: EmailConfig }>(
        "/api/v1/tenant_settings/email_config",
        { email_config: formData }
      );
      if (response?.success) {
        toast({
          title: "Saved",
          description: "Email configuration updated successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save email configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Single Source of Truth for internal domains and monitored mailboxes
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Mail className="h-3 w-3" />
          SSoT
        </Badge>
      </div>

      {/* Internal Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Internal Email Domains
          </CardTitle>
          <CardDescription>
            Domains used to identify internal emails vs external (customer/vendor) emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="internal_domains">Internal Domains (comma-separated)</Label>
            <Input
              id="internal_domains"
              value={formData.internal_email_domains}
              onChange={(e) => handleChange("internal_email_domains", e.target.value)}
              placeholder="yourcompany.com.au, otherdomain.com"
            />
            {connectedDomains && connectedDomains.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    const existing = formData.internal_email_domains
                      .split(",")
                      .map((d) => d.trim().toLowerCase())
                      .filter(Boolean);
                    const newDomains = connectedDomains.filter(
                      (d) => !existing.includes(d.toLowerCase())
                    );
                    if (newDomains.length === 0) {
                      toast({ title: "All connected domains already added" });
                      return;
                    }
                    const merged = [...existing, ...newDomains].join(", ");
                    handleChange("internal_email_domains", merged);
                    toast({
                      title: "Domains added",
                      description: `Added: ${newDomains.join(", ")}`,
                    });
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Auto-fill from connected accounts
                </Button>
                <span className="text-xs text-muted-foreground">
                  {connectedDomains.join(", ")}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Emails from these domains are considered "internal" when processing job/task creation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monitored Mailboxes */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Monitored Mailboxes
              </CardTitle>
              <CardDescription className="mt-1.5">
                Email addresses monitored for automated processing (bills, tasks, jobs, cases)
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    // Use internal domains if set, otherwise prompt
                    const internalDomains = formData.internal_email_domains
                      .split(",").map((d) => d.trim()).filter(Boolean);
                    const domain = window.prompt(
                      "Enter your company email domain (e.g. bypilgrim.co):",
                      internalDomains[0] || connectedDomains?.[0] || ""
                    );
                    if (!domain) return;
                    const updates: Record<string, string> = {};
                    for (const m of MAILBOX_PREFIXES) {
                      const key = `monitored_mailbox_${m.prefix}` as keyof typeof formData;
                      if (!formData[key]) {
                        updates[key] = `${m.prefix}@${domain}`;
                      }
                    }
                    if (Object.keys(updates).length === 0) {
                      toast({ title: "All mailbox fields already filled" });
                      return;
                    }
                    setFormData((prev) => ({ ...prev, ...updates }));
                    toast({
                      title: "Mailboxes auto-filled",
                      description: `Set ${Object.keys(updates).length} mailbox addresses using ${domain}`,
                    });
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-fill All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const internalDomains = formData.internal_email_domains
                      .split(",").map((d) => d.trim()).filter(Boolean);
                    const domain = window.prompt(
                      "Enter your company email domain (e.g. bypilgrim.co):",
                      internalDomains[0] || connectedDomains?.[0] || ""
                    );
                    if (!domain) return;
                    const mailboxList = MAILBOX_PREFIXES.map(
                      (m) => `  - ${m.prefix}@${domain}  (${m.label} - ${m.description})`
                    ).join("\n");

                    const subject = encodeURIComponent(
                      `Request: Create Shared Mailboxes in Microsoft 365`
                    );
                    const body = encodeURIComponent(
                      `Hi,\n\n` +
                      `We need the following shared mailboxes created in our Microsoft 365 Admin Centre for the ${domain} domain:\n\n` +
                      `${mailboxList}\n\n` +
                      `These are shared mailboxes (no license required) and will be used by Teeem for automated email processing.\n\n` +
                      `Please create them in Microsoft 365 Admin Centre > Teams & groups > Shared mailboxes.\n\n` +
                      `Let us know once they're set up.\n\n` +
                      `Thanks`
                    );
                    router.push(`/email?compose_to=&compose_subject=${subject}&compose_body=${body}`);
                  }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Email IT to Create
                </Button>
              </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pay Mailbox */}
            <MailboxField
              id="mailbox_pay"
              label="Bills/Invoices Inbox"
              icon={<AlertCircle className="h-3 w-3 text-orange-500 dark:text-orange-400" />}
              value={formData.monitored_mailbox_pay}
              onChange={(v) => handleChange("monitored_mailbox_pay", v)}
              placeholder="Pay@example.com"
              description="Incoming supplier invoices are processed from this mailbox"
              connectedAliases={connectedAliases}
              keywords={["pay", "bill", "invoice", "accounts"]}
            />

            {/* New Task Mailbox */}
            <MailboxField
              id="mailbox_newtask"
              label="New Task Inbox"
              icon={<FileText className="h-3 w-3 text-blue-500 dark:text-blue-400" />}
              value={formData.monitored_mailbox_newtask}
              onChange={(v) => handleChange("monitored_mailbox_newtask", v)}
              placeholder="newtask@example.com"
              description="Forward emails here to create tasks automatically"
              connectedAliases={connectedAliases}
              keywords={["task", "newtask", "todo"]}
            />

            {/* New Job Mailbox */}
            <MailboxField
              id="mailbox_newjob"
              label="New Job Inbox"
              icon={<Briefcase className="h-3 w-3 text-green-500 dark:text-green-400" />}
              value={formData.monitored_mailbox_newjob}
              onChange={(v) => handleChange("monitored_mailbox_newjob", v)}
              placeholder="newjob@example.com"
              description="Emails here trigger AI job extraction and proposal creation"
              connectedAliases={connectedAliases}
              keywords={["job", "newjob", "project"]}
            />

            {/* New Case Mailbox */}
            <MailboxField
              id="mailbox_newcase"
              label="New Case Inbox"
              icon={<AlertCircle className="h-3 w-3 text-purple-500 dark:text-purple-400" />}
              value={formData.monitored_mailbox_newcase}
              onChange={(v) => handleChange("monitored_mailbox_newcase", v)}
              placeholder="newcase@example.com"
              description="Emails here trigger case creation proposals"
              connectedAliases={connectedAliases}
              keywords={["case", "newcase", "support", "help"]}
            />

            {/* DocSort Mailbox */}
            <MailboxField
              id="mailbox_docsort"
              label="DocSort Inbox"
              icon={<Inbox className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />}
              value={formData.monitored_mailbox_docsort}
              onChange={(v) => handleChange("monitored_mailbox_docsort", v)}
              placeholder="docsort@example.com"
              description="Documents here are AI-classified and routed automatically"
              connectedAliases={connectedAliases}
              keywords={["docsort", "doc", "document", "sort"]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Spinner size={16} className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
