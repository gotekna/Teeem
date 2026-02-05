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
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

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

export function EmailConfigTab() {
  const { toast } = useToast();
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
              placeholder="teeem.com.au, company.com.au"
            />
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
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Monitored Mailboxes
          </CardTitle>
          <CardDescription>
            Email addresses monitored for automated processing (bills, tasks, jobs, cases)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pay Mailbox */}
            <div className="space-y-2">
              <Label htmlFor="mailbox_pay" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-orange-500 dark:text-orange-400" />
                Bills/Invoices Inbox
              </Label>
              <Input
                id="mailbox_pay"
                value={formData.monitored_mailbox_pay}
                onChange={(e) => handleChange("monitored_mailbox_pay", e.target.value)}
                placeholder="Pay@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Incoming supplier invoices are processed from this mailbox
              </p>
            </div>

            {/* New Task Mailbox */}
            <div className="space-y-2">
              <Label htmlFor="mailbox_newtask" className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                New Task Inbox
              </Label>
              <Input
                id="mailbox_newtask"
                value={formData.monitored_mailbox_newtask}
                onChange={(e) => handleChange("monitored_mailbox_newtask", e.target.value)}
                placeholder="newtask@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Forward emails here to create tasks automatically
              </p>
            </div>

            {/* New Job Mailbox */}
            <div className="space-y-2">
              <Label htmlFor="mailbox_newjob" className="flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-green-500 dark:text-green-400" />
                New Job Inbox
              </Label>
              <Input
                id="mailbox_newjob"
                value={formData.monitored_mailbox_newjob}
                onChange={(e) => handleChange("monitored_mailbox_newjob", e.target.value)}
                placeholder="newjob@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Emails here trigger AI job extraction and proposal creation
              </p>
            </div>

            {/* New Case Mailbox */}
            <div className="space-y-2">
              <Label htmlFor="mailbox_newcase" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                New Case Inbox
              </Label>
              <Input
                id="mailbox_newcase"
                value={formData.monitored_mailbox_newcase}
                onChange={(e) => handleChange("monitored_mailbox_newcase", e.target.value)}
                placeholder="newcase@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Emails here trigger case creation proposals
              </p>
            </div>

            {/* DocSort Mailbox */}
            <div className="space-y-2">
              <Label htmlFor="mailbox_docsort" className="flex items-center gap-1">
                <Inbox className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
                DocSort Inbox
              </Label>
              <Input
                id="mailbox_docsort"
                value={formData.monitored_mailbox_docsort}
                onChange={(e) => handleChange("monitored_mailbox_docsort", e.target.value)}
                placeholder="docsort@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Documents here are AI-classified and routed automatically
              </p>
            </div>
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
