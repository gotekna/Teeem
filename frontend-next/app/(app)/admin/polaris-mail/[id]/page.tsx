"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowLeft,
  RefreshCw,
  Plus,
  Send,
  Play,
  Pause,
  XCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Mailbox {
  id: number;
  email_address: string;
  display_name: string | null;
  mailbox_type: string;
  status: string;
  source_email: string | null;
  storage_quota_gb: number;
  storage_used_gb: number | null;
  provisioned_at: string | null;
}

interface Migration {
  id: number;
  mailbox_id: number | null;
  source_email: string;
  migration_type: string;
  status: string;
  progress: number;
  processed_items: number;
  total_items: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface Invite {
  id: number;
  token: string;
  status: string;
  portal_url: string;
  total_monthly: number;
  view_count: number;
  expires_at: string;
  created_at: string;
}

interface Invoice {
  id: number;
  billing_period: string;
  retail_amount: number;
  wholesale_amount: number;
  margin: number;
  status: string;
  stripe_invoice_id: string | null;
}

interface EmailAlias {
  id: number;
  alias_address: string;
  full_alias: string;
  target_address: string;
  alias_type: string;
  is_active: boolean;
  created_at: string;
}

interface SubscriptionDetail {
  id: number;
  contact_id: number;
  contact_name: string;
  domain: string;
  status: string;
  plan_type: string;
  mailbox_count: number;
  monthly_retail: number;
  monthly_wholesale: number;
  margin: number;
  billing_email: string | null;
  notes: string | null;
  stripe_subscription_id: string | null;
  polaris_account_id: string | null;
  current_period_end: string | null;
  created_at: string;
  mailboxes: Mailbox[];
  aliases: EmailAlias[];
  migrations: Migration[];
  invites: Invite[];
  invoices: Invoice[];
}

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add mailbox dialog state
  const [showAddMailbox, setShowAddMailbox] = useState(false);
  const [newMailbox, setNewMailbox] = useState({
    email: "",
    display_name: "",
    type: "user",
    source_email: "",
  });

  // Add alias dialog state
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [newAlias, setNewAlias] = useState({
    alias_address: "",
    target_address: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: SubscriptionDetail }>(
        `/api/v1/email_subscriptions/${id}`
      );
      if (res?.success) {
        setSubscription(res.data);
        setError(null);
      } else {
        setError("Failed to load subscription");
      }
    } catch (err) {
      console.error("Failed to load subscription:", err);
      setError("Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "$0";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      pending: { variant: "secondary", label: "Pending" },
      provisioning: { variant: "secondary", label: "Provisioning" },
      payment_pending: { variant: "secondary", label: "Payment Pending" },
      payment_failed: { variant: "destructive", label: "Payment Failed" },
      cancelled: { variant: "outline", label: "Cancelled" },
      suspended: { variant: "destructive", label: "Suspended" },
      failed: { variant: "destructive", label: "Failed" },
      deleted: { variant: "outline", label: "Deleted" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "default", label: "Completed" },
      queued: { variant: "secondary", label: "Queued" },
      expired: { variant: "outline", label: "Expired" },
    };
    const c = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const handleAddMailbox = async () => {
    if (!newMailbox.email) {
      toast({ title: "Error", description: "Email address is required", variant: "destructive" });
      return;
    }

    setActionLoading("add_mailbox");
    try {
      const res = await api.post<{ success: boolean; error?: string; data?: Mailbox }>(
        `/api/v1/email_subscriptions/${id}/add_mailbox`,
        {
          email: newMailbox.email,
          display_name: newMailbox.display_name || undefined,
          type: newMailbox.type,
          source_email: newMailbox.source_email || undefined,
        }
      );

      if (res?.success) {
        toast({ title: "Success", description: "Mailbox added successfully" });
        setShowAddMailbox(false);
        setNewMailbox({ email: "", display_name: "", type: "user", source_email: "" });
        loadData();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to add mailbox", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add mailbox", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.alias_address || !newAlias.target_address) {
      toast({ title: "Error", description: "Both alias and target address are required", variant: "destructive" });
      return;
    }

    setActionLoading("add_alias");
    try {
      const res = await api.post<{ success: boolean; error?: string; data?: EmailAlias }>(
        `/api/v1/email_subscriptions/${id}/add_alias`,
        {
          alias_address: newAlias.alias_address,
          target_address: newAlias.target_address,
        }
      );

      if (res?.success) {
        toast({ title: "Success", description: "Alias added successfully" });
        setShowAddAlias(false);
        setNewAlias({ alias_address: "", target_address: "" });
        loadData();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to add alias", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add alias", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAlias = async (aliasId: number) => {
    setActionLoading(`remove_alias_${aliasId}`);
    try {
      const res = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/email_subscriptions/${id}/remove_alias/${aliasId}`
      );

      if (res?.success) {
        toast({ title: "Success", description: "Alias removed" });
        loadData();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to remove alias", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to remove alias", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInvite = async () => {
    setActionLoading("send_invite");
    try {
      const res = await api.post<{ success: boolean; data: { portal_url: string } }>(
        `/api/v1/email_subscriptions/${id}/send_invite`
      );

      if (res?.success) {
        toast({ title: "Success", description: "Invite sent successfully" });
        // Copy portal URL to clipboard
        await navigator.clipboard.writeText(res.data.portal_url);
        toast({ title: "Copied", description: "Portal URL copied to clipboard" });
        loadData();
      } else {
        toast({ title: "Error", description: "Failed to send invite", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to send invite", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartMigration = async () => {
    setActionLoading("start_migration");
    try {
      const res = await api.post<{ success: boolean; error?: string; data: { started: number } }>(
        `/api/v1/email_subscriptions/${id}/start_migration`
      );

      if (res?.success) {
        toast({ title: "Success", description: `Migration started for ${res.data.started} mailboxes` });
        loadData();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to start migration", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to start migration", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading subscription...</div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error || "Subscription not found"}</div>
        <Button onClick={() => router.push("/admin/polaris-mail")} variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <TablePage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton fallbackHref="/admin/polaris-mail" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="h-6 w-6" />
                {subscription.domain}
              </h1>
              <p className="text-muted-foreground">{subscription.contact_name}</p>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleSendInvite} variant="outline" disabled={actionLoading === "send_invite"}>
              <Send className="h-4 w-4 mr-2" />
              Send Invite
            </Button>
            {subscription.status === "active" && (
              <Button onClick={handleStartMigration} disabled={actionLoading === "start_migration"}>
                <Play className="h-4 w-4 mr-2" />
                Start Migration
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mailboxes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscription.mailbox_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(subscription.monthly_retail)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(subscription.monthly_wholesale)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(subscription.margin)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mailboxes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mailboxes</CardTitle>
              <CardDescription>Email accounts in this subscription</CardDescription>
            </div>
            <Dialog open={showAddMailbox} onOpenChange={setShowAddMailbox}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mailbox
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Mailbox</DialogTitle>
                  <DialogDescription>Add a new mailbox to this subscription</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      placeholder={`user@${subscription.domain}`}
                      value={newMailbox.email}
                      onChange={(e) => setNewMailbox({ ...newMailbox, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={newMailbox.display_name}
                      onChange={(e) => setNewMailbox({ ...newMailbox, display_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newMailbox.type} onValueChange={(v) => setNewMailbox({ ...newMailbox, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User Mailbox ($6/mo)</SelectItem>
                        <SelectItem value="shared">Shared Mailbox ($3/mo)</SelectItem>
                        <SelectItem value="resource">Resource ($2/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source Email (for migration)</Label>
                    <Input
                      placeholder="user@company.onmicrosoft.com"
                      value={newMailbox.source_email}
                      onChange={(e) => setNewMailbox({ ...newMailbox, source_email: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddMailbox(false)}>Cancel</Button>
                  <Button onClick={handleAddMailbox} disabled={actionLoading === "add_mailbox"}>
                    Add Mailbox
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source (O365)</TableHead>
                  <TableHead>Storage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscription.mailboxes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No mailboxes yet. Click "Add Mailbox" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscription.mailboxes.map((mb) => (
                    <TableRow key={mb.id}>
                      <TableCell className="font-medium">{mb.email_address}</TableCell>
                      <TableCell>{mb.display_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mb.mailbox_type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(mb.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {mb.source_email || "-"}
                      </TableCell>
                      <TableCell>
                        {mb.storage_used_gb ? `${mb.storage_used_gb}GB / ` : ""}{mb.storage_quota_gb}GB
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Aliases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Email Aliases</CardTitle>
              <CardDescription>Forward emails to existing mailboxes. Use * for catch-all.</CardDescription>
            </div>
            <Dialog open={showAddAlias} onOpenChange={setShowAddAlias}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Alias
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Email Alias</DialogTitle>
                  <DialogDescription>
                    Create an alias to forward emails. Use * for catch-all (receives all unmatched emails).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Alias Address</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="info, sales, or * for catch-all"
                        value={newAlias.alias_address}
                        onChange={(e) => setNewAlias({ ...newAlias, alias_address: e.target.value })}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground">@{subscription.domain}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter * to create a catch-all that receives all emails not matched by other addresses.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Forward To</Label>
                    <Select
                      value={newAlias.target_address}
                      onValueChange={(v) => setNewAlias({ ...newAlias, target_address: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a mailbox" />
                      </SelectTrigger>
                      <SelectContent>
                        {subscription.mailboxes.map((mb) => (
                          <SelectItem key={mb.id} value={mb.email_address}>
                            {mb.email_address} {mb.display_name ? `(${mb.display_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddAlias(false)}>Cancel</Button>
                  <Button onClick={handleAddAlias} disabled={actionLoading === "add_alias"}>
                    Add Alias
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Forwards To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!subscription.aliases || subscription.aliases.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No aliases yet. Click "Add Alias" to add one, or use * for catch-all.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscription.aliases.map((alias) => (
                    <TableRow key={alias.id}>
                      <TableCell className="font-medium">
                        {alias.full_alias}
                        {alias.alias_type === "catchall" && (
                          <Badge variant="secondary" className="ml-2">Catch-All</Badge>
                        )}
                      </TableCell>
                      <TableCell>{alias.target_address}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{alias.alias_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAlias(alias.id)}
                          disabled={actionLoading === `remove_alias_${alias.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Migrations */}
        {subscription.migrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Migration Progress</CardTitle>
              <CardDescription>Email migration from Office 365</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subscription.migrations.map((mig) => (
                  <div key={mig.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mig.source_email}</span>
                        {getStatusBadge(mig.status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {mig.processed_items} / {mig.total_items} items
                      </span>
                    </div>
                    <Progress value={mig.progress} className="h-2" />
                    {mig.error_message && (
                      <p className="text-sm text-destructive">{mig.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invites */}
        {subscription.invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Migration Invites</CardTitle>
              <CardDescription>Self-service portal links sent to client</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Amount</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Portal URL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.invites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell>{formatCurrency(inv.total_monthly)}</TableCell>
                      <TableCell>{inv.view_count}</TableCell>
                      <TableCell>{new Date(inv.expires_at).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                            {inv.portal_url}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(inv.portal_url)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(inv.portal_url, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Invoices */}
        {subscription.invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.billing_period}</TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {formatCurrency(inv.retail_amount)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.wholesale_amount)}</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">
                        {formatCurrency(inv.margin)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </TablePage>
  );
}
