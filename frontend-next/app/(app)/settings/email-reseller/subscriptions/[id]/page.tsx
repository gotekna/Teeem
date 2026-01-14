"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Mail,
  Users,
  Building,
  DollarSign,
  TrendingUp,
  Plus,
  Play,
  Pause,
  Trash2,
  Send,
  MoreVertical,
  RefreshCw,
  ArrowRightLeft,
  FileText,
  Settings,
  Globe,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEmailSubscriptions, useEmailMailboxes, useEmailMigrations } from "@/hooks/useEmailSubscriptions";
import { AddMailboxDialog } from "@/components/email-reseller/AddMailboxDialog";
import { DnsStatusTab } from "@/components/email-reseller/DnsStatusTab";
import { cn } from "@/lib/utils";
import type {
  EmailSubscription,
  EmailMailbox,
  EmailMigration,
  EmailAlias,
  EmailSubscriptionInvoice,
  EmailDnsRecord,
  SubscriptionStatus,
  MailboxStatus,
  DnsStatus,
} from "@/lib/email-reseller-types";

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const MAILBOX_STATUS_COLORS: Record<MailboxStatus, string> = {
  active: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  provisioning: "bg-blue-500/10 text-blue-600",
  suspended: "bg-red-500/10 text-red-600",
  deleted: "bg-gray-500/10 text-gray-600",
  failed: "bg-red-500/10 text-red-600",
};

interface SubscriptionDetail extends EmailSubscription {
  mailboxes: EmailMailbox[];
  aliases: EmailAlias[];
  migrations: EmailMigration[];
  invoices: EmailSubscriptionInvoice[];
  dns_records: EmailDnsRecord[];
  dns_status: DnsStatus;
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subscriptionId = Number(params.id);

  const { getSubscription, sendInvite, cancelSubscription } = useEmailSubscriptions();
  const { removeMailbox } = useEmailMailboxes(subscriptionId);
  const { startMigration } = useEmailMigrations();

  const [subscription, setSubscription] = React.useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("mailboxes");
  const [showAddMailbox, setShowAddMailbox] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      const data = await getSubscription(subscriptionId);
      setSubscription(data as SubscriptionDetail);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, getSubscription]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRemoveMailbox = async (mailboxId: number) => {
    if (confirm("Are you sure you want to remove this mailbox?")) {
      await removeMailbox(mailboxId);
      await fetchData();
    }
  };

  const handleStartMigration = async (mailboxId: number) => {
    await startMigration(subscriptionId, mailboxId);
    await fetchData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatStorage = (usedGb: number, quotaGb: number) => {
    return `${usedGb.toFixed(1)} / ${quotaGb} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Subscription not found</p>
        <Button
          variant="link"
          onClick={() => router.push("/settings/email-reseller/subscriptions")}
        >
          Back to subscriptions
        </Button>
      </div>
    );
  }

  const monthlyRetail = subscription.monthly_retail || subscription.retail_price || 0;
  const monthlyWholesale = subscription.monthly_wholesale || subscription.wholesale_cost || 0;
  const margin = monthlyRetail - monthlyWholesale;
  const marginPercent = monthlyRetail > 0 ? Math.round((margin / monthlyRetail) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings/email-reseller/subscriptions")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{subscription.contact_name}</h1>
              <Badge className={cn("capitalize", STATUS_COLORS[subscription.status])}>
                {subscription.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{subscription.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => sendInvite(subscriptionId)}>
                <Send className="h-4 w-4 mr-2" />
                Send Invite
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => cancelSubscription(subscriptionId)}
                className="text-destructive"
              >
                Cancel Subscription
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mailboxes</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscription.mailbox_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyRetail)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(margin)}</div>
            <p className="text-xs text-muted-foreground">{marginPercent}% margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Migrations</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription.migrations?.filter((m) => m.status === "in_progress").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mailboxes" className="gap-2">
            <Mail className="h-4 w-4" />
            Mailboxes
          </TabsTrigger>
          <TabsTrigger value="migrations" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Migrations
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <FileText className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="dns" className="gap-2">
            <Globe className="h-4 w-4" />
            DNS
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Mailboxes Tab */}
        <TabsContent value="mailboxes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddMailbox(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Mailbox
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscription.mailboxes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No mailboxes yet
                    </TableCell>
                  </TableRow>
                ) : (
                  subscription.mailboxes?.map((mailbox) => (
                    <TableRow key={mailbox.id}>
                      <TableCell className="font-medium">{mailbox.email_address}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mailbox.mailbox_type === "user" && <Mail className="h-4 w-4" />}
                          {mailbox.mailbox_type === "shared" && <Users className="h-4 w-4" />}
                          {mailbox.mailbox_type === "resource" && <Building className="h-4 w-4" />}
                          <span className="capitalize">{mailbox.mailbox_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", MAILBOX_STATUS_COLORS[mailbox.status])}>
                          {mailbox.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress
                            value={mailbox.storage_used_percentage || 0}
                            className="h-1.5 w-24"
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatStorage(mailbox.storage_used_gb, mailbox.storage_quota_gb)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {mailbox.source_email && mailbox.status === "active" && (
                              <DropdownMenuItem onClick={() => handleStartMigration(mailbox.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Start Migration
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleRemoveMailbox(mailbox.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Migrations Tab */}
        <TabsContent value="migrations" className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscription.migrations?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No migrations
                    </TableCell>
                  </TableRow>
                ) : (
                  subscription.migrations?.map((migration) => (
                    <TableRow key={migration.id}>
                      <TableCell className="font-medium">{migration.source_email}</TableCell>
                      <TableCell className="capitalize">
                        {migration.migration_type.replace("_", " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={migration.status === "completed" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {migration.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-32">
                          <Progress value={migration.progress} className="h-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {migration.progress}% • {migration.processed_items.toLocaleString()} /{" "}
                            {migration.total_items.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {migration.started_at ? formatDate(migration.started_at) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Interval</span>
                  <span className="capitalize">{subscription.billing_interval}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next Billing</span>
                  <span>
                    {subscription.current_period_end
                      ? formatDate(subscription.current_period_end)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stripe Customer</span>
                  <span className="font-mono text-sm">
                    {subscription.stripe_customer_id || "-"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Retail</span>
                  <span>{formatCurrency(monthlyRetail)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wholesale Cost</span>
                  <span>{formatCurrency(monthlyWholesale)}</span>
                </div>
                <div className="flex justify-between font-medium text-green-600">
                  <span>Your Margin</span>
                  <span>{formatCurrency(margin)}/mo</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.invoices?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                        No invoices yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscription.invoices?.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {formatDate(invoice.billing_period_start)} -{" "}
                          {formatDate(invoice.billing_period_end)}
                        </TableCell>
                        <TableCell>{formatCurrency(invoice.retail_amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {invoice.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DNS Tab */}
        <TabsContent value="dns" className="space-y-4">
          <DnsStatusTab
            subscriptionId={subscriptionId}
            domain={subscription.domain}
            dnsStatus={subscription.dns_status || 'pending'}
            dnsRecords={subscription.dns_records || []}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Domain</label>
                  <p className="text-muted-foreground">{subscription.domain}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Created</label>
                  <p className="text-muted-foreground">{formatDate(subscription.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">PolarisMail Account ID</label>
                  <p className="text-muted-foreground font-mono">
                    {subscription.polaris_account_id || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total Storage</label>
                  <p className="text-muted-foreground">{subscription.total_storage_gb} GB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Mailbox Dialog */}
      <AddMailboxDialog
        open={showAddMailbox}
        onOpenChange={setShowAddMailbox}
        subscriptionId={subscriptionId}
        domain={subscription.domain}
        onSuccess={() => {
          setShowAddMailbox(false);
          fetchData();
        }}
      />
    </div>
  );
}
