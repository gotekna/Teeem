"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Pencil,
  Building2,
  Users,
  Save,
  Share2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImapCredential {
  id: number;
  name: string;
  email_address: string;
  username: string;
  provider: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  sync_interval_minutes: number;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  email_signature: string | null;
  shared_with_user_ids: number[];
  shared_with_users: { id: number; name: string }[];
  user_id: number;
}

interface Provider {
  id: string;
  name: string;
  settings: {
    imap_host: string;
    imap_port: number;
    imap_ssl: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_auth: string;
  } | null;
}

const DEFAULT_FORM = {
  name: "",
  email_address: "",
  provider: "",
  imap_host: "",
  imap_port: 993,
  smtp_host: "",
  smtp_port: 587,
  username: "",
  password: "",
  email_signature: "",
};

// MS365 Organization with mailboxes for access configuration
interface MS365Organization {
  id: number;
  name: string;
  status: string;
  mailboxes: string[];
  user_mailbox_access: Record<string, string[]>; // user_id -> mailbox emails
}

interface TeeemUser {
  id: number;
  name: string;
  email: string;
}

interface ShareableUser {
  id: number;
  name: string;
  email: string;
}

// Component for configuring MS365 mailbox access
function MS365MailboxAccessConfig() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<MS365Organization[]>([]);
  const [teeemUsers, setTeeemUsers] = useState<TeeemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [localAccess, setLocalAccess] = useState<Record<number, Record<string, string[]>>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        organizations: MS365Organization[];
        teeem_users: TeeemUser[];
      }>("/api/v1/microsoft_app/organizations_with_mailboxes");

      if (response.success) {
        setOrganizations(response.organizations);
        setTeeemUsers(response.teeem_users);

        // Initialize local access state from server data
        const initialAccess: Record<number, Record<string, string[]>> = {};
        response.organizations.forEach(org => {
          initialAccess[org.id] = org.user_mailbox_access || {};
        });
        setLocalAccess(initialAccess);
      }
    } catch (error) {
      console.error("Failed to fetch MS365 organizations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleMailboxAccess = (orgId: number, userId: string, mailbox: string) => {
    setLocalAccess(prev => {
      const orgAccess = { ...(prev[orgId] || {}) };
      const userMailboxes = [...(orgAccess[userId] || [])];

      const idx = userMailboxes.indexOf(mailbox);
      if (idx === -1) {
        userMailboxes.push(mailbox);
      } else {
        userMailboxes.splice(idx, 1);
      }

      orgAccess[userId] = userMailboxes;
      return { ...prev, [orgId]: orgAccess };
    });
  };

  const saveOrgAccess = async (orgId: number) => {
    setSaving(orgId);
    try {
      await api.put(`/api/v1/microsoft_app/${orgId}/user_mailbox_access`, {
        user_mailbox_access: localAccess[orgId] || {}
      });
      toast({
        title: "Saved",
        description: "Mailbox access configuration saved successfully",
      });
    } catch (error) {
      console.error("Failed to save mailbox access:", error);
      toast({
        title: "Error",
        description: "Failed to save mailbox access configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const hasUserAccess = (orgId: number, userId: string, mailbox: string): boolean => {
    return localAccess[orgId]?.[userId]?.includes(mailbox) || false;
  };

  // SSoT: Check if user has auto-access to mailbox (their own email)
  const isAutoAccess = (userEmail: string, mailbox: string): boolean => {
    return userEmail?.toLowerCase() === mailbox?.toLowerCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No Microsoft 365 organizations connected.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect an organization in Admin → System → Connections
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {organizations.map(org => (
        <Card key={org.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>
                    {org.mailboxes.length} mailboxes available
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={org.status === "connected" ? "default" : "secondary"}>
                  {org.status === "connected" ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </>
                  ) : (
                    org.status
                  )}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => saveOrgAccess(org.id)}
                  disabled={saving === org.id}
                >
                  {saving === org.id ? (
                    <Spinner className="h-4 w-4 mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {org.mailboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No mailboxes found. Try reconnecting or check permissions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          User
                        </div>
                      </TableHead>
                      {org.mailboxes.map(mailbox => (
                        <TableHead key={mailbox} className="text-center px-2 py-2 font-medium">
                          <div className="text-xs truncate max-w-[120px]" title={mailbox}>
                            {mailbox.split("@")[0]}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            @{mailbox.split("@")[1]}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teeemUsers.map(user => (
                      <TableRow key={user.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <TableCell className="py-2 pr-4">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        {org.mailboxes.map(mailbox => {
                          const autoAccess = isAutoAccess(user.email, mailbox);
                          const hasAccess = hasUserAccess(org.id, user.id.toString(), mailbox) || autoAccess;
                          return (
                            <TableCell key={mailbox} className="text-center px-2 py-2">
                              <Checkbox
                                checked={hasAccess}
                                disabled={autoAccess}
                                onCheckedChange={() =>
                                  toggleMailboxAccess(org.id, user.id.toString(), mailbox)
                                }
                                title={autoAccess ? "Auto-access: user's own mailbox" : undefined}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Component for configuring team email domains (for Split Inbox)
function TeamEmailDomainsConfig() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: { team_email_domains: string[] };
      }>("/api/v1/company_settings");
      if (response.success) {
        setDomains(response.data.team_email_domains || []);
      }
    } catch (error) {
      console.error("Failed to fetch team domains:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const saveDomains = async (updatedDomains: string[]) => {
    setSaving(true);
    try {
      await api.put("/api/v1/company_settings", {
        company_setting: {
          team_email_domains: updatedDomains
        }
      });
      setDomains(updatedDomains);
      toast({
        title: "Saved",
        description: "Team email domains updated successfully",
      });
    } catch (error) {
      console.error("Failed to save team domains:", error);
      toast({
        title: "Error",
        description: "Failed to save team email domains",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addDomain = () => {
    const domain = newDomain.toLowerCase().trim();
    if (!domain) return;

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.][a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      toast({
        title: "Invalid domain",
        description: "Please enter a valid domain (e.g., company.com)",
        variant: "destructive",
      });
      return;
    }

    if (domains.includes(domain)) {
      toast({
        title: "Duplicate",
        description: "This domain is already in the list",
        variant: "destructive",
      });
      return;
    }

    const updated = [...domains, domain];
    saveDomains(updated);
    setNewDomain("");
  };

  const removeDomain = (domain: string) => {
    const updated = domains.filter(d => d !== domain);
    saveDomains(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Domains
        </CardTitle>
        <CardDescription>
          Emails from these domains will appear in the &quot;Team&quot; category of Split Inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Domain Form */}
        <div className="flex gap-2">
          <Input
            placeholder="company.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDomain()}
            className="flex-1"
          />
          <Button onClick={addDomain} disabled={saving || !newDomain.trim()}>
            {saving ? <Spinner className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>

        {/* Domain List */}
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No team domains configured. Add domains like &quot;yourcompany.com&quot; to group team emails.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => (
              <Badge key={domain} variant="secondary" className="px-3 py-1.5 text-sm">
                @{domain}
                <button
                  onClick={() => removeDomain(domain)}
                  className="ml-2 hover:text-red-500 transition-colors"
                  disabled={saving}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tip: You can also mark individual senders as &quot;Team&quot; in the VIP settings for non-domain-based team members.
        </p>
      </CardContent>
    </Card>
  );
}

export function EmailAccountsTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [credentials, setCredentials] = useState<ImapCredential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Sharing state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingCredential, setSharingCredential] = useState<ImapCredential | null>(null);
  const [shareableUsers, setShareableUsers] = useState<ShareableUser[]>([]);
  const [selectedSharedUsers, setSelectedSharedUsers] = useState<number[]>([]);
  const [savingSharing, setSavingSharing] = useState(false);

  // Fetch credentials and providers on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [credResponse, providerResponse] = await Promise.all([
        api.get<{ success: boolean; data: ImapCredential[] }>("/api/v1/imap_credentials"),
        api.get<{ success: boolean; data: Provider[] }>("/api/v1/imap_credentials/providers"),
      ]);
      setCredentials(credResponse.data || []);
      setProviders(providerResponse.data || []);
    } catch (error) {
      console.error("Failed to fetch email accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider?.settings) {
      setFormData((prev) => ({
        ...prev,
        provider: providerId,
        imap_host: provider.settings!.imap_host,
        imap_port: provider.settings!.imap_port,
        smtp_host: provider.settings!.smtp_host,
        smtp_port: provider.settings!.smtp_port,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        provider: providerId,
      }));
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/imap_credentials/test", {
        imap_credential: formData,
      });
      setTestResult(response);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        error: err.response?.data?.error || "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editingId) {
        // Update existing credential
        await api.put(`/api/v1/imap_credentials/${editingId}`, {
          imap_credential: formData,
        });
      } else {
        // Create new credential
        await api.post("/api/v1/imap_credentials", {
          imap_credential: formData,
        });
      }
      setDialogOpen(false);
      setFormData(DEFAULT_FORM);
      setEditingId(null);
      setTestResult(null);
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        error: err.response?.data?.error || `Failed to ${editingId ? "update" : "add"} account`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to remove this email account?"))) return;

    try {
      await api.delete(`/api/v1/imap_credentials/${id}`);
      fetchData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await api.post(`/api/v1/imap_credentials/${id}/sync`);
      // Refresh after a short delay
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error("Failed to trigger sync:", error);
    } finally {
      setSyncingId(null);
    }
  };

  const handleEdit = (cred: ImapCredential) => {
    setEditingId(cred.id);
    setFormData({
      name: cred.name || "",
      email_address: cred.email_address,
      provider: cred.provider || "custom",
      imap_host: cred.imap_host,
      imap_port: cred.imap_port,
      smtp_host: cred.smtp_host,
      smtp_port: cred.smtp_port,
      username: cred.username || cred.email_address,
      password: "", // Don't prefill password for security
      email_signature: cred.email_signature || "",
    });
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData(DEFAULT_FORM);
      setTestResult(null);
    }
  };

  // Sharing functions
  const handleOpenShareDialog = async (cred: ImapCredential) => {
    setSharingCredential(cred);
    setSelectedSharedUsers(cred.shared_with_user_ids || []);
    setShareDialogOpen(true);

    // Fetch shareable users if not already loaded
    if (shareableUsers.length === 0) {
      try {
        const response = await api.get<{ success: boolean; data: ShareableUser[] }>(
          "/api/v1/imap_credentials/shareable_users"
        );
        if (response.success) {
          setShareableUsers(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch shareable users:", error);
      }
    }
  };

  const handleToggleUserAccess = (userId: number) => {
    setSelectedSharedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSaveSharing = async () => {
    if (!sharingCredential) return;

    setSavingSharing(true);
    try {
      await api.put(`/api/v1/imap_credentials/${sharingCredential.id}/update_sharing`, {
        shared_with_user_ids: selectedSharedUsers,
      });
      toast({
        title: "Sharing updated",
        description: "Email access permissions have been saved.",
      });
      setShareDialogOpen(false);
      fetchData(); // Refresh the list
    } catch (error) {
      console.error("Failed to update sharing:", error);
      toast({
        title: "Error",
        description: "Failed to update sharing permissions.",
        variant: "destructive",
      });
    } finally {
      setSavingSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Connect email accounts to sync and send emails from TEEEM.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Email Account" : "Add Email Account"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the email account settings. Leave password blank to keep existing."
                  : "Connect an email account using IMAP/SMTP. Your password is encrypted."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select value={formData.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label>Account Name (optional)</Label>
                <Input
                  placeholder="Work Email, Personal, etc."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email_address}
                  onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="Usually your email address"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>Password / App Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  For Gmail/Outlook, use an App Password instead of your regular password.
                </p>
              </div>

              {/* Email Signature */}
              <div className="space-y-2">
                <Label>Email Signature</Label>
                <Textarea
                  placeholder="Your email signature (optional)..."
                  value={formData.email_signature}
                  onChange={(e) => setFormData({ ...formData, email_signature: e.target.value })}
                  rows={4}
                  className="resize-y font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This signature will be automatically added to emails sent from this account.
                </p>
              </div>

              {/* Server Settings (shown for custom) */}
              {formData.provider === "custom" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IMAP Host</Label>
                      <Input
                        placeholder="imap.example.com"
                        value={formData.imap_host}
                        onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IMAP Port</Label>
                      <Input
                        type="number"
                        value={formData.imap_port}
                        onChange={(e) =>
                          setFormData({ ...formData, imap_port: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        placeholder="smtp.example.com"
                        value={formData.smtp_host}
                        onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        value={formData.smtp_port}
                        onChange={(e) =>
                          setFormData({ ...formData, smtp_port: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-md ${
                    testResult.success
                      ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Connection successful!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>{testResult.error}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !formData.email_address || !formData.password}
              >
                {testing ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || (!editingId && !testResult?.success)}
              >
                {saving ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {editingId ? "Saving..." : "Adding..."}
                  </>
                ) : (
                  editingId ? "Save Changes" : "Add Account"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account List */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No email accounts connected</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add an email account to start syncing and sending emails from TEEEM.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => (
            <Card key={cred.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {cred.name || cred.email_address}
                      </CardTitle>
                      <CardDescription>{cred.email_address}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cred.is_active ? "default" : "secondary"}>
                      {cred.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {cred.provider && (
                      <Badge variant="outline">{cred.provider}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {/* Sync Status */}
                    <div className="flex items-center gap-1.5">
                      {cred.last_sync_status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : cred.last_sync_status === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      <span>
                        {cred.last_synced_at
                          ? `Synced ${formatDistanceToNow(new Date(cred.last_synced_at), { addSuffix: true })}`
                          : "Never synced"}
                      </span>
                    </div>

                    {/* Server Info */}
                    <span className="hidden sm:inline">
                      IMAP: {cred.imap_host}:{cred.imap_port}
                    </span>
                  </div>

                  {/* Sharing Info */}
                  {cred.shared_with_users?.length > 0 && (
                    <button
                      onClick={() => handleOpenShareDialog(cred)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Users className="h-4 w-4" />
                      <span>Shared with {cred.shared_with_users.map(u => u.name).join(", ")}</span>
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenShareDialog(cred)}
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      {cred.shared_with_users?.length > 0 ? `Sharing (${cred.shared_with_users.length})` : "Share"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(cred)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(cred.id)}
                      disabled={syncingId === cred.id}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1 ${syncingId === cred.id ? "animate-spin" : ""}`}
                      />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cred.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Error Message */}
                {cred.last_sync_error && (
                  <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-sm">
                    {cred.last_sync_error}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MS365 Mailbox Access Configuration */}
      <div className="mt-8 pt-8 border-t">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Microsoft 365 Mailbox Access</h3>
          <p className="text-sm text-muted-foreground">
            Configure which users can access which mailboxes from connected Microsoft 365 organizations.
          </p>
        </div>
        <MS365MailboxAccessConfig />
      </div>

      {/* Team Email Domains Configuration */}
      <div className="mt-8 pt-8 border-t">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Team Email Domains</h3>
          <p className="text-sm text-muted-foreground">
            Configure email domains that belong to your team. Emails from these domains will appear in the &quot;Team&quot; tab of the Split Inbox.
          </p>
        </div>
        <TeamEmailDomainsConfig />
      </div>

      {/* Share Email Access Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Email Access
            </DialogTitle>
            <DialogDescription>
              {sharingCredential && (
                <>
                  Grant other team members access to view emails from{" "}
                  <strong>{sharingCredential.email_address}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 max-h-[400px] overflow-y-auto">
            {shareableUsers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (
              shareableUsers
                .filter((user) => user.id !== sharingCredential?.user_id) // Exclude owner
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSharedUsers.includes(user.id)}
                      onCheckedChange={() => handleToggleUserAccess(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>
                    {user.email === sharingCredential?.email_address && (
                      <Badge variant="secondary" className="text-xs">
                        Email owner
                      </Badge>
                    )}
                  </div>
                ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSharing} disabled={savingSharing}>
              {savingSharing ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
